import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_MESSAGES = 200;

export const sendMessage = mutation({
  args: {
    sessionId: v.string(),
    roomId: v.id("rooms"),
    kind: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { sessionId, roomId, kind, body }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();
    if (!player) throw new Error("You're not in this room");

    const text = body.trim().slice(0, 200);
    if (!text) return;

    await ctx.db.insert("messages", {
      roomId,
      sessionId,
      alias: player.alias,
      kind,
      body: text,
      ts: Date.now(),
    });

    const count = await ctx.db
      .query("messages")
      .withIndex("by_room_ts", (q) => q.eq("roomId", roomId))
      .collect();
    if (count.length > MAX_MESSAGES) {
      const toDelete = count.slice(0, count.length - MAX_MESSAGES);
      for (const m of toDelete) await ctx.db.delete(m._id);
    }
  },
});

export const listMessages = query({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room_ts", (q) => q.eq("roomId", roomId))
      .collect();
    return messages.slice(-MAX_MESSAGES);
  },
});
