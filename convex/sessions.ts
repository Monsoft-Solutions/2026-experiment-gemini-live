import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("sessions")
      .withIndex("by_startedAt")
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    personaName: v.optional(v.string()),
    settings: v.object({
      provider: v.optional(v.string()),
      voice: v.string(),
      language: v.string(),
      systemPrompt: v.string(),
      affectiveDialog: v.boolean(),
      proactiveAudio: v.boolean(),
      googleSearch: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      personaName: args.personaName,
      settings: args.settings,
      startedAt: Date.now(),
    });
  },
});

export const end = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return;
    const now = Date.now();
    await ctx.db.patch(args.id, {
      endedAt: now,
      duration: Math.round((now - session.startedAt) / 1000),
    });
  },
});

export const getMessages = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("gemini")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      text: args.text,
      timestamp: Date.now(),
    });
  },
});
