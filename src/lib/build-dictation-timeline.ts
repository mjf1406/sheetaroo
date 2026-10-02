import type { AudioSegment } from '@/lib/dictation-types'
import { numberAnnouncement } from '@/lib/ordinals'

export type TimelineInput = {
  words: string[]
  repeatsPerWord: number
  silenceBetweenWordsMs: number
  announceNumbers: boolean
  silenceBetweenNumbersMs: number
  silenceBetweenWordGroupsMs: number
  getAnnouncementAudio: (wordIndex: number) => Promise<Blob | null>
  getWordAudio: (word: string, wordIndex: number) => Promise<Blob>
}

export async function buildDictationTimeline(
  input: TimelineInput,
): Promise<AudioSegment[]> {
  const segments: AudioSegment[] = []

  for (let wordIndex = 0; wordIndex < input.words.length; wordIndex++) {
    const word = input.words[wordIndex]!

    if (input.announceNumbers) {
      const announcement = await input.getAnnouncementAudio(wordIndex + 1)
      if (announcement) {
        segments.push({
          blob: announcement,
          silenceAfterMs: input.silenceBetweenNumbersMs,
        })
      }
    }

    for (let repeat = 0; repeat < input.repeatsPerWord; repeat++) {
      const isLastRepeat = repeat === input.repeatsPerWord - 1
      const isLastWord = wordIndex === input.words.length - 1
      const wordBlob = await input.getWordAudio(word, wordIndex)

      let silenceAfterMs = input.silenceBetweenWordsMs
      if (isLastRepeat && isLastWord) {
        silenceAfterMs = 0
      } else if (isLastRepeat && input.announceNumbers) {
        silenceAfterMs = input.silenceBetweenWordGroupsMs
      }

      segments.push({
        blob: wordBlob,
        silenceAfterMs,
      })
    }
  }

  return segments
}

export function announcementLabel(wordIndex: number): string {
  return numberAnnouncement(wordIndex)
}
