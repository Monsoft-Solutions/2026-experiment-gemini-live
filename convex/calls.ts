import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("calls")
      .withIndex("by_startedAt")
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { id: v.id("calls") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByCallSid = query({
  args: { callSid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calls")
      .withIndex("by_callSid", (q) => q.eq("twilioCallSid", args.callSid))
      .first();
  },
});

export const create = mutation({
  args: {
    phoneNumberId: v.optional(v.id("phoneNumbers")),
    personaId: v.optional(v.id("personas")),
    twilioCallSid: v.string(),
    from: v.string(),
    to: v.string(),
    status: v.string(),
    direction: v.string(),
    provider: v.optional(v.string()),
    personaName: v.optional(v.string()),
    settings: v.optional(v.object({
      voice: v.string(),
      language: v.string(),
      systemPrompt: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("calls", {
      ...args,
      startedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("calls"),
    status: v.optional(v.string()),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    recordingUrl: v.optional(v.string()),
    recordingSid: v.optional(v.string()),
    transcript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }
  },
});

export const updateByCallSid = mutation({
  args: {
    callSid: v.string(),
    status: v.optional(v.string()),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    recordingUrl: v.optional(v.string()),
    recordingSid: v.optional(v.string()),
    transcript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db
      .query("calls")
      .withIndex("by_callSid", (q) => q.eq("twilioCallSid", args.callSid))
      .first();
    if (!call) return null;
    const { callSid, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(call._id, updates);
    }
    return call._id;
  },
});

export const getMessages = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("callMessages")
      .withIndex("by_call", (q) => q.eq("callId", args.callId))
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    callId: v.id("calls"),
    role: v.union(v.literal("caller"), v.literal("agent")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("callMessages", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
