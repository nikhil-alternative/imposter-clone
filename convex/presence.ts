import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const heartbeat = mutation({
  args: {
    sessionId: v.string(),
    roomId: v.id("rooms"),
    alias: v.string(),
  },
  handler: async (ctx, { sessionId, roomId, alias }) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now(), alias });
    } else {
      await ctx.db.insert("presence", {
        roomId,
        sessionId,
        alias,
        updatedAt: Date.now(),
      });
    }
  },
});

export const goOffline = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
