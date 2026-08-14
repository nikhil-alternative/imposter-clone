import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getRandomWord } from "./words";

async function getPlayers(ctx, roomId) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  players.sort((a, b) => a.seat - b.seat);
  return players;
}

async function resolveRound(ctx, roomId, accused) {
  const room = await ctx.db.get(roomId);
  const players = await getPlayers(ctx, roomId);
  const isCorrect = accused.seat === room.imposterSeat;

  for (const p of players) {
    const earns = (isCorrect && !p.isImposter) || (!isCorrect && p.isImposter);
    if (earns) await ctx.db.patch(p._id, { score: (p.score || 0) + 1 });
  }

  await ctx.db.patch(roomId, { phase: "reveal", accusedSeat: accused.seat });
  await ctx.db.insert("messages", {
    roomId,
    sessionId: "system",
    alias: "System",
    kind: "system",
    body: isCorrect
      ? `${accused.alias} was voted out — Crew wins!`
      : `${accused.alias} was wrong — the Imposter got away!`,
    ts: Date.now(),
  });
}

export const startGame = mutation({
  args: {
    sessionId: v.string(),
    roomId: v.id("rooms"),
    category: v.string(),
  },
  handler: async (ctx, { sessionId, roomId, category }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can start");
    if (room.phase !== "lobby") throw new Error("Game already started");

    const players = await getPlayers(ctx, roomId);
    if (players.length < 3) throw new Error("Need at least 3 players");

    const { word, hint } = getRandomWord(category);
    const imposterSeat = players[Math.floor(Math.random() * players.length)].seat;
    const starterSeat = players[Math.floor(Math.random() * players.length)].seat;

    for (const p of players) {
      const isImposter = p.seat === imposterSeat;
      await ctx.db.patch(p._id, {
        isImposter,
        word: isImposter ? undefined : word,
        hint: isImposter ? hint : undefined,
        votedFor: undefined,
        votesReceived: 0,
      });
    }

    await ctx.db.patch(roomId, {
      category,
      phase: "roleReveal",
      secretWord: word,
      secretHint: hint,
      imposterSeat,
      starterSeat,
      accusedSeat: undefined,
      round: (room.round || 0) + 1,
    });

    await ctx.db.insert("messages", {
      roomId,
      sessionId: "system",
      alias: "System",
      kind: "system",
      body: `Game started — roles are out!`,
      ts: Date.now(),
    });
  },
});

export const getMyRole = query({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.phase === "lobby") return null;

    const player = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();
    if (!player) return null;

    return {
      isImposter: player.isImposter ?? false,
      word: player.word ?? null,
      hint: player.hint ?? null,
      seat: player.seat,
      alias: player.alias,
    };
  },
});

export const advancePhase = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can continue");

    if (room.phase === "roleReveal") {
      await ctx.db.patch(roomId, { phase: "starting" });
    } else if (room.phase === "starting") {
      const players = await getPlayers(ctx, roomId);
      for (const p of players) {
        await ctx.db.patch(p._id, { votedFor: undefined, votesReceived: 0 });
      }
      await ctx.db.patch(roomId, { phase: "voting" });
    }
  },
});

export const castVote = mutation({
  args: {
    sessionId: v.string(),
    roomId: v.id("rooms"),
    targetSeat: v.number(),
  },
  handler: async (ctx, { sessionId, roomId, targetSeat }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.phase !== "voting") throw new Error("Not in the voting phase");

    const voter = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", roomId).eq("sessionId", sessionId)
      )
      .unique();
    if (!voter) throw new Error("You're not in this room");
    if (voter.votedFor !== undefined) throw new Error("You already voted");

    const players = await getPlayers(ctx, roomId);
    if (targetSeat === voter.seat) throw new Error("You can't vote for yourself");
    const target = players.find((p) => p.seat === targetSeat);
    if (!target) throw new Error("Invalid target");

    await ctx.db.patch(target._id, { votesReceived: (target.votesReceived || 0) + 1 });
    await ctx.db.patch(voter._id, { votedFor: targetSeat });

    const refreshed = await getPlayers(ctx, roomId);
    if (refreshed.every((p) => p.votedFor !== undefined)) {
      const maxVotes = Math.max(...refreshed.map((p) => p.votesReceived || 0));
      const top = refreshed.filter((p) => (p.votesReceived || 0) === maxVotes);
      const accused = top[Math.floor(Math.random() * top.length)];
      await resolveRound(ctx, roomId, accused);
    }
  },
});

export const endVoting = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.phase !== "voting") throw new Error("Not in the voting phase");
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can end voting");

    const players = await getPlayers(ctx, roomId);
    const maxVotes = Math.max(...players.map((p) => p.votesReceived || 0));
    const top = players.filter((p) => (p.votesReceived || 0) === maxVotes);
    const accused = top[Math.floor(Math.random() * top.length)];
    await resolveRound(ctx, roomId, accused);
  },
});

export const resetGame = mutation({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can reset");

    const players = await getPlayers(ctx, roomId);
    for (const p of players) {
      await ctx.db.patch(p._id, {
        isImposter: undefined,
        word: undefined,
        hint: undefined,
        votedFor: undefined,
        votesReceived: 0,
      });
    }

    await ctx.db.patch(roomId, {
      phase: "lobby",
      category: undefined,
      secretWord: undefined,
      secretHint: undefined,
      imposterSeat: undefined,
      starterSeat: undefined,
      accusedSeat: undefined,
    });
  },
});
