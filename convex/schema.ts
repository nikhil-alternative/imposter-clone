import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostSessionId: v.string(),
    password: v.optional(v.string()),
    hasPassword: v.boolean(),
    category: v.optional(v.string()),
    phase: v.string(), // lobby | roleReveal | starting | voting | reveal
    secretWord: v.optional(v.string()),
    secretHint: v.optional(v.string()),
    imposterSeat: v.optional(v.number()),
    starterSeat: v.optional(v.number()),
    accusedSeat: v.optional(v.number()),
    round: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    alias: v.string(),
    seat: v.number(),
    isHost: v.boolean(),
    isImposter: v.optional(v.boolean()),
    word: v.optional(v.string()),
    hint: v.optional(v.string()),
    votedFor: v.optional(v.number()),
    votesReceived: v.optional(v.number()),
    score: v.number(),
    joinedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionId"]),

  messages: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    alias: v.string(),
    kind: v.string(), // emoji | text | system
    body: v.string(),
    ts: v.number(),
  }).index("by_room_ts", ["roomId", "ts"]),

  presence: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    alias: v.string(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionId"]),
});
