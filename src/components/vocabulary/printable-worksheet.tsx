import { useMemo, type ReactNode } from 'react'

import { APP_NAME, LOGO_SM } from '@/lib/brand'
import type {
  DifferentiationTier,
  GradeLevel,
} from '@/lib/differentiation-types'
import { formatGradeLabel } from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import {
  buildWordFormsTableModel,
  orderWordFormEntriesByWords,
  type WordFormEntry,
  type WordFormSentence,
  type WordFormsTableModel,
} from '@/lib/word-forms-types'
import { generateCrossword } from '@/lib/crossword-generator'
import {
  formatCrosswordClueText,
  type CrosswordClue,
  type CrosswordPlacement,
  type CrosswordResult,
} from '@/lib/crossword-types'
import { generateWordSearch } from '@/lib/word-search-generator'
import {
  crosswordInstructions,
  defaultWorksheetTitle,
  drawOneWordInstructions,
  fillInBlankInstructions,
  formatStudentSentence,
  getOrderedPreviewableWorksheets,
  getSentencesForGrade,
  getWorksheetVariants,
  wordFormInstructionSteps,
  wordSearchInstructions,
  type PreviewableWorksheetId,
  type PageSize,
  variantLabel,
} from '@/lib/worksheet-preview'
import type { WordSearchResult, WordSearchSettings } from '@/lib/word-search-types'
import { WORKSHEET_LABELS, type WorksheetId } from '@/lib/vocabulary-types'
import { orderSentencesByWords, seededShuffle } from '@/lib/word-order'

type PrintableWorksheetProps = {
  title: string
  orderedWordsByWorksheet: Record<PreviewableWorksheetId, string[]>
  checked: Record<WorksheetId, boolean>
  worksheetOrder: WorksheetId[]
  tiers: DifferentiationTier[]
  differentiationEnabled: boolean
  sentences: FillInBlankSentence[]
  pageSize: PageSize
  fillInBlankWordBank: boolean
  wordSearchSettings: WordSearchSettings
  wordSearchSeed: number
  crosswordClues: CrosswordClue[]
  crosswordSeed: number
  wordFormSentences: WordFormSentence[]
  wordFormShuffleSeed: number
  wordForms: WordFormEntry[]
  isPrintRoot?: boolean
}

function WorksheetGeneratedFooter() {
  return (
    <footer className="worksheet-page-footer worksheet-generated-footer mt-8 flex items-center justify-center gap-2 text-[10px] text-black/50">
      <span>Generated with</span>
      <img
        src={LOGO_SM}
        alt={APP_NAME}
        width={16}
        height={16}
        className="size-4 rounded-sm"
      />
      <span>{APP_NAME}</span>
    </footer>
  )
}

function WorksheetHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string | null
}) {
  return (
    <div className="worksheet-page-header mb-6 border-b border-black/20 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="whitespace-nowrap text-lg font-bold leading-snug">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-xs leading-normal text-black/60">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 space-y-2 text-right text-xs">
          <div className="flex items-center justify-end gap-2">
            <span className="font-medium">Name:</span>
            <span className="inline-block min-w-32 border-b border-black/40" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="font-medium">Number:</span>
            <span className="inline-block min-w-32 border-b border-black/40" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DictationLine({ number }: { number: number }) {
  return (
    <li className="flex items-end gap-3 text-xs">
      <span className="w-5 shrink-0 font-medium">{number}.</span>
      <span className="flex-1 border-b border-black/40 pb-0.5" />
    </li>
  )
}

function WorksheetSectionShell({
  sectionId,
  children,
}: {
  sectionId: string
  children: ReactNode
}) {
  return (
    <div className="worksheet-section" data-section-id={sectionId}>
      {children}
    </div>
  )
}

function DictationSection({ words }: { words: string[] }) {
  const leftCount = Math.ceil(words.length / 2)
  const leftNumbers = Array.from({ length: leftCount }, (_, index) => index + 1)
  const rightNumbers = Array.from(
    { length: words.length - leftCount },
    (_, index) => leftCount + index + 1,
  )

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {WORKSHEET_LABELS['dictation-audio']}
      </h2>
      <p className="text-xs leading-relaxed text-black/70">
        Listen as each word is read aloud, then write the word you hear on the
        line.
      </p>
      {words.length === 0 ? (
        <p className="text-xs italic text-black/50">
          Add vocabulary words to generate dictation lines.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <ol className="space-y-3">
            {leftNumbers.map((number) => (
              <DictationLine key={number} number={number} />
            ))}
          </ol>
          <ol className="space-y-3">
            {rightNumbers.map((number) => (
              <DictationLine key={number} number={number} />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function DrawOneWordSection({
  hasWords,
  dictationIncluded,
}: {
  hasWords: boolean
  dictationIncluded: boolean
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {WORKSHEET_LABELS['draw-one-word']}
      </h2>
      <p className="text-xs leading-relaxed text-black/70">
        {drawOneWordInstructions(dictationIncluded)}
      </p>
      {hasWords ? (
        <>
          <div className="flex items-end gap-2 text-xs">
            <span className="shrink-0 font-medium">Word:</span>
            <span className="inline-block min-w-48 flex-1 border-b border-black/40 pb-0.5" />
          </div>
          <div
            className="min-h-[4.5in] border border-black/40"
            aria-label="Drawing space"
          />
        </>
      ) : (
        <p className="text-xs italic text-black/50">
          Add vocabulary words to preview this section.
        </p>
      )}
    </section>
  )
}

function WordBank({ words }: { words: string[] }) {
  if (words.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Word Bank</p>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            {words.map((word, index) => (
              <td
                key={`${word}-${index}`}
                className="border border-black/30 px-2 py-1.5 text-center align-middle"
              >
                {word}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function FillInBlankSection({
  sentences,
  words,
  showWordBank,
  dictationIncluded,
}: {
  sentences: FillInBlankSentence[]
  words: string[]
  showWordBank: boolean
  dictationIncluded: boolean
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {WORKSHEET_LABELS['fill-in-the-blank']}
      </h2>
      <p className="text-xs leading-relaxed text-black/70">
        {fillInBlankInstructions(showWordBank, dictationIncluded)}
      </p>
      {showWordBank ? <WordBank words={words} /> : null}
      {sentences.length === 0 ? (
        <p className="text-xs italic text-black/50">
          Add or generate fill-in-the-blank sentences to preview this section.
        </p>
      ) : (
        <ol className="space-y-3">
          {sentences.map((sentence, index) => (
            <li key={sentence.id} className="text-xs leading-relaxed">
              <span className="font-medium">{index + 1}. </span>
              {formatStudentSentence(sentence.sentence).replace(
                '_____',
                '________________',
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function WordSearchGrid({
  grid,
  highlightCells,
}: {
  grid: string[][]
  highlightCells?: Set<string>
}) {
  if (grid.length === 0) return null

  return (
    <table className="border-collapse text-xs">
      <tbody>
        {grid.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((letter, colIndex) => {
              const key = `${rowIndex},${colIndex}`
              const highlighted = highlightCells?.has(key)
              return (
                <td
                  key={colIndex}
                  className="h-5 w-5 border border-black/30 p-0 text-center align-middle leading-none"
                >
                  <span className={highlighted ? 'font-bold' : undefined}>
                    {letter}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function placementCellKeys(result: WordSearchResult): Set<string> {
  const keys = new Set<string>()
  for (const placement of result.placements) {
    const word = placement.word.replace(/[^a-zA-Z]/g, '').toUpperCase()
    for (let index = 0; index < word.length; index++) {
      const row = placement.row + placement.dr * index
      const col = placement.col + placement.dc * index
      keys.add(`${row},${col}`)
    }
  }
  return keys
}

function WordSearchSection({
  result,
  words,
  showWordBank,
  dictationIncluded,
}: {
  result: WordSearchResult
  words: string[]
  showWordBank: boolean
  dictationIncluded: boolean
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {WORKSHEET_LABELS['word-search']}
      </h2>
      <p className="text-xs leading-relaxed text-black/70">
        {wordSearchInstructions(showWordBank, dictationIncluded)}
      </p>
      {words.length === 0 ? (
        <p className="text-xs italic text-black/50">
          Add vocabulary words to generate a word search.
        </p>
      ) : (
        <>
          {showWordBank ? <WordBank words={words} /> : null}
          <WordSearchGrid grid={result.grid} />
          {result.unplaced.length > 0 ? (
            <p className="text-xs italic text-black/50">
              Could not place: {result.unplaced.join(', ')}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function CrosswordGrid({
  result,
  showAnswers = false,
}: {
  result: CrosswordResult
  showAnswers?: boolean
}) {
  if (result.grid.length === 0) return null

  return (
    <table className="border-collapse text-xs">
      <tbody>
        {result.grid.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, colIndex) => {
              if (!cell) {
                return <td key={colIndex} className="h-6 w-6 p-0" />
              }

              return (
                <td
                  key={colIndex}
                  className="relative h-6 w-6 border border-black/40 p-0 align-top"
                >
                  {cell.number ? (
                    <span className="absolute left-0.5 top-0 text-[8px] leading-none">
                      {cell.number}
                    </span>
                  ) : null}
                  <span className="flex h-full items-center justify-center text-[10px] leading-none">
                    {showAnswers ? cell.letter : ''}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function normalizeCrosswordWord(word: string): string {
  return word.trim().toLowerCase()
}

function clueTextForPlacement(
  placement: CrosswordPlacement,
  clues: CrosswordClue[],
): string {
  const clue = clues.find(
    (item) => normalizeCrosswordWord(item.word) === normalizeCrosswordWord(placement.word),
  )
  return formatCrosswordClueText(clue?.definitions ?? [])
}

function CrosswordClueList({
  title,
  placements,
  clues,
  showAnswers = false,
}: {
  title: string
  placements: CrosswordPlacement[]
  clues: CrosswordClue[]
  showAnswers?: boolean
}) {
  if (placements.length === 0) return null

  const sorted = [...placements].sort((left, right) => left.number - right.number)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{title}</p>
      <ol className="space-y-2 text-xs">
        {sorted.map((placement) => (
          <li key={`${placement.direction}-${placement.number}`}>
            <span className="font-medium">{placement.number}. </span>
            {clueTextForPlacement(placement, clues) || (
              <span className="italic text-black/50">No definition provided</span>
            )}
            {showAnswers ? (
              <span className="font-medium"> — {placement.word}</span>
            ) : (
              <span className="ml-2 inline-block min-w-24 border-b border-black/40" />
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function CrosswordUnplacedClueList({
  clues,
  placedWords,
  showAnswers = false,
}: {
  clues: CrosswordClue[]
  placedWords: Set<string>
  showAnswers?: boolean
}) {
  const unplaced = clues.filter(
    (clue) =>
      !placedWords.has(normalizeCrosswordWord(clue.word)) &&
      formatCrosswordClueText(clue.definitions).length > 0,
  )

  if (unplaced.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Additional clues</p>
      <ol className="space-y-2 text-xs">
        {unplaced.map((clue) => (
          <li key={clue.id}>
            {formatCrosswordClueText(clue.definitions)}
            {showAnswers ? (
              <span className="font-medium"> — {clue.word}</span>
            ) : (
              <span className="ml-2 inline-block min-w-24 border-b border-black/40" />
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function CrosswordSection({
  result,
  clues,
  words,
  showWordBank,
  dictationIncluded,
  showAnswers = false,
}: {
  result: CrosswordResult
  clues: CrosswordClue[]
  words: string[]
  showWordBank: boolean
  dictationIncluded: boolean
  showAnswers?: boolean
}) {
  const hasClues = clues.some(
    (clue) => formatCrosswordClueText(clue.definitions).length > 0,
  )
  const placedWords = new Set(
    result.placements.map((placement) => normalizeCrosswordWord(placement.word)),
  )

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">
        {WORKSHEET_LABELS['crossword-puzzle']}
      </h2>
      <p className="text-xs leading-relaxed text-black/70">
        {crosswordInstructions(showWordBank, dictationIncluded)}
      </p>
      {words.length === 0 ? (
        <p className="text-xs italic text-black/50">
          Add vocabulary words to generate a crossword.
        </p>
      ) : (
        <>
          {showWordBank ? <WordBank words={words} /> : null}
          <CrosswordGrid result={result} showAnswers={showAnswers} />
          {result.unplaced.length > 0 ? (
            <p className="text-xs italic text-black/50">
              Could not place: {result.unplaced.join(', ')}
            </p>
          ) : null}
          {hasClues ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <CrosswordClueList
                  title="Across"
                  placements={result.across}
                  clues={clues}
                  showAnswers={showAnswers}
                />
                <CrosswordClueList
                  title="Down"
                  placements={result.down}
                  clues={clues}
                  showAnswers={showAnswers}
                />
              </div>
              <CrosswordUnplacedClueList
                clues={clues}
                placedWords={placedWords}
                showAnswers={showAnswers}
              />
            </div>
          ) : (
            <p className="text-xs italic text-black/50">
              Generate or enter definitions to preview crossword clues.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function WordFormsTable({
  model,
  blankBaseWordColumn = false,
}: {
  model: WordFormsTableModel
  blankBaseWordColumn?: boolean
}) {
  if (model.rows.length === 0) return null

  return (
    <table className="w-full table-fixed border-collapse text-[10px]">
      <thead>
        <tr>
          <th className="border border-black/30 px-1.5 py-1 text-left font-semibold">
            Base word
          </th>
          {model.columns.map((column) => (
            <th
              key={column}
              className="border border-black/30 px-1.5 py-1 text-left font-semibold align-bottom"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row, rowIndex) => (
          <tr key={`${row.baseWord}-${rowIndex}`}>
            <td className="border border-black/30 px-1.5 py-1.5 font-medium align-middle">
              {blankBaseWordColumn ? null : row.baseWord}
            </td>
            {row.cells.map((cell, index) => (
              <td
                key={`${row.baseWord}-${index}`}
                className="border border-black/30 px-1.5 py-1.5 align-middle"
              >
                {cell === 'na' ? (
                  <span className="block text-center">X</span>
                ) : cell === 'blank' ? null : (
                  cell
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WordFormSentenceAnswerList({
  sentences,
}: {
  sentences: WordFormSentence[]
}) {
  if (sentences.length === 0) return null

  const leftCount = Math.ceil(sentences.length / 2)
  const leftItems = sentences.slice(0, leftCount)
  const rightItems = sentences.slice(leftCount)

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
      <ol className="space-y-1 text-xs">
        {leftItems.map((sentence, index) => (
          <li key={sentence.id}>
            {index + 1}. {sentence.form}
          </li>
        ))}
      </ol>
      <ol className="space-y-1 text-xs">
        {rightItems.map((sentence, index) => (
          <li key={sentence.id}>
            {leftCount + index + 1}. {sentence.form}
          </li>
        ))}
      </ol>
    </div>
  )
}

function WordFormsSentenceList({
  sentences,
  startNumber,
}: {
  sentences: WordFormSentence[]
  startNumber: number
}) {
  if (sentences.length === 0) return null

  return (
    <ol className="space-y-3">
      {sentences.map((sentence, index) => (
        <li
          key={sentence.id}
          className="worksheet-pdf-unit text-xs leading-relaxed"
          data-sentence-number={startNumber + index}
        >
          <span className="font-medium">{startNumber + index}. </span>
          {formatStudentSentence(sentence.sentence).replace(
            '_____',
            '________________',
          )}
        </li>
      ))}
    </ol>
  )
}

function WordFormsSection({
  wordForms,
  dictationWords,
  sentences,
  formWords,
  showWordBank,
  dictationIncluded,
}: {
  wordForms: WordFormEntry[]
  dictationWords: string[]
  sentences: WordFormSentence[]
  formWords: string[]
  showWordBank: boolean
  dictationIncluded: boolean
}) {
  const orderedEntries = dictationIncluded
    ? orderWordFormEntriesByWords(wordForms, dictationWords)
    : wordForms
  const studentTable = buildWordFormsTableModel(orderedEntries, 'student')
  const instructionSteps = wordFormInstructionSteps(
    showWordBank,
    dictationIncluded,
  )
  const hasContent = studentTable.rows.length > 0 || sentences.length > 0

  return (
    <section className="space-y-3">
      <div className="worksheet-section-prefix space-y-3">
        <h2 className="text-sm font-semibold">{WORKSHEET_LABELS['word-forms']}</h2>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-black/70">
          {instructionSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {!hasContent ? (
          <p className="text-xs italic text-black/50">
            Generate word forms and sentences to preview this section.
          </p>
        ) : (
          <>
            {studentTable.rows.length > 0 ? (
              <WordFormsTable model={studentTable} blankBaseWordColumn />
            ) : null}
            {showWordBank ? <WordBank words={formWords} /> : null}
          </>
        )}
      </div>
      <WordFormsSentenceList sentences={sentences} startNumber={1} />
    </section>
  )
}

function WorksheetSections({
  sections,
  orderedWordsByWorksheet,
  gradeSentences,
  gradeWordFormSentences,
  gradeCrosswordClues,
  wordFormBankWords,
  wordForms,
  fillInBlankWordBank,
  wordSearchResult,
  crosswordResult,
}: {
  sections: PreviewableWorksheetId[]
  orderedWordsByWorksheet: Record<PreviewableWorksheetId, string[]>
  gradeSentences: FillInBlankSentence[]
  gradeWordFormSentences: WordFormSentence[]
  gradeCrosswordClues: CrosswordClue[]
  wordFormBankWords: string[]
  wordForms: WordFormEntry[]
  fillInBlankWordBank: boolean
  wordSearchResult: WordSearchResult
  crosswordResult: CrosswordResult
}) {
  const dictationIncluded = sections.includes('dictation-audio')
  const dictationWords = orderedWordsByWorksheet['dictation-audio']
  const drawOneWordWords = orderedWordsByWorksheet['draw-one-word']
  const fillInBlankWords = orderedWordsByWorksheet['fill-in-the-blank']
  const wordSearchWords = orderedWordsByWorksheet['word-search']
  const crosswordWords = orderedWordsByWorksheet['crossword-puzzle']

  return (
    <div className="space-y-8">
      {sections.map((sectionId) => {
        if (sectionId === 'dictation-audio') {
          return (
            <WorksheetSectionShell key={sectionId} sectionId={sectionId}>
              <DictationSection words={dictationWords} />
            </WorksheetSectionShell>
          )
        }
        if (sectionId === 'draw-one-word') {
          return (
            <WorksheetSectionShell key={sectionId} sectionId={sectionId}>
              <DrawOneWordSection
                hasWords={drawOneWordWords.length > 0}
                dictationIncluded={dictationIncluded}
              />
            </WorksheetSectionShell>
          )
        }
        if (sectionId === 'fill-in-the-blank') {
          return (
            <WorksheetSectionShell key={sectionId} sectionId={sectionId}>
              <FillInBlankSection
                sentences={gradeSentences}
                words={fillInBlankWords}
                showWordBank={fillInBlankWordBank}
                dictationIncluded={dictationIncluded}
              />
            </WorksheetSectionShell>
          )
        }
        if (sectionId === 'word-search') {
          return (
            <WorksheetSectionShell key={sectionId} sectionId={sectionId}>
              <WordSearchSection
                result={wordSearchResult}
                words={wordSearchWords}
                showWordBank={fillInBlankWordBank}
                dictationIncluded={dictationIncluded}
              />
            </WorksheetSectionShell>
          )
        }
        if (sectionId === 'crossword-puzzle') {
          return (
            <WorksheetSectionShell key={sectionId} sectionId={sectionId}>
              <CrosswordSection
                result={crosswordResult}
                clues={gradeCrosswordClues}
                words={crosswordWords}
                showWordBank={fillInBlankWordBank}
                dictationIncluded={dictationIncluded}
              />
            </WorksheetSectionShell>
          )
        }
        if (sectionId === 'word-forms') {
          return (
            <WorksheetSectionShell key={sectionId} sectionId={sectionId}>
              <WordFormsSection
                wordForms={wordForms}
                dictationWords={dictationWords}
                sentences={gradeWordFormSentences}
                formWords={wordFormBankWords}
                showWordBank={fillInBlankWordBank}
                dictationIncluded={dictationIncluded}
              />
            </WorksheetSectionShell>
          )
        }
        return null
      })}
    </div>
  )
}

function AnswerKeyContent({
  sections,
  orderedWordsByWorksheet,
  wordSearchResult,
  crosswordResult,
  crosswordAnswerSections,
  wordFormAnswerSections,
  wordForms,
}: {
  sections: PreviewableWorksheetId[]
  orderedWordsByWorksheet: Record<PreviewableWorksheetId, string[]>
  wordSearchResult: WordSearchResult
  crosswordResult: CrosswordResult
  crosswordAnswerSections: Array<{
    label: string | null
    clues: CrosswordClue[]
  }>
  wordFormAnswerSections: Array<{
    label: string | null
    sentences: WordFormSentence[]
  }>
  wordForms: WordFormEntry[]
}) {
  const dictationWords = orderedWordsByWorksheet['dictation-audio']
  const fillInBlankWords = orderedWordsByWorksheet['fill-in-the-blank']
  const wordSearchWords = orderedWordsByWorksheet['word-search']
  const crosswordWords = orderedWordsByWorksheet['crossword-puzzle']
  const solutionCells = placementCellKeys(wordSearchResult)
  const wordFormsAnswerTable = buildWordFormsTableModel(
    sections.includes('dictation-audio')
      ? orderWordFormEntriesByWords(wordForms, dictationWords)
      : wordForms,
    'answer',
  )
  const hasWordFormsAnswers =
    wordFormAnswerSections.some((section) => section.sentences.length > 0) ||
    wordFormsAnswerTable.rows.length > 0
  const hasCrosswordAnswers =
    crosswordWords.length > 0 &&
    crosswordAnswerSections.some((section) =>
      section.clues.some(
        (clue) => formatCrosswordClueText(clue.definitions).length > 0,
      ),
    )

  return (
    <div className="space-y-6">
      {sections.includes('dictation-audio') && dictationWords.length > 0 ? (
        <WorksheetSectionShell sectionId="answer-dictation-audio">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">
              {WORKSHEET_LABELS['dictation-audio']}
            </h3>
            <ol className="space-y-1 text-xs">
              {dictationWords.map((word, index) => (
                <li key={index}>
                  {index + 1}. {word}
                </li>
              ))}
            </ol>
          </div>
        </WorksheetSectionShell>
      ) : null}

      {sections.includes('fill-in-the-blank') &&
      fillInBlankWords.length > 0 ? (
        <WorksheetSectionShell sectionId="answer-fill-in-the-blank">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">
              {WORKSHEET_LABELS['fill-in-the-blank']}
            </h3>
            <ol className="space-y-1 text-xs">
              {fillInBlankWords.map((word, index) => (
                <li key={index}>
                  {index + 1}. {word}
                </li>
              ))}
            </ol>
          </div>
        </WorksheetSectionShell>
      ) : null}

      {sections.includes('word-search') && wordSearchWords.length > 0 ? (
        <WorksheetSectionShell sectionId="answer-word-search">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold">
              {WORKSHEET_LABELS['word-search']}
            </h3>
            <WordSearchGrid
              grid={wordSearchResult.grid}
              highlightCells={solutionCells}
            />
            <p className="text-xs">{wordSearchWords.join(', ')}</p>
          </div>
        </WorksheetSectionShell>
      ) : null}

      {sections.includes('crossword-puzzle') && hasCrosswordAnswers ? (
        <WorksheetSectionShell sectionId="answer-crossword-puzzle">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold">
              {WORKSHEET_LABELS['crossword-puzzle']}
            </h3>
            {crosswordAnswerSections.map((section, sectionIndex) =>
              section.clues.length === 0 ? null : (
                <div key={sectionIndex} className="space-y-3">
                  {section.label ? (
                    <p className="text-xs font-medium">{section.label}</p>
                  ) : null}
                  <CrosswordSection
                    result={crosswordResult}
                    clues={section.clues}
                    words={crosswordWords}
                    showWordBank={false}
                    dictationIncluded={false}
                    showAnswers
                  />
                </div>
              ),
            )}
          </div>
        </WorksheetSectionShell>
      ) : null}

      {sections.includes('word-forms') && hasWordFormsAnswers ? (
        <WorksheetSectionShell sectionId="answer-word-forms">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold">
              {WORKSHEET_LABELS['word-forms']}
            </h3>
            <WordFormsTable model={wordFormsAnswerTable} />
            {wordFormAnswerSections.map((section, sectionIndex) =>
              section.sentences.length === 0 ? null : (
                <div key={sectionIndex} className="space-y-1">
                  {section.label ? (
                    <p className="text-xs font-medium">{section.label}</p>
                  ) : null}
                  <WordFormSentenceAnswerList sentences={section.sentences} />
                </div>
              ),
            )}
          </div>
        </WorksheetSectionShell>
      ) : null}
    </div>
  )
}

export function PrintableWorksheet({
  title,
  orderedWordsByWorksheet,
  checked,
  worksheetOrder,
  tiers,
  differentiationEnabled,
  sentences,
  pageSize,
  fillInBlankWordBank,
  wordSearchSettings,
  wordSearchSeed,
  crosswordClues,
  crosswordSeed,
  wordFormSentences,
  wordFormShuffleSeed,
  wordForms,
  isPrintRoot = false,
}: PrintableWorksheetProps) {
  const displayTitle = defaultWorksheetTitle(title)
  const sections = getOrderedPreviewableWorksheets(worksheetOrder, checked)
  const variants = getWorksheetVariants(tiers, differentiationEnabled)
  const defaultGrade = tiers[0]?.gradeLevel ?? '5'
  const multipleGrades = new Set(variants.map((v) => v.gradeLevel)).size > 1
  const fillInBlankWords = orderedWordsByWorksheet['fill-in-the-blank']
  const wordSearchWords = orderedWordsByWorksheet['word-search']
  const crosswordWords = orderedWordsByWorksheet['crossword-puzzle']

  const wordSearchResult = useMemo(
    () =>
      generateWordSearch(wordSearchWords, wordSearchSettings, wordSearchSeed),
    [wordSearchWords, wordSearchSettings, wordSearchSeed],
  )

  const crosswordResult = useMemo(
    () => generateCrossword(crosswordWords, crosswordSeed),
    [crosswordWords, crosswordSeed],
  )

  const sentencesByGrade = new Map<GradeLevel, FillInBlankSentence[]>()
  const wordFormSentencesByGrade = new Map<GradeLevel, WordFormSentence[]>()
  const wordFormBankByGrade = new Map<GradeLevel, string[]>()
  const crosswordCluesByGrade = new Map<GradeLevel, CrosswordClue[]>()

  for (const variant of variants) {
    if (!sentencesByGrade.has(variant.gradeLevel)) {
      sentencesByGrade.set(
        variant.gradeLevel,
        orderSentencesByWords(
          getSentencesForGrade(
            sentences,
            variant.gradeLevel,
            differentiationEnabled,
            defaultGrade,
          ),
          fillInBlankWords,
        ),
      )
    }

    if (!wordFormSentencesByGrade.has(variant.gradeLevel)) {
      const gradeSentences = getSentencesForGrade(
        wordFormSentences,
        variant.gradeLevel,
        differentiationEnabled,
        defaultGrade,
      )
      const shuffled = seededShuffle(gradeSentences, wordFormShuffleSeed)
      wordFormSentencesByGrade.set(variant.gradeLevel, shuffled)
      wordFormBankByGrade.set(
        variant.gradeLevel,
        shuffled.map((item) => item.form),
      )
    }

    if (!crosswordCluesByGrade.has(variant.gradeLevel)) {
      crosswordCluesByGrade.set(
        variant.gradeLevel,
        getSentencesForGrade(
          crosswordClues,
          variant.gradeLevel,
          differentiationEnabled,
          defaultGrade,
        ),
      )
    }
  }

  const hasAnswerKeyContent =
    (sections.includes('dictation-audio') &&
      orderedWordsByWorksheet['dictation-audio'].length > 0) ||
    (sections.includes('fill-in-the-blank') && fillInBlankWords.length > 0) ||
    (sections.includes('word-search') && wordSearchWords.length > 0) ||
    (sections.includes('crossword-puzzle') &&
      crosswordWords.length > 0 &&
      crosswordClues.some(
        (clue) => formatCrosswordClueText(clue.definitions).length > 0,
      )) ||
    (sections.includes('word-forms') &&
      (wordFormSentences.length > 0 || wordForms.length > 0))

  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Select at least one printable worksheet to preview.
      </p>
    )
  }

  const wordFormAnswerSections = [...wordFormSentencesByGrade.entries()].map(
    ([gradeLevel, gradeSentences]) => ({
      label: multipleGrades ? formatGradeLabel(gradeLevel) : null,
      sentences: gradeSentences,
    }),
  )

  const crosswordAnswerSections = [...crosswordCluesByGrade.entries()].map(
    ([gradeLevel, gradeClues]) => ({
      label: multipleGrades ? formatGradeLabel(gradeLevel) : null,
      clues: gradeClues,
    }),
  )

  return (
    <div
      id={isPrintRoot ? 'worksheet-print-root' : undefined}
      data-page-size={pageSize}
      className="worksheet-print-root text-black"
    >
      <div className="worksheet-pages">
        {variants.map((variant, pageIndex) => {
          const gradeSentences =
            sentencesByGrade.get(variant.gradeLevel) ??
            orderSentencesByWords(
              getSentencesForGrade(
                sentences,
                variant.gradeLevel,
                differentiationEnabled,
                defaultGrade,
              ),
              fillInBlankWords,
            )
          const gradeWordFormSentences =
            wordFormSentencesByGrade.get(variant.gradeLevel) ??
            seededShuffle(
              getSentencesForGrade(
                wordFormSentences,
                variant.gradeLevel,
                differentiationEnabled,
                defaultGrade,
              ),
              wordFormShuffleSeed,
            )
          const wordFormBankWords =
            wordFormBankByGrade.get(variant.gradeLevel) ??
            gradeWordFormSentences.map((item) => item.form)
          const gradeCrosswordClues =
            crosswordCluesByGrade.get(variant.gradeLevel) ??
            getSentencesForGrade(
              crosswordClues,
              variant.gradeLevel,
              differentiationEnabled,
              defaultGrade,
            )
          const subtitle = variantLabel(
            variant,
            differentiationEnabled,
            multipleGrades,
          )

          return (
            <div
              key={`${variant.gradeLevel}-${variant.copyIndex}`}
              className={`worksheet-page flex flex-col bg-white p-6 ${pageIndex > 0 ? 'page-break-before' : ''}`}
            >
              <WorksheetHeader title={displayTitle} subtitle={subtitle} />
              <div className="worksheet-page-body">
                <WorksheetSections
                  sections={sections}
                  orderedWordsByWorksheet={orderedWordsByWorksheet}
                  gradeSentences={gradeSentences}
                  gradeWordFormSentences={gradeWordFormSentences}
                  gradeCrosswordClues={gradeCrosswordClues}
                  wordFormBankWords={wordFormBankWords}
                  wordForms={wordForms}
                  fillInBlankWordBank={fillInBlankWordBank}
                  wordSearchResult={wordSearchResult}
                  crosswordResult={crosswordResult}
                />
              </div>
              <WorksheetGeneratedFooter />
            </div>
          )
        })}
      </div>

      {hasAnswerKeyContent ? (
        <div className="answer-key-section page-break-before mt-8 border-t border-black/20 bg-white p-6 pt-8">
          <h2 className="answer-key-header mb-4 text-sm font-bold">Answer Key</h2>
          <div className="answer-key-body">
            <AnswerKeyContent
            sections={sections}
            orderedWordsByWorksheet={orderedWordsByWorksheet}
            wordSearchResult={wordSearchResult}
            crosswordResult={crosswordResult}
            crosswordAnswerSections={crosswordAnswerSections}
            wordFormAnswerSections={wordFormAnswerSections}
            wordForms={wordForms}
          />
          </div>
          <WorksheetGeneratedFooter />
        </div>
      ) : null}
    </div>
  )
}
