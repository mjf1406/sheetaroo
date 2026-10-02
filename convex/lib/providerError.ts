import { ConvexError } from 'convex/values'

export type ProviderName = 'gemini' | 'elevenlabs'

export type ProviderErrorData = {
  provider: ProviderName
  message: string
}

export function throwProviderError(
  provider: ProviderName,
  message: string,
): never {
  throw new ConvexError<ProviderErrorData>({ provider, message })
}

export function readProviderErrorMessage(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null
  const data: unknown = error.data
  if (typeof data === 'string') return data
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message
  }
  return null
}

export function elevenLabsHttpErrorMessage(
  status: number,
  detail: string,
): string {
  const trimmed = detail.trim().slice(0, 200)
  if (status === 429) {
    const extra = trimmed.length > 0 ? trimmed : 'Wait a bit and try again.'
    return `ElevenLabs rate limit reached, not this site. ${extra}`
  }
  if (status >= 500) {
    const extra = trimmed.length > 0 ? trimmed : 'Wait a bit and try again.'
    return `ElevenLabs is unavailable right now, not this site. ${extra}`
  }
  if (trimmed.length > 0) {
    return `ElevenLabs error (${status}): ${trimmed}`
  }
  return `ElevenLabs API error (${status}).`
}

function formatElevenLabsErrorDetail(detail: unknown): string {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object') {
    const record = detail as { status?: string; message?: string }
    if (record.status && record.message) {
      return `${record.status}: ${record.message}`
    }
    if (record.message) return record.message
    if (record.status) return record.status
  }
  return JSON.stringify(detail)
}

export async function readElevenLabsErrorDetail(
  response: Response,
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    return formatElevenLabsErrorDetail(body.detail)
  } catch {
    return ''
  }
}
