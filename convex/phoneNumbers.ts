import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const numbers = await ctx.db.query("phoneNumbers").collect();
    // Enrich with persona name
    const result = [];
    for (const num of numbers) {
      const persona = await ctx.db.get(num.personaId);
      result.push({
        ...num,
        personaName: persona?.name ?? "(deleted)",
      });
    }
    return result;
  },
});

export const getByNumber = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const num = await ctx.db
      .query("phoneNumbers")
      .withIndex("by_phoneNumber", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();
    if (!num) return null;
    const persona = await ctx.db.get(num.personaId);
    return { ...num, persona };
  },
});

export const create = mutation({
  args: {
    phoneNumber: v.string(),
    twilioSid: v.string(),
    personaId: v.id("personas"),
    friendlyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("phoneNumbers", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("phoneNumbers"),
    personaId: v.optional(v.id("personas")),
    friendlyName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Remove undefined fields
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.personaId !== undefined) updates.personaId = fields.personaId;
    if (fields.friendlyName !== undefined) updates.friendlyName = fields.friendlyName;
    if (fields.isActive !== undefined) updates.isActive = fields.isActive;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("phoneNumbers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
