import type {
  DifferentiationTier,
  GradeLevel,
} from '@/lib/differentiation-types'
import type { FillInBlankSentence } from '@/lib/fill-in-blank-types'
import {
  defaultWorksheetTitle,
  fillInBlankInstructions,
  formatStudentSentence,
  getOrderedPreviewableWorksheets,
  getSentencesForGrade,
  getWorksheetVariants,
  type PreviewableWorksheetId,
  type PageSize,
  variantLabel,
} from '@/lib/worksheet-preview'
import { WORKSHEET_LABELS, type WorksheetId } from '@/lib/vocabulary-types'
import { orderSentencesByWords } from '@/lib/word-order'

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
  isPrintRoot?: boolean
}

function WorksheetGeneratedFooter() {
  return (
    <footer className="worksheet-generated-footer mt-8 flex items-center justify-center gap-2 text-[10px] text-black/50">
      <span>Generated with</span>
      <img
        src="/brand/ai-co-teacher%20logo%20125x125.webp"
        alt=""
        width={16}
        height={16}
        className="size-4 rounded-sm"
      />
      <span>AI Co-teacher</span>
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
    <div className="mb-6 border-b border-black/20 pb-4">
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

function WorksheetSections({
  sections,
  orderedWordsByWorksheet,
  gradeSentences,
  fillInBlankWordBank,
}: {
  sections: PreviewableWorksheetId[]
  orderedWordsByWorksheet: Record<PreviewableWorksheetId, string[]>
  gradeSentences: FillInBlankSentence[]
  fillInBlankWordBank: boolean
}) {
  const dictationIncluded = sections.includes('dictation-audio')
  const dictationWords = orderedWordsByWorksheet['dictation-audio']
  const fillInBlankWords = orderedWordsByWorksheet['fill-in-the-blank']

  return (
    <div className="space-y-8">
      {sections.map((sectionId) => {
        if (sectionId === 'dictation-audio') {
          return (
            <DictationSection key={sectionId} words={dictationWords} />
          )
        }
        return (
          <FillInBlankSection
            key={sectionId}
            sentences={gradeSentences}
            words={fillInBlankWords}
            showWordBank={fillInBlankWordBank}
            dictationIncluded={dictationIncluded}
          />
        )
      })}
    </div>
  )
}

function AnswerKeyContent({
  sections,
  orderedWordsByWorksheet,
}: {
  sections: PreviewableWorksheetId[]
  orderedWordsByWorksheet: Record<PreviewableWorksheetId, string[]>
}) {
  const dictationWords = orderedWordsByWorksheet['dictation-audio']
  const fillInBlankWords = orderedWordsByWorksheet['fill-in-the-blank']

  return (
    <div className="space-y-6">
      {sections.includes('dictation-audio') && dictationWords.length > 0 ? (
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
      ) : null}

      {sections.includes('fill-in-the-blank') &&
      fillInBlankWords.length > 0 ? (
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
  isPrintRoot = false,
}: PrintableWorksheetProps) {
  const displayTitle = defaultWorksheetTitle(title)
  const sections = getOrderedPreviewableWorksheets(worksheetOrder, checked)
  const variants = getWorksheetVariants(tiers, differentiationEnabled)
  const defaultGrade = tiers[0]?.gradeLevel ?? '5'
  const multipleGrades = new Set(variants.map((v) => v.gradeLevel)).size > 1
  const fillInBlankWords = orderedWordsByWorksheet['fill-in-the-blank']

  const sentencesByGrade = new Map<GradeLevel, FillInBlankSentence[]>()
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
  }

  const hasAnswerKeyContent =
    (sections.includes('dictation-audio') &&
      orderedWordsByWorksheet['dictation-audio'].length > 0) ||
    (sections.includes('fill-in-the-blank') && fillInBlankWords.length > 0)

  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Select Dictation or Fill-in-the-Blank to preview.
      </p>
    )
  }

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
                  fillInBlankWordBank={fillInBlankWordBank}
                />
              </div>
              <WorksheetGeneratedFooter />
            </div>
          )
        })}
      </div>

      {hasAnswerKeyContent ? (
        <div className="answer-key-section page-break-before mt-8 border-t border-black/20 bg-white p-6 pt-8">
          <h2 className="mb-4 text-sm font-bold">Answer Key</h2>
          <AnswerKeyContent
            sections={sections}
            orderedWordsByWorksheet={orderedWordsByWorksheet}
          />
          <WorksheetGeneratedFooter />
        </div>
      ) : null}
    </div>
  )
}
