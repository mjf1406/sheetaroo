import { v } from 'convex/values'

import { action } from './_generated/server'
import { internal } from './_generated/api'
import { fetchEnglishFlashVoiceGroups } from './lib/englishVoices'
import { synthesizeSpeechBlob } from './lib/elevenlabsTts'

export const listEnglishVoices = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured')
    }

    return await fetchEnglishFlashVoiceGroups(apiKey)
  },
})

export const synthesizeSpeech = action({
  args: {
    voiceId: v.string(),
    text: v.string(),
    speed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.lib.auth.requireUserQuery)

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured')
    }

    const blob = await synthesizeSpeechBlob(
      apiKey,
      args.voiceId,
      args.text,
      args.speed,
    )
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    return btoa(binary)
  },
})
