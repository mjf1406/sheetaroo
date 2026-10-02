import { ConvexError } from 'convex/values'

function providerMessage(data: unknown): string | null {
  if (typeof data === 'string' && data.length > 0) return data
  if (typeof data !== 'object' || data === null) return null

  const record = data as { provider?: unknown; message?: unknown }
  if (
    (record.provider === 'gemini' || record.provider === 'elevenlabs') &&
    typeof record.message === 'string' &&
    record.message.length > 0
  ) {
    return record.message
  }
  return null
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    return providerMessage(error.data) ?? fallback
  }
  return fallback
}
