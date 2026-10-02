import {
  elevenLabsHttpErrorMessage,
  readElevenLabsErrorDetail,
  throwProviderError,
} from './providerError'

const FLASH_TURBO_MODEL_IDS = new Set([
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
])

export type EnglishVoiceEntry = {
  voiceId: string
  name: string
  previewUrl: string | null
}

export type EnglishVoiceGroup = {
  accent: string
  voices: EnglishVoiceEntry[]
}

type ElevenLabsVoiceResponse = {
  voices: Array<{
    voice_id: string
    name: string
    preview_url: string | null
    verified_languages?: Array<{
      language: string
      model_id: string
      accent: string | null
      preview_url: string | null
    }>
  }>
}

export function groupEnglishFlashVoicesByAccent(
  data: ElevenLabsVoiceResponse,
): EnglishVoiceGroup[] {
  const accentMap = new Map<string, EnglishVoiceEntry[]>()

  for (const voice of data.voices) {
    const english =
      voice.verified_languages?.filter(
        (lang) =>
          lang.language === 'en' && FLASH_TURBO_MODEL_IDS.has(lang.model_id),
      ) ?? []
    if (english.length === 0) continue

    for (const lang of english) {
      const accent = lang.accent ?? 'english'
      const accentKey = accent.toLowerCase()
      const voices = accentMap.get(accentKey) ?? []
      if (voices.some((entry) => entry.voiceId === voice.voice_id)) continue
      voices.push({
        voiceId: voice.voice_id,
        name: voice.name,
        previewUrl: lang.preview_url ?? voice.preview_url,
      })
      accentMap.set(accentKey, voices)
    }
  }

  return Array.from(accentMap.entries())
    .map(([accent, voices]) => ({ accent, voices }))
    .sort((a, b) => a.accent.localeCompare(b.accent))
}

export async function fetchEnglishFlashVoiceGroups(
  apiKey: string,
): Promise<EnglishVoiceGroup[]> {
  const response = await fetch(
    'https://api.elevenlabs.io/v2/voices?page_size=100',
    {
      headers: { 'xi-api-key': apiKey },
    },
  )

  if (!response.ok) {
    const detail = await readElevenLabsErrorDetail(response)
    throwProviderError(
      'elevenlabs',
      elevenLabsHttpErrorMessage(response.status, detail),
    )
  }

  const data = (await response.json()) as ElevenLabsVoiceResponse
  return groupEnglishFlashVoicesByAccent(data)
}

export function dedupeVoiceIds(groups: EnglishVoiceGroup[]): string[] {
  return dedupeVoices(groups).map((voice) => voice.voiceId)
}

export function dedupeVoices(
  groups: EnglishVoiceGroup[],
): Array<{ voiceId: string; name: string }> {
  const seen = new Set<string>()
  const voices: Array<{ voiceId: string; name: string }> = []

  for (const group of groups) {
    for (const voice of group.voices) {
      if (seen.has(voice.voiceId)) continue
      seen.add(voice.voiceId)
      voices.push({ voiceId: voice.voiceId, name: voice.name })
    }
  }

  return voices
}
