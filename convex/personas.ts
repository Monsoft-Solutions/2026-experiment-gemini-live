import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("personas").collect();
  },
});

export const get = query({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    provider: v.optional(v.string()),
    voice: v.string(),
    language: v.string(),
    systemPrompt: v.string(),
    affectiveDialog: v.boolean(),
    proactiveAudio: v.boolean(),
    googleSearch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("personas", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("personas"),
    name: v.string(),
    provider: v.optional(v.string()),
    voice: v.string(),
    language: v.string(),
    systemPrompt: v.string(),
    affectiveDialog: v.boolean(),
    proactiveAudio: v.boolean(),
    googleSearch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
