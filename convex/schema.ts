import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  personas: defineTable({
    name: v.string(),
    provider: v.optional(v.string()), // "gemini" | "openai" | "elevenlabs" — optional for backward compat
    voice: v.string(),
    language: v.string(),
    systemPrompt: v.string(),
    affectiveDialog: v.boolean(),
    proactiveAudio: v.boolean(),
    googleSearch: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  sessions: defineTable({
    personaName: v.optional(v.string()),
    settings: v.object({
      provider: v.optional(v.string()), // "gemini" | "openai" | "elevenlabs" — optional for backward compat
      voice: v.string(),
      language: v.string(),
      systemPrompt: v.string(),
      affectiveDialog: v.boolean(),
      proactiveAudio: v.boolean(),
      googleSearch: v.boolean(),
    }),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  }).index("by_startedAt", ["startedAt"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("gemini")),
    text: v.string(),
    timestamp: v.number(),
  }).index("by_session", ["sessionId", "timestamp"]),
});
