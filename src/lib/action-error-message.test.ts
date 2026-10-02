import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vite-plus/test'

import { actionErrorMessage } from '@/lib/action-error-message'

describe('actionErrorMessage', () => {
  it('shows a Gemini provider message', () => {
    const error = new ConvexError({
      provider: 'gemini',
      message:
        'Gemini is busy right now, not this site. This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
    })

    expect(actionErrorMessage(error, 'Generation failed')).toBe(
      'Gemini is busy right now, not this site. This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
    )
  })

  it('shows an ElevenLabs provider message', () => {
    const error = new ConvexError({
      provider: 'elevenlabs',
      message:
        'ElevenLabs is unavailable right now, not this site. Wait a bit and try again.',
    })

    expect(actionErrorMessage(error, 'Generation failed')).toBe(
      'ElevenLabs is unavailable right now, not this site. Wait a bit and try again.',
    )
  })

  it('uses the fallback when the error is not from a provider', () => {
    expect(
      actionErrorMessage(new Error('Server Error'), 'Generation failed'),
    ).toBe('Generation failed')
    expect(actionErrorMessage('nope', 'Failed to load voices')).toBe(
      'Failed to load voices',
    )
  })
})
