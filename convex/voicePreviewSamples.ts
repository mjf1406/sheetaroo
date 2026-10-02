import { v } from 'convex/values'

import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import type { ActionCtx } from './_generated/server'
import {
  dedupeVoiceIds,
  fetchEnglishFlashVoiceGroups,
} from './lib/englishVoices'
import type { EnglishVoiceGroup } from './lib/englishVoices'
import { synthesizeSpeechBlob } from './lib/elevenlabsTts'
import { readProviderErrorMessage } from './lib/providerError'
import {
  buildVoiceSampleText,
  CACHED_PREVIEW_SPEEDS,
  LADDER_VERSION,
  quantizeSpeed,
} from './lib/voiceSampleLadder'
import { requireUser } from './lib/auth'

type SeedOneResult =
  | { status: 'created' }
  | { status: 'updated' }
  | { status: 'skipped' }
  | { status: 'error'; message: string }

export type SeedTarget = {
  accent: string
  voiceId: string
  name: string
  speeds: number[]
}

function buildSeedTargets(groups: EnglishVoiceGroup[]): SeedTarget[] {
  const seenVoiceSpeed = new Set<string>()
  const targets: SeedTarget[] = []

  for (const group of groups) {
    for (const voice of group.voices) {
      const speeds: number[] = []
      for (const speed of CACHED_PREVIEW_SPEEDS) {
        const key = `${voice.voiceId}:${speed}`
        if (seenVoiceSpeed.has(key)) continue
        seenVoiceSpeed.add(key)
        speeds.push(speed)
      }
      if (speeds.length > 0) {
        targets.push({
          accent: group.accent,
          voiceId: voice.voiceId,
          name: voice.name,
          speeds,
        })
      }
    }
  }

  return targets
}

function getElevenLabsApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured')
  }
  return apiKey
}

async function seedOneSample(
  ctx: ActionCtx,
  apiKey: string,
  voiceId: string,
  speed: number,
  sampleText: string,
): Promise<SeedOneResult> {
  try {
    const blob = await synthesizeSpeechBlob(apiKey, voiceId, sampleText, speed)
    const storageId = await ctx.storage.store(blob)
    const result = await ctx.runMutation(
      internal.voicePreviewSamples.upsertPreview,
      {
        voiceId,
        speed,
        ladderVersion: LADDER_VERSION,
        storageId,
      },
    )
    return { status: result.status }
  } catch (err) {
    return {
      status: 'error',
      message:
        readProviderErrorMessage(err) ??
        (err instanceof Error ? err.message : 'Unknown error'),
    }
  }
}

export const getPreview = query({
  args: {
    voiceId: v.string(),
    speed: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx)

    const speed = quantizeSpeed(args.speed)
    const sample = await ctx.db
      .query('voicePreviewSamples')
      .withIndex('by_voice_speed', (q) =>
        q.eq('voiceId', args.voiceId).eq('speed', speed),
      )
      .unique()

    if (!sample) return null

    return {
      audioUrl: await ctx.storage.getUrl(sample.storageId),
      speed: sample.speed,
      ladderVersion: sample.ladderVersion,
    }
  },
})

export const previewExists = internalQuery({
  args: {
    voiceId: v.string(),
    speed: v.number(),
  },
  handler: async (ctx, args) => {
    const sample = await ctx.db
      .query('voicePreviewSamples')
      .withIndex('by_voice_speed', (q) =>
        q.eq('voiceId', args.voiceId).eq('speed', args.speed),
      )
      .unique()

    return sample != null && sample.ladderVersion === LADDER_VERSION
  },
})

export const upsertPreview = internalMutation({
  args: {
    voiceId: v.string(),
    speed: v.number(),
    ladderVersion: v.number(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('voicePreviewSamples')
      .withIndex('by_voice_speed', (q) =>
        q.eq('voiceId', args.voiceId).eq('speed', args.speed),
      )
      .unique()

    if (existing) {
      if (existing.storageId !== args.storageId) {
        await ctx.storage.delete(existing.storageId)
      }
      await ctx.db.patch(existing._id, {
        ladderVersion: args.ladderVersion,
        storageId: args.storageId,
      })
      return { status: 'updated' as const }
    }

    await ctx.db.insert('voicePreviewSamples', {
      voiceId: args.voiceId,
      speed: args.speed,
      ladderVersion: args.ladderVersion,
      storageId: args.storageId,
    })
    return { status: 'created' as const }
  },
})

export const fetchSeedTargets = internalAction({
  args: {},
  handler: async () => {
    const apiKey = getElevenLabsApiKey()
    const groups = await fetchEnglishFlashVoiceGroups(apiKey)
    return {
      targets: buildSeedTargets(groups),
    }
  },
})

export const seedOne = internalAction({
  args: {
    voiceId: v.string(),
    speed: v.number(),
  },
  handler: async (ctx, args) => {
    const exists = await ctx.runQuery(
      internal.voicePreviewSamples.previewExists,
      {
        voiceId: args.voiceId,
        speed: args.speed,
      },
    )
    if (exists) {
      return { status: 'skipped' as const }
    }

    const apiKey = getElevenLabsApiKey()
    const sampleText = buildVoiceSampleText()
    return await seedOneSample(
      ctx,
      apiKey,
      args.voiceId,
      args.speed,
      sampleText,
    )
  },
})

export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = getElevenLabsApiKey()
    const groups = await fetchEnglishFlashVoiceGroups(apiKey)
    const voiceIds = dedupeVoiceIds(groups)
    const sampleText = buildVoiceSampleText()

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: Array<{ voiceId: string; speed: number; message: string }> =
      []

    for (const voiceId of voiceIds) {
      for (const speed of CACHED_PREVIEW_SPEEDS) {
        const exists = await ctx.runQuery(
          internal.voicePreviewSamples.previewExists,
          {
            voiceId,
            speed,
          },
        )
        if (exists) {
          skipped++
          continue
        }

        const result = await seedOneSample(
          ctx,
          apiKey,
          voiceId,
          speed,
          sampleText,
        )
        if (result.status === 'created') created++
        else if (result.status === 'updated') updated++
        else if (result.status === 'error') {
          errors.push({
            voiceId,
            speed,
            message: result.message,
          })
        }
      }
    }

    return {
      voices: voiceIds.length,
      speedsPerVoice: CACHED_PREVIEW_SPEEDS.length,
      created,
      updated,
      skipped,
      errors,
    }
  },
})
