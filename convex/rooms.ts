import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const MAX_PLAYERS = 10;

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export const createRoom = mutation({
  args: {
    sessionId: v.string(),
    alias: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, alias, password }) => {
    const cleanAlias = alias.trim().slice(0, 16);
    if (!cleanAlias) throw new Error("Enter an alias");
    const pass = password ? password.trim().slice(0, 20) : "";

    let code = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      code = generateCode();
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!existing) break;
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostSessionId: sessionId,
      password: pass || undefined,
      hasPassword: !!pass,
      phase: "lobby",
      round: 0,
      createdAt: Date.now(),
    });

    await ctx.db.insert("players", {
      roomId,
      sessionId,
      alias: cleanAlias,
      seat: 1,
      isHost: true,
      score: 0,
      joinedAt: Date.now(),
    });

    await ctx.db.insert("messages", {
      roomId,
      sessionId,
      alias: "System",
      kind: "system",
      body: `${cleanAlias} created the room`,
      ts: Date.now(),
    });

    return { code, roomId };
  },
});

export const joinRoom = mutation({
  args: {
    sessionId: v.string(),
    alias: v.string(),
    code: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, alias, code, password }) => {
    const cleanAlias = alias.trim().slice(0, 16);
    if (!cleanAlias) throw new Error("Enter an alias");
    const roomCode = code.trim().toUpperCase();

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", roomCode))
      .unique();
    if (!room) throw new Error("Room not found");

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    const existing = players.find((p) => p.sessionId === sessionId);
    if (existing) {
      return { code: room.code, seat: existing.seat, roomId: room._id };
    }

    if (room.phase !== "lobby") throw new Error("That game already started");

    if (room.hasPassword && room.password !== password?.trim()) {
      throw new Error("Wrong password");
    }

    if (players.length >= MAX_PLAYERS) throw new Error("Room is full (10 max)");
    if (players.some((p) => p.alias.toLowerCase() === cleanAlias.toLowerCase())) {
      throw new Error("That alias is already taken");
    }

    const seat = players.length + 1;
    await ctx.db.insert("players", {
      roomId: room._id,
      sessionId,
      alias: cleanAlias,
      seat,
      isHost: false,
      score: 0,
      joinedAt: Date.now(),
    });

    await ctx.db.insert("messages", {
      roomId: room._id,
      sessionId,
      alias: "System",
      kind: "system",
      body: `${cleanAlias} joined`,
      ts: Date.now(),
    });

    return { code: room.code, seat, roomId: room._id };
  },
});

export const leaveRoom = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return;

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();

    if (room.phase === "lobby") {
      if (player) {
        await ctx.db.delete(player._id);
        await ctx.db.insert("messages", {
          roomId,
          sessionId,
          alias: "System",
          kind: "system",
          body: `${player.alias} left`,
          ts: Date.now(),
        });
      }
    }

    const presence = await ctx.db
      .query("presence")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();
    if (presence) await ctx.db.delete(presence._id);

    const remaining = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    if (remaining.length === 0) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_room_ts", (q) => q.eq("roomId", roomId))
        .collect();
      for (const m of messages) await ctx.db.delete(m._id);
      await ctx.db.delete(roomId);
      return;
    }

    if (room.hostSessionId === sessionId) {
      const newHost = remaining[0];
      await ctx.db.patch(newHost._id, { isHost: true });
      await ctx.db.patch(roomId, { hostSessionId: newHost.sessionId });
    }
  },
});

export const getRoomState = query({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;

    const now = Date.now();
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const onlineSessions = new Set(
      presence
        .filter((p) => now - p.updatedAt < 15000)
        .map((p) => p.sessionId)
    );

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    players.sort((a, b) => a.seat - b.seat);

    return {
      code: room.code,
      phase: room.phase,
      round: room.round || 0,
      hostSessionId: room.hostSessionId,
      hasPassword: room.hasPassword,
      category: room.category ?? null,
      players: players.map((p) => ({
        sessionId: p.sessionId,
        alias: p.alias,
        seat: p.seat,
        isHost: p.isHost,
        online: onlineSessions.has(p.sessionId),
        hasVoted: room.phase === "voting" ? p.votedFor !== undefined : undefined,
        votesReceived:
          room.phase === "reveal" ? p.votesReceived || 0 : undefined,
        score: p.score || 0,
      })),
      startingSeat: room.phase === "starting" ? room.starterSeat : undefined,
      reveal:
        room.phase === "reveal"
          ? {
              secretWord: room.secretWord ?? "",
              secretHint: room.secretHint ?? "",
              imposterSeat: room.imposterSeat ?? 1,
              accusedSeat: room.accusedSeat ?? 1,
            }
          : undefined,
    };
  },
});
