import { useQuery } from 'convex/react'

import {
  formatVoiceSampleDescription,
  quantizeSpeed,
} from '@/lib/voice-sample-ladder'

import { api } from '../../../convex/_generated/api'

type AiVoiceSampleProps = {
  voiceId: string
  speed: number
}

export function AiVoiceSample({ voiceId, speed }: AiVoiceSampleProps) {
  const quantizedSpeed = quantizeSpeed(speed)
  const preview = useQuery(api.voicePreviewSamples.getPreview, {
    voiceId,
    speed: quantizedSpeed,
  })

  if (!voiceId) return null

  if (preview === undefined) {
    return <p className="text-sm text-muted-foreground">Loading sample…</p>
  }

  if (!preview?.audioUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        Preview not seeded yet. Run{' '}
        <code className="text-xs">bun run seed:voice-samples</code>.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <audio controls src={preview.audioUrl} className="w-full" />
      <p className="text-xs text-muted-foreground">
        {formatVoiceSampleDescription(quantizedSpeed)}
      </p>
    </div>
  )
}
