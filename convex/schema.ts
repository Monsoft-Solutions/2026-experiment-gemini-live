import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  personas: defineTable({
    name: v.string(),
    provider: v.optional(v.string()),
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
      provider: v.optional(v.string()),
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

  // --- Admin settings (singleton pattern) ---
  adminSettings: defineTable({
    key: v.string(), // "twilio"
    twilioAccountSid: v.optional(v.string()),
    twilioAuthToken: v.optional(v.string()),
    twilioWebhookBaseUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // --- Twilio phone numbers linked to personas ---
  phoneNumbers: defineTable({
    phoneNumber: v.string(),       // E.164: "+15551234567"
    twilioSid: v.string(),         // Twilio PN SID
    personaId: v.id("personas"),
    friendlyName: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phoneNumber", ["phoneNumber"])
    .index("by_personaId", ["personaId"]),

  // --- Call history ---
  calls: defineTable({
    phoneNumberId: v.optional(v.id("phoneNumbers")),
    personaId: v.optional(v.id("personas")),
    twilioCallSid: v.string(),
    from: v.string(),
    to: v.string(),
    status: v.string(), // "in-progress" | "completed" | "failed" | "no-answer" | "busy"
    direction: v.string(), // "inbound"
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    recordingUrl: v.optional(v.string()),
    recordingSid: v.optional(v.string()),
    transcript: v.optional(v.string()),
    provider: v.optional(v.string()),
    personaName: v.optional(v.string()),
    settings: v.optional(v.object({
      voice: v.string(),
      language: v.string(),
      systemPrompt: v.string(),
    })),
  }).index("by_startedAt", ["startedAt"])
    .index("by_callSid", ["twilioCallSid"])
    .index("by_phoneNumber", ["phoneNumberId", "startedAt"]),

  // --- Call messages (turn-by-turn transcript) ---
  callMessages: defineTable({
    callId: v.id("calls"),
    role: v.union(v.literal("caller"), v.literal("agent")),
    text: v.string(),
    timestamp: v.number(),
  }).index("by_call", ["callId", "timestamp"]),
});
