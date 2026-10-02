import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireUserId } from './lib/auth'

const dictationSettings = v.object({
  words: v.array(v.string()),
  repeatsPerWord: v.number(),
  silenceBetweenWordsMs: v.number(),
  announceNumbers: v.boolean(),
  silenceBetweenNumbersMs: v.number(),
  silenceBetweenWordGroupsMs: v.optional(v.number()),
  voiceSource: v.union(v.literal('ai'), v.literal('own')),
  voiceId: v.optional(v.string()),
  accent: v.optional(v.string()),
  aiWordRepeatMode: v.optional(
    v.union(v.literal('synthesize_once'), v.literal('synthesize_each')),
  ),
  speechSpeed: v.optional(v.number()),
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const dictations = await ctx.db
      .query('dictations')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()

    return Promise.all(
      dictations.map(async (dictation) => ({
        ...dictation,
        audioUrl: await ctx.storage.getUrl(dictation.storageId),
      })),
    )
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    storageId: v.id('_storage'),
    settings: dictationSettings,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    return await ctx.db.insert('dictations', {
      userId,
      name: args.name,
      createdAt: Date.now(),
      storageId: args.storageId,
      settings: args.settings,
    })
  },
})

export const remove = mutation({
  args: { id: v.id('dictations') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const dictation = await ctx.db.get(args.id)
    if (!dictation || dictation.userId !== userId) {
      throw new Error('Dictation not found')
    }
    await ctx.storage.delete(dictation.storageId)
    await ctx.db.delete(args.id)
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})
