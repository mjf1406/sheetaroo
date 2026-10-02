import {
  elevenLabsHttpErrorMessage,
  readElevenLabsErrorDetail,
  throwProviderError,
} from './providerError'

const DEFAULT_TTS_MODEL = 'eleven_flash_v2_5'

export async function synthesizeSpeechBlob(
  apiKey: string,
  voiceId: string,
  text: string,
  speed?: number,
): Promise<Blob> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_TTS_MODEL,
        ...(speed != null && {
          voice_settings: { speed },
        }),
      }),
    },
  )

  if (!response.ok) {
    const detail = await readElevenLabsErrorDetail(response)
    throwProviderError(
      'elevenlabs',
      elevenLabsHttpErrorMessage(response.status, detail),
    )
  }

  return new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' })
}
