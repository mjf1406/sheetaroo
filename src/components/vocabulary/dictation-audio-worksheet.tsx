import { useAction, useMutation, useQuery } from 'convex/react'
import { Loader2, Play, Save } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ClipRecorder } from '@/components/dictation/clip-recorder'
import { AiVoiceSample } from '@/components/dictation/ai-voice-sample'
import { SavedDictations } from '@/components/dictation/saved-dictations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  base64ToBlob,
  stitchAudioSegments,
  uploadBlob,
} from '@/lib/audio-stitcher'
import { announcementLabel, buildDictationTimeline } from '@/lib/build-dictation-timeline'
import { DEFAULT_SETTINGS, type AiWordRepeatMode, type DictationSettings } from '@/lib/dictation-types'
import { toOrdinalWord } from '@/lib/ordinals'

import { api } from '../../../convex/_generated/api'

type VoiceGroup = {
  accent: string
  voices: Array<{ voiceId: string; name: string; previewUrl: string | null }>
}

function formatAccentLabel(accent: string): string {
  return accent.replace(/\b\w/g, (char) => char.toUpperCase())
}

type LibraryClip = { type: string; label: string }

function validateMyVoice(input: {
  words: string[]
  announceNumbers: boolean
  wordClips: Record<string, Blob>
  libraryClips: LibraryClip[] | undefined
}): { ready: boolean; message: string | null } {
  if (input.words.length > 20) {
    return {
      ready: false,
      message: 'Word list supports at most 20 words with number announcements.',
    }
  }

  const uniqueWords = [...new Set(input.words)]
  const missingWords = uniqueWords.filter((word) => !input.wordClips[word])

  if (input.announceNumbers) {
    const hasNumber = input.libraryClips?.some((clip) => clip.type === 'number')
    const requiredOrdinals = input.words.map((_, index) => toOrdinalWord(index + 1))
    const missingOrdinals = requiredOrdinals.filter(
      (ordinal) =>
        !input.libraryClips?.some((clip) => clip.type === 'ordinal' && clip.label === ordinal),
    )

    const parts: string[] = []
    if (!hasNumber) parts.push('"Number" clip')
    if (missingOrdinals.length > 0) parts.push(`ordinals ${missingOrdinals.join(', ')}`)
    if (missingWords.length > 0) parts.push(`word clips for: ${missingWords.join(', ')}`)

    if (parts.length > 0) {
      return { ready: false, message: `Record the ${parts.join(', and ')}.` }
    }
  } else if (missingWords.length > 0) {
    return {
      ready: false,
      message: `Record or upload audio for: ${missingWords.join(', ')}`,
    }
  }

  return { ready: true, message: null }
}

type DictationAudioWorksheetProps = {
  words: string[]
  dictationSeed: number
  audioStale: boolean
  onAudioGenerated: (meta: { seed: number; voiceSource: 'ai' | 'own' }) => void
  onRestoreOrder: () => void
}

export function DictationAudioWorksheet({
  words,
  dictationSeed,
  audioStale,
  onAudioGenerated,
  onRestoreOrder,
}: DictationAudioWorksheetProps) {
  const [repeatsPerWord, setRepeatsPerWord] = useState<number | ''>(
    DEFAULT_SETTINGS.repeatsPerWord,
  )
  const [silenceBetweenWordsMs, setSilenceBetweenWordsMs] = useState(
    DEFAULT_SETTINGS.silenceBetweenWordsMs,
  )
  const [announceNumbers, setAnnounceNumbers] = useState(DEFAULT_SETTINGS.announceNumbers)
  const [silenceBetweenNumbersMs, setSilenceBetweenNumbersMs] = useState(
    DEFAULT_SETTINGS.silenceBetweenNumbersMs,
  )
  const [silenceBetweenWordGroupsMs, setSilenceBetweenWordGroupsMs] = useState(
    DEFAULT_SETTINGS.silenceBetweenWordGroupsMs ?? 5000,
  )
  const [voiceSource, setVoiceSource] = useState<'ai' | 'own'>(DEFAULT_SETTINGS.voiceSource)
  const [aiWordRepeatMode, setAiWordRepeatMode] = useState<AiWordRepeatMode>(
    DEFAULT_SETTINGS.aiWordRepeatMode ?? 'synthesize_once',
  )
  const [speechSpeed, setSpeechSpeed] = useState(DEFAULT_SETTINGS.speechSpeed ?? 1.0)
  const [accent, setAccent] = useState<string>('')
  const [voiceId, setVoiceId] = useState<string>('')
  const [wordClips, setWordClips] = useState<Record<string, Blob>>({})
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const requiredOrdinals = useMemo(
    () =>
      announceNumbers && words.length > 0
        ? Array.from({ length: words.length }, (_, index) => toOrdinalWord(index + 1))
        : [],
    [announceNumbers, words.length],
  )
  const wordsNeedingClips = useMemo(() => [...new Set(words)], [words])

  const savedDictations = useQuery(api.dictations.list)
  const libraryClips = useQuery(api.voiceClips.listLibrary)
  const listVoices = useAction(api.elevenlabs.listEnglishVoices)
  const synthesizeSpeech = useAction(api.elevenlabs.synthesizeSpeech)
  const saveClip = useMutation(api.voiceClips.save)
  const generateClipUploadUrl = useMutation(api.voiceClips.generateUploadUrl)
  const generateDictationUploadUrl = useMutation(api.dictations.generateUploadUrl)
  const createDictation = useMutation(api.dictations.create)

  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)

  const selectedAccentVoices = useMemo(() => {
    const voices = voiceGroups.find((group) => group.accent === accent)?.voices ?? []
    const seen = new Set<string>()
    return voices.filter((voice) => {
      if (seen.has(voice.voiceId)) return false
      seen.add(voice.voiceId)
      return true
    })
  }, [voiceGroups, accent])

  const myVoiceValidation = useMemo(
    () =>
      validateMyVoice({
        words,
        announceNumbers,
        wordClips,
        libraryClips: libraryClips ?? undefined,
      }),
    [words, announceNumbers, wordClips, libraryClips],
  )
  const myVoiceReady = myVoiceValidation.ready

  async function loadVoices() {
    setVoicesLoading(true)
    setError(null)
    try {
      const groups = await listVoices({})
      setVoiceGroups(groups)
      if (groups.length > 0) {
        setAccent(groups[0]!.accent)
        setVoiceId(groups[0]!.voices[0]?.voiceId ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voices')
    } finally {
      setVoicesLoading(false)
    }
  }

  async function saveLibraryClip(
    type: 'number' | 'ordinal',
    label: string,
    blob: Blob,
  ) {
    const uploadUrl = await generateClipUploadUrl({})
    const storageId = await uploadBlob(uploadUrl, blob)
    await saveClip({ type, label, storageId: storageId as never })
  }

  async function getLibraryBlob(type: 'number' | 'ordinal', label: string): Promise<Blob | null> {
    const clip = libraryClips?.find((item) => item.type === type && item.label === label)
    if (!clip?.audioUrl) return null
    const response = await fetch(clip.audioUrl)
    return response.blob()
  }

  async function handleGenerate() {
    if (repeatsPerWord === '' || repeatsPerWord < 1 || repeatsPerWord > 10) {
      setError('Enter repeats per word (1–10).')
      return
    }

    if (words.length === 0) {
      setError('Add at least one word to the vocabulary list above.')
      return
    }

    if (voiceSource === 'own') {
      const validation = validateMyVoice({
        words,
        announceNumbers,
        wordClips,
        libraryClips: libraryClips ?? undefined,
      })
      if (!validation.ready) {
        setError(validation.message)
        return
      }
    }

    setError(null)
    setIsGenerating(true)
    setProgress(0)
    setGeneratedBlob(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)

    try {
      const aiSynthOnce = voiceSource === 'ai' && aiWordRepeatMode === 'synthesize_once'
      const wordSynthSteps = aiSynthOnce ? words.length : words.length * repeatsPerWord
      const totalSteps = words.length * (announceNumbers ? 1 : 0) + wordSynthSteps
      let completed = 0
      const aiWordCache = new Map<number, Blob>()

      const segments = await buildDictationTimeline({
        words,
        repeatsPerWord,
        silenceBetweenWordsMs,
        announceNumbers,
        silenceBetweenNumbersMs,
        silenceBetweenWordGroupsMs,
        getAnnouncementAudio: async (index) => {
          setProgressLabel(`Announcing ${announcementLabel(index)}`)
          if (voiceSource === 'ai') {
            if (!voiceId) throw new Error('Select a voice')
            const base64 = await synthesizeSpeech({
              voiceId,
              text: announcementLabel(index),
              speed: speechSpeed,
            })
            completed++
            setProgress(Math.round((completed / Math.max(totalSteps, 1)) * 100))
            return base64ToBlob(base64, 'audio/mpeg')
          }

          const numberBlob = await getLibraryBlob('number', 'number')
          const ordinalBlob = await getLibraryBlob('ordinal', toOrdinalWord(index))
          if (!numberBlob || !ordinalBlob) {
            throw new Error('Record the "Number" clip and all required ordinal clips first.')
          }
          completed++
          setProgress(Math.round((completed / Math.max(totalSteps, 1)) * 100))
          return stitchAudioSegments([
            { blob: numberBlob, silenceAfterMs: 0 },
            { blob: ordinalBlob, silenceAfterMs: 0 },
          ])
        },
        getWordAudio: async (word, wordIndex) => {
          setProgressLabel(`Speaking "${word}"`)
          if (voiceSource === 'ai') {
            if (!voiceId) throw new Error('Select a voice')
            if (aiSynthOnce) {
              const cached = aiWordCache.get(wordIndex)
              if (cached) return cached
              const base64 = await synthesizeSpeech({ voiceId, text: word, speed: speechSpeed })
              completed++
              setProgress(Math.round((completed / Math.max(totalSteps, 1)) * 100))
              const blob = base64ToBlob(base64, 'audio/mpeg')
              aiWordCache.set(wordIndex, blob)
              return blob
            }
            const base64 = await synthesizeSpeech({ voiceId, text: word, speed: speechSpeed })
            completed++
            setProgress(Math.round((completed / Math.max(totalSteps, 1)) * 100))
            return base64ToBlob(base64, 'audio/mpeg')
          }

          const clip = wordClips[word]
          if (!clip) {
            throw new Error(`Record or upload audio for "${word}"`)
          }
          completed++
          setProgress(Math.round((completed / Math.max(totalSteps, 1)) * 100))
          return clip
        },
      })

      setProgressLabel('Stitching audio…')
      const blob = await stitchAudioSegments(segments)
      const url = URL.createObjectURL(blob)
      setGeneratedBlob(blob)
      setPreviewUrl(url)
      setProgress(100)
      setProgressLabel('Done')
      onAudioGenerated({ seed: dictationSeed, voiceSource })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSave() {
    if (!generatedBlob || !saveName.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const uploadUrl = await generateDictationUploadUrl({})
      const storageId = await uploadBlob(uploadUrl, generatedBlob)
      const settings: DictationSettings = {
        words,
        repeatsPerWord,
        silenceBetweenWordsMs,
        announceNumbers,
        silenceBetweenNumbersMs,
        silenceBetweenWordGroupsMs,
        voiceSource,
        voiceId: voiceSource === 'ai' ? voiceId : undefined,
        accent: voiceSource === 'ai' ? accent : undefined,
        aiWordRepeatMode: voiceSource === 'ai' ? aiWordRepeatMode : undefined,
        speechSpeed: voiceSource === 'ai' ? speechSpeed : undefined,
      }
      await createDictation({
        name: saveName.trim(),
        storageId: storageId as never,
        settings,
      })
      setSaveOpen(false)
      setSaveName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const ordinalClipsSaved = requiredOrdinals.filter((ordinal) =>
    libraryClips?.some((clip) => clip.type === 'ordinal' && clip.label === ordinal),
  ).length

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dictation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure timing and voice, then generate audio from your vocabulary list.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="repeats">Repeats per word</Label>
              <NumberInput
                id="repeats"
                value={repeatsPerWord}
                onValueChange={setRepeatsPerWord}
                min={1}
                max={10}
              />
            </div>

            <div className="space-y-2">
              <Label>Silence between word repetitions: {silenceBetweenWordsMs / 1000}s</Label>
              <Slider
                min={500}
                max={10000}
                step={500}
                value={[silenceBetweenWordsMs]}
                onValueChange={([value]) => setSilenceBetweenWordsMs(value ?? 3000)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="announce-numbers">Announce numbers before each word</Label>
                <p className="text-xs text-muted-foreground">
                  e.g. &quot;Number one&quot;, then the word
                </p>
              </div>
              <Switch
                id="announce-numbers"
                checked={announceNumbers}
                onCheckedChange={setAnnounceNumbers}
              />
            </div>

            {announceNumbers ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Silence after number announcement: {silenceBetweenNumbersMs / 1000}s</Label>
                  <Slider
                    min={500}
                    max={5000}
                    step={250}
                    value={[silenceBetweenNumbersMs]}
                    onValueChange={([value]) => setSilenceBetweenNumbersMs(value ?? 1500)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Silence between number groups: {silenceBetweenWordGroupsMs / 1000}s</Label>
                  <p className="text-xs text-muted-foreground">
                    Pause after all repetitions of a word, before the next number announcement
                  </p>
                  <Slider
                    min={500}
                    max={10000}
                    step={500}
                    value={[silenceBetweenWordGroupsMs]}
                    onValueChange={([value]) => setSilenceBetweenWordGroupsMs(value ?? 5000)}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={voiceSource}
              onValueChange={(value) => setVoiceSource(value as 'ai' | 'own')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai">AI Voice</TabsTrigger>
                <TabsTrigger value="own">My Voice</TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadVoices()}
                    disabled={voicesLoading}
                  >
                    {voicesLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Load English voices
                  </Button>
                </div>

                {voiceGroups.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Accent</Label>
                      <Select value={accent} onValueChange={setAccent}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select accent" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-60">
                          {voiceGroups.map((group) => (
                            <SelectItem key={group.accent} value={group.accent}>
                              {formatAccentLabel(group.accent)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Voice</Label>
                      <Select value={voiceId} onValueChange={setVoiceId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-60">
                          {selectedAccentVoices.map((voice) => (
                            <SelectItem key={voice.voiceId} value={voice.voiceId}>
                              {voice.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}

                {voiceId ? (
                  <div className="space-y-2">
                    <Label>Speech speed: {speechSpeed.toFixed(1)}x</Label>
                    <Slider
                      min={0.7}
                      max={1.2}
                      step={0.1}
                      value={[speechSpeed]}
                      onValueChange={([value]) => setSpeechSpeed(value ?? 1.0)}
                    />
                  </div>
                ) : null}

                {voiceId ? <AiVoiceSample voiceId={voiceId} speed={speechSpeed} /> : null}

                <div className="space-y-2">
                  <Label>Word repetitions (AI)</Label>
                  <Select
                    value={aiWordRepeatMode}
                    onValueChange={(value) => setAiWordRepeatMode(value as AiWordRepeatMode)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="synthesize_once">
                        Synthesize once, then repeat (lower cost)
                      </SelectItem>
                      <SelectItem value="synthesize_each">
                        Synthesize every repetition (costs more)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {aiWordRepeatMode === 'synthesize_once'
                      ? 'ElevenLabs generates each word once; repeats reuse the same audio.'
                      : 'ElevenLabs generates fresh audio for every repetition — uses more API credits.'}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  AI voice powered by{' '}
                  <a
                    href="https://elevenlabs.io"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    ElevenLabs
                  </a>
                  . Uses Flash (low-cost) voices.
                </p>
              </TabsContent>

              <TabsContent value="own" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Record clips for this dictation. With number announcements on, record
                  &quot;Number&quot; once and ordinals only up to your word count
                  (&quot;one&quot;, &quot;two&quot;, …).
                </p>

                {announceNumbers ? (
                  <>
                    <ClipRecorder
                      label="Number clip"
                      description='Record the word "Number" once'
                      existingUrl={
                        libraryClips?.find((clip) => clip.type === 'number')?.audioUrl ?? null
                      }
                      onRecorded={(blob) => void saveLibraryClip('number', 'number', blob)}
                    />

                    {requiredOrdinals.length > 0 ? (
                      <div className="space-y-2">
                        <Label>
                          Ordinal clips ({ordinalClipsSaved}/{requiredOrdinals.length} saved)
                        </Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {requiredOrdinals.map((ordinal) => (
                            <ClipRecorder
                              key={ordinal}
                              label={ordinal}
                              existingUrl={
                                libraryClips?.find(
                                  (clip) => clip.type === 'ordinal' && clip.label === ordinal,
                                )?.audioUrl ?? null
                              }
                              onRecorded={(blob) => void saveLibraryClip('ordinal', ordinal, blob)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {wordsNeedingClips.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Word clips for this dictation</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {wordsNeedingClips.map((word) => (
                        <ClipRecorder
                          key={word}
                          label={word}
                          onRecorded={(blob) =>
                            setWordClips((current) => ({ ...current, [word]: blob }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>

            <div className="mt-6 space-y-4 border-t pt-4">
              <Button
                onClick={() => void handleGenerate()}
                disabled={
                  isGenerating ||
                  repeatsPerWord === '' ||
                  words.length === 0 ||
                  (voiceSource === 'own' && !myVoiceReady)
                }
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  'Generate audio'
                )}
              </Button>

              {voiceSource === 'own' && words.length > 0 && !myVoiceReady && !isGenerating ? (
                <p className="text-sm text-muted-foreground">
                  Record all required clips above before generating.
                </p>
              ) : null}

              {isGenerating || progress > 0 ? (
                <div className="space-y-2">
                  <Progress value={progress} />
                  {progressLabel ? (
                    <p className="text-sm text-muted-foreground">{progressLabel}</p>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              {audioStale ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <p>
                    Audio no longer matches the current word order. Regenerate audio
                    or restore the previous order.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={onRestoreOrder}
                  >
                    Restore previous order
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {previewUrl ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="self-start">
            <CardHeader>
              <CardTitle>Audio preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <audio controls src={previewUrl} className="w-full" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href={previewUrl} download="dictation.wav">
                    Download
                  </a>
                </Button>
                <Button onClick={() => setSaveOpen(true)}>
                  <Save className="size-4" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {savedDictations ? <SavedDictations dictations={savedDictations} /> : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSave()
            }}
          >
            <DialogHeader>
              <DialogTitle>Save dictation</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="dictation-name">Name</Label>
              <Input
                id="dictation-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Week 3 spelling list"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !saveName.trim()}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
