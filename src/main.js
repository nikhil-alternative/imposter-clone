import '@fontsource/fredoka/latin-400.css'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-700.css'
import './style.css'
import './analytics.js'
import { categories } from './words.js'
import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js'
import {
  getState, initGame,
  advanceRoleReveal, setAccused,
  getRevealResult, goToSetup,
  getAllScores, addScore, resetScores
} from './state.js'
import * as rt from './realtime.js'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

const CATEGORY_EMOJI = {
  mixed: '🎲',
  Animals: '🐾',
  'Food & Drink': '🍕',
  Countries: '🌍',
  Movies: '🎬',
  Sports: '⚽',
  Hobbies: '🎨',
  Objects: '🧸',
  Nature: '🌿',
  'Famous People': '⭐'
}

const VOTE_COLORS = ['#ff5c8a', '#00c2a8', '#ff9f43', '#8f6bff', '#4f9dff', '#ff6b4a', '#00b8d4', '#e84393', '#00b894', '#d63031']

const CHAT_EMOJIS = ['😂', '😅', '🙈', '🤡', '👻', '😈', '😱', '🤫', '😤', '🥶', '🔥', '💀', '👍', '👏', '🤔', '😬', '😍', '🎉', '🍕', '🏆', '❓', '❤️']

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function errMsg(err) {
  return err?.message || 'Something went wrong'
}

/* ---------- ONLINE HELPERS ---------- */

let online = null
let subs = []
let chatMessages = []
let chatOpen = false
let chatUnread = 0
let chatSeenAt = null
let chatSeenInit = false
let heartbeatTimer = null
let wakeSentinel = null

function cleanup() {
  subs.forEach((un) => {
    try { un() } catch {}
  })
  subs = []
}

function subscribe(query, args, cb) {
  const un = rt.subscribe(query, args, cb)
  subs.push(un)
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    if (wakeSentinel) return
    wakeSentinel = await navigator.wakeLock.request('screen')
    wakeSentinel.addEventListener('release', () => {
      wakeSentinel = null
    })
  } catch {}
}

function releaseWakeLock() {
  if (wakeSentinel) {
    try { wakeSentinel.release() } catch {}
    wakeSentinel = null
  }
}

function startHeartbeat() {
  stopHeartbeat()
  const beat = () => {
    if (!online) return
    rt.call(rt.api.presence.heartbeat, {
      sessionId: rt.getSessionId(),
      roomId: online.roomId,
      alias: online.alias
    }).catch(() => {})
  }
  beat()
  heartbeatTimer = setInterval(beat, rt.getPresenceInterval())
  requestWakeLock()
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

document.addEventListener('visibilitychange', () => {
  if (!online) return
  if (document.visibilityState === 'visible') {
    requestWakeLock()
    rt.call(rt.api.presence.heartbeat, {
      sessionId: rt.getSessionId(),
      roomId: online.roomId,
      alias: online.alias
    }).catch(() => {})
  } else {
    rt.call(rt.api.presence.heartbeat, {
      sessionId: rt.getSessionId(),
      roomId: online.roomId,
      alias: online.alias
    }).catch(() => {})
  }
})

function mySeatOf(state) {
  const me = state.players.find((p) => p.sessionId === rt.getSessionId())
  return me ? me.seat : null
}

function startOnlineRoom() {
  cleanup()
  closeChat()
  chatUnread = 0
  chatSeenAt = null
  chatSeenInit = false
  const args = { sessionId: rt.getSessionId(), roomId: online.roomId }
  let lastPhase = null

  subscribe(rt.api.rooms.getRoomState, args, (state) => {
    if (!state) {
      rt.clearRoom()
      stopHeartbeat()
      releaseWakeLock()
      cleanup()
      renderOnlineMenu()
      return
    }
    if (state.phase !== lastPhase) {
      lastPhase = state.phase
      renderOnlinePhase(state)
    } else {
      updateOnlinePhase(state)
    }
  })

  subscribe(rt.api.chat.listMessages, args, (msgs) => {
    chatMessages = msgs || []
    renderChatMessages()
    if (!chatSeenInit) {
      chatSeenInit = true
      const last = chatMessages[chatMessages.length - 1]
      chatSeenAt = last ? last.ts : Date.now()
    } else if (chatOpen) {
      chatUnread = 0
      chatSeenAt = Date.now()
    } else {
      const me = rt.getSessionId()
      chatUnread = chatMessages.filter((m) => m.ts > chatSeenAt && m.sessionId !== me && m.kind !== 'system').length
    }
    updateChatBadge()
  })

  startHeartbeat()
}

function renderOnlinePhase(state) {
  const byPhase = {
    lobby: renderOnlineLobby,
    roleReveal: renderOnlineRoleReveal,
    starting: renderOnlineStarting,
    voting: renderOnlineVoting,
    reveal: renderOnlineReveal
  }
  const fn = byPhase[state.phase] || renderOnlineLobby
  fn(state)
}

function updateOnlinePhase(state) {
  if (state.phase === 'lobby') updateLobbyState(state)
  else if (state.phase === 'voting') updateVoting(state)
}

/* ---------- HOME ---------- */

function renderHome() {
  const saved = rt.getSavedRoom()
  const html = `
    <div class="screen active" id="screen-home">
      <div class="setup-header">
        <div style="font-size:24px;letter-spacing:6px;margin-bottom:2px;">👻 🔎 👀</div>
        <h1>Imposter</h1>
        <div class="subtitle">Find the ghost among us</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;max-width:360px;margin:0 auto;width:100%;">
        <button class="btn btn-lg btn-teal" id="btn-offline">
          📱 Play Offline
          <span class="btn-sub">One phone · pass &amp; play</span>
        </button>
        <button class="btn btn-lg btn-purple" id="btn-online">
          🌐 Play Online
          <span class="btn-sub">${saved ? `Rejoin room ${saved.code}` : 'Create or join a room'}</span>
        </button>
      </div>
      <div class="footer">
        <div class="home-foot">3–10 players · find the imposter!</div>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $('#btn-offline').addEventListener('click', () => {
    goToSetup()
    renderSetup()
  })

  $('#btn-online').addEventListener('click', () => {
    const savedRoom = rt.getSavedRoom()
    if (savedRoom && savedRoom.code && savedRoom.roomId) {
      rt.call(rt.api.rooms.joinRoom, {
        sessionId: savedRoom.sessionId || rt.getSessionId(),
        alias: savedRoom.alias || 'Player',
        code: savedRoom.code
      }).then((res) => {
        online = { sessionId: rt.getSessionId(), alias: savedRoom.alias, code: res.code, roomId: res.roomId }
        rt.saveRoom(online)
        startOnlineRoom()
      }).catch(() => {
        rt.clearRoom()
        renderOnlineMenu()
      })
    } else {
      renderOnlineMenu()
    }
  })
}

/* ---------- ONLINE MENU (create / join) ---------- */

function renderOnlineMenu() {
  const html = `
    <div class="screen active" id="screen-online-menu">
      <div class="online-head">
        <button class="back-btn" id="btn-back-home">←</button>
        <div>
          <h1 style="font-size:26px;margin:0;">Play Online</h1>
          <div class="subtitle">Play with friends on their own phones</div>
        </div>
      </div>

      <div class="tab-row">
        <button class="tab active" data-tab="create">Create Room</button>
        <button class="tab" data-tab="join">Join Room</button>
      </div>

      <div class="online-card" id="form-create">
        <div class="label">Your alias</div>
        <input class="text-input" id="inp-create-alias" maxlength="16" placeholder="e.g. Ghost" autocomplete="off" />
        <label class="pass-toggle">
          <input type="checkbox" id="chk-create-pass" /> 🔒 Protect with a password
        </label>
        <input class="text-input hidden" id="inp-create-pass" type="password" maxlength="20" placeholder="Room password" />
        <div class="err" id="err-create"></div>
        <button class="btn btn-lg" id="btn-create">Create Room</button>
      </div>

      <div class="online-card hidden" id="form-join">
        <div class="label">Room code</div>
        <input class="text-input code-input" id="inp-join-code" maxlength="5" placeholder="GHOST" autocomplete="off" />
        <div class="label">Your alias</div>
        <input class="text-input" id="inp-join-alias" maxlength="16" placeholder="e.g. Ghost" autocomplete="off" />
        <div class="label">Password <span class="opt">(optional)</span></div>
        <input class="text-input" id="inp-join-pass" type="password" maxlength="20" placeholder="••••" />
        <div class="err" id="err-join"></div>
        <button class="btn btn-lg" id="btn-join">Join Room</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $('#btn-back-home').addEventListener('click', renderHome)

  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')
      const isCreate = tab.dataset.tab === 'create'
      $('#form-create').classList.toggle('hidden', !isCreate)
      $('#form-join').classList.toggle('hidden', isCreate)
    })
  })

  $('#chk-create-pass').addEventListener('change', (e) => {
    $('#inp-create-pass').classList.toggle('hidden', !e.target.checked)
  })

  $('#btn-create').addEventListener('click', async () => {
    const alias = $('#inp-create-alias').value.trim()
    if (!alias) { $('#err-create').textContent = 'Enter an alias' ; return }
    const usePass = $('#chk-create-pass').checked
    const password = usePass ? $('#inp-create-pass').value.trim() : ''
    if (usePass && !password) { $('#err-create').textContent = 'Enter a password' ; return }
    $('#err-create').textContent = ''
    $('#btn-create').disabled = true
    try {
      const res = await rt.call(rt.api.rooms.createRoom, {
        sessionId: rt.getSessionId(),
        alias,
        password: password || undefined
      })
      online = { sessionId: rt.getSessionId(), alias, code: res.code, roomId: res.roomId }
      rt.saveRoom(online)
      startOnlineRoom()
    } catch (e) {
      $('#err-create').textContent = errMsg(e)
      $('#btn-create').disabled = false
    }
  })

  $('#btn-join').addEventListener('click', async () => {
    const code = $('#inp-join-code').value.trim()
    const alias = $('#inp-join-alias').value.trim()
    const password = $('#inp-join-pass').value.trim()
    if (!code) { $('#err-join').textContent = 'Enter a room code' ; return }
    if (!alias) { $('#err-join').textContent = 'Enter an alias' ; return }
    $('#err-join').textContent = ''
    $('#btn-join').disabled = true
    try {
      const res = await rt.call(rt.api.rooms.joinRoom, {
        sessionId: rt.getSessionId(),
        alias,
        code,
        password: password || undefined
      })
      online = { sessionId: rt.getSessionId(), alias, code: res.code, roomId: res.roomId }
      rt.saveRoom(online)
      startOnlineRoom()
    } catch (e) {
      $('#err-join').textContent = errMsg(e)
      $('#btn-join').disabled = false
    }
  })

  $('#inp-join-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  })
}

/* ---------- ONLINE LOBBY ---------- */

function renderOnlineLobby(state) {
  const isHost = state.hostSessionId === rt.getSessionId()
  $('#app').innerHTML = `
    <div class="screen active" id="screen-online-lobby">
      <div class="lobby-top">
        <div class="lobby-code-label">ROOM CODE</div>
        <div class="lobby-code">${online.code}</div>
        <div class="lobby-share">
          <button class="btn btn-sm btn-teal" id="btn-copy">Copy Code</button>
        </div>
      </div>
      <div class="online-count" id="online-count"></div>
      <div class="setup-card lobby-card">
        <div class="label">Players</div>
        <div class="player-list" id="player-list"></div>
      </div>
      <div class="setup-card" id="host-controls">
        <div class="label">📂 Category</div>
        <div class="chip-group" id="category-chips"></div>
        <button class="btn btn-lg mt-8" id="btn-start-game">Start Game</button>
        <div class="start-hint" id="start-hint"></div>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-chat">💬 Chat</button>
        <button class="btn btn-outline" id="btn-leave">Leave Room</button>
      </div>
    </div>
  `

  if (!isHost) $('#host-controls').style.display = 'none'

  const chipsEl = $('#category-chips')
  chipsEl.innerHTML = `<button class="chip selected" data-cat="mixed">🎲 Mixed</button>` +
    Object.keys(categories).map((c) =>
      `<button class="chip" data-cat="${c}">${CATEGORY_EMOJI[c] || '🎴'} ${c}</button>`
    ).join('')
  let selectedCat = 'mixed'
  chipsEl.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chipsEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'))
      chip.classList.add('selected')
      selectedCat = chip.dataset.cat
    })
  })

  $('#btn-start-game').addEventListener('click', async () => {
    $('#btn-start-game').disabled = true
    try {
      await rt.call(rt.api.game.startGame, {
        sessionId: rt.getSessionId(),
        roomId: online.roomId,
        category: selectedCat
      })
    } catch (e) {
      $('#btn-start-game').disabled = false
      $('#start-hint').textContent = errMsg(e)
    }
  })

  $('#btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(online.code)
      $('#btn-copy').textContent = 'Copied ✓'
      setTimeout(() => { $('#btn-copy').textContent = 'Copy Code' }, 1500)
    } catch {
      $('#btn-copy').textContent = 'Code: ' + online.code
    }
  })

  $('#btn-chat').addEventListener('click', openChat)
  $('#btn-leave').addEventListener('click', leaveRoom)

  updateChatBadge()
  updateLobbyState(state)
}

function updateLobbyState(state) {
  const list = $('#player-list')
  if (!list) return

  const onlineCount = state.players.filter((p) => p.online).length
  const countEl = $('#online-count')
  if (countEl) {
    countEl.innerHTML = `👥 <strong>${onlineCount}</strong> online · ${state.players.length} in room ${state.hasPassword ? '· 🔒' : ''}`
  }

  list.innerHTML = state.players.map((p) => `
    <div class="player-row ${p.online ? '' : 'offline'}">
      <span class="presence-dot ${p.online ? 'on' : 'off'}"></span>
      <span class="palias">${escapeHtml(p.alias)}${p.sessionId === rt.getSessionId() ? ' <span class="you-tag">you</span>' : ''}</span>
      ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
      <span class="pscore">⭐ ${p.score}</span>
    </div>
  `).join('')

  const startBtn = $('#btn-start-game')
  if (startBtn) {
    const canStart = state.players.length >= 3
    startBtn.disabled = !canStart
    $('#start-hint').textContent = canStart ? '' : 'Need at least 3 players'
  }
}

/* ---------- ONLINE ROLE REVEAL ---------- */

function renderOnlineRoleReveal(state) {
  const me = state.players.find((p) => p.sessionId === rt.getSessionId())
  const isHost = state.hostSessionId === rt.getSessionId()

  $('#app').innerHTML = `
    <div class="screen active" id="screen-role">
      <div class="role-scene">
        <div class="role-avatar">👀</div>
        <div class="role-player-name">${escapeHtml(me?.alias || '')}</div>
        <div class="role-player-num">Your secret · seat #${me?.seat || '?'}</div>

        <div id="role-area" style="width:100%;display:flex;flex-direction:column;align-items:center;">
          <button class="btn btn-lg role-reveal-btn" id="btn-reveal-role">👀 See My Word</button>
          <div class="role-loading" id="role-loading">
            <div class="dots"><span>🔍</span><span>🔍</span><span>🔍</span></div>
            <div class="role-loading-text">Revealing your role...</div>
          </div>
          <div class="role-word-wrap" id="role-word-wrap"></div>
        </div>

        <div id="host-advance-area" style="width:100%;display:flex;flex-direction:column;align-items:center;margin-top:20px;">
          <button class="btn btn-lg" id="btn-advance" style="max-width:300px;">🎤 Reveal Who Starts</button>
          <div class="role-waiting" id="role-waiting">Waiting for the host to continue...</div>
        </div>
      </div>
    </div>
  `

  const revealBtn = $('#btn-reveal-role')
  const loading = $('#role-loading')
  const wordWrap = $('#role-word-wrap')

  let revealed = false
  revealBtn.addEventListener('click', async () => {
    if (revealed) return
    revealBtn.style.display = 'none'
    loading.classList.add('active')
    let role = null
    try {
      role = await rt.query(rt.api.game.getMyRole, { sessionId: rt.getSessionId(), roomId: online.roomId })
    } catch {
      role = null
    }
    setTimeout(() => {
      loading.classList.remove('active')
      if (!role) {
        wordWrap.classList.add('active')
        wordWrap.innerHTML = `<div class="role-word">—</div>`
        return
      }
      revealed = true
      wordWrap.classList.add('active')
      wordWrap.innerHTML = role.isImposter
        ? `
          <div class="role-word imposter">IMPOSTER</div>
          <div class="role-hint role-hint-imposter">Hint: <strong>${escapeHtml(role.hint || '')}</strong> — blend in! 👻</div>
        `
        : `
          <div class="role-word crew">${escapeHtml(role.word || '')}</div>
          <div class="role-hint">Keep the word secret! 👀</div>
        `
      if (isHost) {
        $('#btn-advance').style.display = 'flex'
      }
    }, 1500)
  })

  $('#btn-advance').style.display = 'none'
  if (isHost) {
    $('#role-waiting').style.display = 'none'
    $('#btn-advance').addEventListener('click', () => {
      rt.call(rt.api.game.advancePhase, { sessionId: rt.getSessionId(), roomId: online.roomId })
        .catch((e) => alert(errMsg(e)))
    })
  } else {
    $('#role-waiting').style.display = ''
  }
}

/* ---------- ONLINE WHO STARTS ---------- */

function renderOnlineStarting(state) {
  const isHost = state.hostSessionId === rt.getSessionId()
  const starter = state.players.find((p) => p.seat === state.startingSeat)

  $('#app').innerHTML = `
    <div class="screen active" id="screen-starting">
      <div class="starting-scene">
        <div class="starting-icon">🎤</div>
        <div class="starting-name">${escapeHtml(starter?.alias || '?')} starts!</div>
        <div class="starting-sub">Discuss in chat or out loud, then vote out the imposter</div>
        <button class="btn btn-lg mt-16" id="btn-start-vote" style="max-width:280px;">🎯 Start Voting</button>
        <div class="role-waiting" id="role-waiting">Waiting for the host to start voting...</div>
        <button class="btn btn-outline btn-sm mt-16" id="btn-recheck" style="width:auto;">🔍 Re-check my role</button>
        <div id="recheck-area" class="recheck-area"></div>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-chat">💬 Chat</button>
      </div>
    </div>
  `

  if (isHost) {
    $('#role-waiting').style.display = 'none'
    $('#btn-start-vote').addEventListener('click', () => {
      rt.call(rt.api.game.advancePhase, { sessionId: rt.getSessionId(), roomId: online.roomId })
        .catch((e) => alert(errMsg(e)))
    })
  } else {
    $('#btn-start-vote').style.display = 'none'
  }

  $('#btn-recheck').addEventListener('click', async () => {
    const area = $('#recheck-area')
    try {
      const role = await rt.query(rt.api.game.getMyRole, { sessionId: rt.getSessionId(), roomId: online.roomId })
      area.innerHTML = role?.isImposter
        ? `<div class="recheck-card"><div class="role-word imposter" style="font-size:32px;">IMPOSTER</div><div class="role-hint role-hint-imposter" style="font-size:22px;">Hint: <strong>${escapeHtml(role.hint || '')}</strong></div></div>`
        : `<div class="recheck-card"><div class="role-word crew" style="font-size:32px;">${escapeHtml(role?.word || '')}</div><div class="role-hint">Keep the word secret! 👀</div></div>`
    } catch {
      area.innerHTML = `<div class="role-hint">Couldn't load your role — try again.</div>`
    }
  })

  $('#btn-chat').addEventListener('click', openChat)
  updateChatBadge()
}

/* ---------- ONLINE VOTING ---------- */

function renderOnlineVoting(state) {
  $('#app').innerHTML = `
    <div class="screen active" id="screen-voting">
      <div class="vote-scene">
        <div class="vote-title">🎯 Who's the imposter?</div>
        <div class="vote-sub" id="vote-sub">Vote secretly on your own phone</div>
        <div class="vote-grid" id="vote-grid"></div>
        <div class="vote-progress" id="vote-progress"></div>
        <button class="btn btn-lg mt-8" id="btn-end-vote" style="display:none;">📣 Reveal Results</button>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-chat">💬 Chat</button>
      </div>
    </div>
  `

  if (state.hostSessionId === rt.getSessionId()) {
    $('#btn-end-vote').style.display = 'flex'
    $('#btn-end-vote').addEventListener('click', () => {
      rt.call(rt.api.game.endVoting, { sessionId: rt.getSessionId(), roomId: online.roomId })
        .catch((e) => alert(errMsg(e)))
    })
  }

  $('#btn-chat').addEventListener('click', openChat)
  updateChatBadge()
  updateVoting(state)
}

function updateVoting(state) {
  const grid = $('#vote-grid')
  if (!grid) return

  const mySeat = mySeatOf(state)
  const me = state.players.find((p) => p.seat === mySeat)
  const voted = !!me?.hasVoted

  grid.innerHTML = state.players
    .filter((p) => p.seat !== mySeat)
    .map((p) => `
      <button class="vote-btn ${voted ? 'voted' : ''}" data-target="${p.seat}" style="background:${VOTE_COLORS[(p.seat - 1) % VOTE_COLORS.length]};">
        <span class="vnum">${voted ? '✓' : '#' + p.seat}</span>
        <span>${escapeHtml(p.alias)}</span>
      </button>
    `).join('')

  const progress = state.players.filter((p) => p.hasVoted).length
  const progEl = $('#vote-progress')
  if (progEl) progEl.textContent = voted ? '✓ You voted — waiting for others...' : `Votes: ${progress}/${state.players.length}`

  grid.querySelectorAll('.vote-btn').forEach((btn) => {
    if (voted) return
    btn.addEventListener('click', async () => {
      const target = parseInt(btn.dataset.target)
      try {
        await rt.call(rt.api.game.castVote, {
          sessionId: rt.getSessionId(),
          roomId: online.roomId,
          targetSeat: target
        })
      } catch (e) {
        const sub = $('#vote-sub')
        if (sub) sub.textContent = errMsg(e)
      }
    })
  })
}

/* ---------- ONLINE REVEAL ---------- */

function renderOnlineReveal(state) {
  const r = state.reveal
  const isHost = state.hostSessionId === rt.getSessionId()
  const imposter = state.players.find((p) => p.seat === r.imposterSeat)
  const accused = state.players.find((p) => p.seat === r.accusedSeat)
  const isCorrect = r.imposterSeat === r.accusedSeat

  $('#app').innerHTML = `
    <div class="screen active" id="screen-reveal">
      <div class="reveal-scene">
        <div class="reveal-card imposter-card">
          <div class="reveal-label">👻 The Imposter</div>
          <div class="reveal-value imposter">${escapeHtml(imposter?.alias || '?')}</div>
        </div>
        <div class="reveal-card word-card">
          <div class="reveal-label">🔑 Secret Word</div>
          <div class="reveal-value word">${escapeHtml(r.secretWord)}</div>
        </div>
        <div class="reveal-card verdict-card">
          <div class="reveal-verdict win">${isCorrect ? '👀 Crew Wins!' : '👻 Imposter Wins!'}</div>
          <div class="mt-8" style="font-size:15px;color:var(--ink-soft);font-weight:600;">
            ${isCorrect
              ? `${escapeHtml(accused?.alias || '')} was voted out!`
              : `${escapeHtml(accused?.alias || '')} was wrong — the Imposter got away!`}
          </div>
        </div>
        <div class="reveal-players">
          ${state.players.map((p) => `
            <div class="reveal-player ${p.seat === r.imposterSeat ? 'is-imposter' : ''}">
              <div class="pname">${escapeHtml(p.alias)}</div>
              <div class="ptag">${p.seat === r.imposterSeat ? '👻 Imposter' : '👀 Crew'} · ${p.votesReceived} vote${p.votesReceived === 1 ? '' : 's'} · ⭐ ${p.score}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="footer">
        ${isHost
          ? '<button class="btn btn-lg" id="btn-play-again">Play Again</button>'
          : '<div class="role-waiting" style="text-align:center;">Waiting for the host to start a new round...</div>'}
        <button class="btn btn-outline" id="btn-chat-reveal">💬 Chat</button>
      </div>
    </div>
  `

  if (isHost) {
    $('#btn-play-again').addEventListener('click', () => {
      rt.call(rt.api.game.resetGame, { sessionId: rt.getSessionId(), roomId: online.roomId })
        .catch((e) => alert(errMsg(e)))
    })
  }
  $('#btn-chat-reveal').addEventListener('click', openChat)
  updateChatBadge()
}

/* ---------- CHAT ---------- */

function updateChatBadge() {
  const btn = document.querySelector('#btn-chat, #btn-chat-reveal')
  if (!btn) return
  let badge = btn.querySelector('.chat-badge')
  if (chatUnread > 0) {
    if (!badge) {
      badge = document.createElement('span')
      badge.className = 'chat-badge'
      btn.appendChild(badge)
    }
    badge.textContent = chatUnread > 99 ? '99+' : String(chatUnread)
  } else if (badge) {
    badge.remove()
  }
}

function openChat() {
  if (chatOpen) return
  chatOpen = true
  chatUnread = 0
  chatSeenAt = Date.now()
  updateChatBadge()
  const wrap = document.createElement('div')
  wrap.id = 'chat-overlay'
  wrap.className = 'chat-overlay'
  wrap.innerHTML = `
    <div class="chat-sheet">
      <div class="chat-head">
        <span>💬 Room Chat</span>
        <button class="chat-close" id="chat-close">✕</button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="emoji-row" id="emoji-row"></div>
      <div class="chat-input-row">
        <input class="chat-input" id="chat-input" maxlength="200" placeholder="Type a message..." autocomplete="off" />
        <button class="chat-send" id="chat-send">➤</button>
      </div>
    </div>
  `
  document.body.appendChild(wrap)

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeChat()
  })
  $('#chat-close').addEventListener('click', closeChat)
  $('#chat-send').addEventListener('click', sendChatText)
  $('#chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatText()
  })

  $('#emoji-row').innerHTML = CHAT_EMOJIS
    .map((e) => `<button class="emoji-btn">${e}</button>`)
    .join('')
  $('#emoji-row').querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      rt.call(rt.api.chat.sendMessage, {
        sessionId: rt.getSessionId(),
        roomId: online.roomId,
        kind: 'emoji',
        body: btn.textContent
      }).catch(() => {})
    })
  })

  renderChatMessages()
}

function closeChat() {
  const el = document.getElementById('chat-overlay')
  if (el) el.remove()
  chatOpen = false
}

function sendChatText() {
  const input = $('#chat-input')
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  rt.call(rt.api.chat.sendMessage, {
    sessionId: rt.getSessionId(),
    roomId: online.roomId,
    kind: 'text',
    body: text
  }).catch(() => {})
}

function renderChatMessages() {
  if (!chatOpen) return
  const el = document.getElementById('chat-messages')
  if (!el) return
  const mySession = rt.getSessionId()
  el.innerHTML = chatMessages.map((m) => {
    if (m.kind === 'system') {
      return `<div class="chat-system">${escapeHtml(m.body)}</div>`
    }
    if (m.kind === 'emoji') {
      const mine = m.sessionId === mySession
      return `
        <div class="chat-emoji ${mine ? 'mine' : ''}">
          <span class="ce-sender">${escapeHtml(m.alias)}</span>
          <span class="ce-emoji">${m.body}</span>
        </div>`
    }
    const mine = m.sessionId === mySession
    return `
      <div class="chat-msg ${mine ? 'mine' : ''}">
        <span class="cm-sender">${escapeHtml(m.alias)}</span>
        <span class="cm-body">${escapeHtml(m.body)}</span>
      </div>`
  }).join('')
  el.scrollTop = el.scrollHeight
}

function leaveRoom() {
  if (!online) return
  rt.call(rt.api.rooms.leaveRoom, {
    sessionId: rt.getSessionId(),
    roomId: online.roomId
  }).catch(() => {})
  rt.call(rt.api.presence.goOffline, {
    sessionId: rt.getSessionId(),
    roomId: online.roomId
  }).catch(() => {})
  rt.clearRoom()
  stopHeartbeat()
  releaseWakeLock()
  cleanup()
  closeChat()
  online = null
  renderOnlineMenu()
}

/* ---------- SETUP (offline) ---------- */
function renderSetup() {
  const html = `
    <div class="screen active" id="screen-setup">
      <div class="setup-header">
        <button class="back-btn" id="btn-back-home">←</button>
        <div style="font-size:24px;letter-spacing:6px;margin-bottom:2px;">👻 🔎 👀</div>
        <h1>Imposter</h1>
        <div class="subtitle">Offline · pass the phone</div>
      </div>

        <div class="setup-card">
          <div class="label">👋 Players (3–10)</div>
          <div class="stepper">
            <button class="stepper-btn" id="btn-dec">−</button>
            <div class="stepper-value" id="player-count">3</div>
            <button class="stepper-btn" id="btn-inc">+</button>
          </div>
        </div>

        <div class="setup-card">
          <div class="label">📂 Category</div>
          <div id="category-chips" class="chip-group">
            <button class="chip selected" data-cat="mixed">${CATEGORY_EMOJI.mixed} Mixed</button>
            ${Object.keys(categories).map(c =>
              `<button class="chip" data-cat="${c}">${CATEGORY_EMOJI[c] || '🎴'} ${c}</button>`
            ).join('')}
          </div>
        </div>

        <div class="setup-card">
          <div class="how-to">
            <strong>How to Play</strong><br/>
            1. Set the player count &amp; pick a category<br/>
            2. Pass the phone — each player secretly sees their role<br/>
            3. One player is the <strong style="color:var(--pink);">Imposter 👻</strong><br/>
            4. Discuss &amp; vote out the Imposter!
          </div>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-start">Start Game</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $('#btn-back-home').addEventListener('click', renderHome)
  bindSetupEvents()
}

function bindSetupEvents() {
  let playerCount = 3
  const countEl = $('#player-count')
  const decBtn = $('#btn-dec')
  const incBtn = $('#btn-inc')

  function renderCount() {
    countEl.textContent = playerCount
    decBtn.disabled = playerCount <= 3
    incBtn.disabled = playerCount >= 10
  }

  decBtn.addEventListener('click', () => {
    if (playerCount <= 3) return
    playerCount--
    renderCount()
  })

  incBtn.addEventListener('click', () => {
    if (playerCount >= 10) return
    playerCount++
    renderCount()
  })

  renderCount()

  let selectedCat = 'mixed'
  const chips = $$('#category-chips .chip')
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('selected'))
      chip.classList.add('selected')
      selectedCat = chip.dataset.cat
    })
  })

  $('#btn-start').addEventListener('click', () => {
    initGame(playerCount, selectedCat)
    renderRoleReveal()
  })
}

/* ---------- ROLE REVEAL (offline) ---------- */
function renderRoleReveal() {
  const s = getState()
  const idx = s.roleRevealIndex
  const name = s.players[idx]
  const isImposter = idx === s.imposterIndex

  const avatar = isImposter ? '👻' : '👀'

  const html = `
    <div class="screen active" id="screen-roleReveal">
      <div class="role-scene">
        <div class="role-avatar">${avatar}</div>
        <div class="role-player-num">Player ${idx + 1} of ${s.players.length}</div>
        <div class="role-player-name">${name}</div>

        <div id="role-reveal-area" style="width:100%;display:flex;flex-direction:column;align-items:center;">
          <button class="btn btn-lg role-reveal-btn" id="btn-reveal-role">
            👀 See My Word
          </button>

          <div class="role-loading" id="role-loading">
            <div class="dots">
              <span>🔍</span><span>🔍</span><span>🔍</span>
            </div>
            <div class="role-loading-text">Revealing your role...</div>
          </div>

          <div class="role-word-wrap" id="role-word-wrap">
            <div class="role-word ${isImposter ? 'imposter' : 'crew'}">
              ${isImposter ? 'IMPOSTER' : s.secretWord}
            </div>
            <div class="role-hint ${isImposter ? 'role-hint-imposter' : ''}">
              ${isImposter
                ? `Hint: <strong>${s.secretHint}</strong> — blend in! 👻`
                : 'Keep the word secret! 👀'
              }
            </div>
            <button class="btn btn-lg mt-8" id="btn-pass" style="width:100%;">
              Got it! Pass →
            </button>
          </div>
        </div>
      </div>
    </div>
  `
  $('#app').innerHTML = html
  bindRoleReveal()
}

function bindRoleReveal() {
  const revealBtn = $('#btn-reveal-role')
  const loading = $('#role-loading')
  const wordWrap = $('#role-word-wrap')
  const passBtn = $('#btn-pass')

  revealBtn.addEventListener('click', () => {
    revealBtn.style.display = 'none'
    loading.classList.add('active')

    setTimeout(() => {
      loading.classList.remove('active')
      wordWrap.classList.add('active')
      wordWrap.style.animation = 'none'
      void wordWrap.offsetHeight
      wordWrap.style.animation = ''
    }, 1500)
  })

  passBtn.addEventListener('click', () => {
    const done = advanceRoleReveal()
    if (done) {
      renderStarting()
    } else {
      renderRoleReveal()
    }
  })
}

/* ---------- WHO STARTS (offline) ---------- */
function renderStarting() {
  const s = getState()
  const starter = s.players[s.starterIndex]

  const html = `
    <div class="screen active" id="screen-starting">
      <div class="starting-scene">
        <div class="starting-icon">🎤</div>
        <div class="starting-name">${starter} starts!</div>
        <div class="starting-sub">Pass the phone to ${starter} to begin the discussion</div>
        <button class="btn btn-lg mt-16" id="btn-start-vote" style="max-width:280px;">
          🎯 Start Voting
        </button>
      </div>
    </div>
  `
  $('#app').innerHTML = html
  $('#btn-start-vote').addEventListener('click', renderVoting)
}

/* ---------- VOTING (offline) ---------- */
function renderVoting() {
  const s = getState()

  const html = `
    <div class="screen active" id="screen-voting">
      <div class="vote-scene">
        <div class="vote-title">🎯 Who got voted out?</div>
        <div class="vote-sub">Tap the name you're accusing</div>
        <div class="vote-grid">
          ${s.players.map((p, i) => `
            <button class="vote-btn" data-target="${i}" style="background:${VOTE_COLORS[i % VOTE_COLORS.length]};">
              <span class="vnum">#${i + 1}</span>
              <span>${p}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $$('.vote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.target)
      setAccused(target)
      renderReveal()
    })
  })
}

/* ---------- REVEAL (offline) ---------- */
function renderReveal() {
  const s = getState()
  const result = getRevealResult()
  const imposterName = s.players[result.imposterIndex]
  const accusedName = s.players[result.accused]

  if (result.isCorrect) {
    s.players.forEach((p, i) => {
      if (i !== s.imposterIndex) addScore(p)
    })
  } else {
    addScore(imposterName)
  }

  const verdictIcon = result.isCorrect ? '👀' : '👻'
  const verdictText = result.isCorrect ? 'Crew Wins!' : 'Imposter Wins!'

  const html = `
    <div class="screen active" id="screen-reveal">
      <div class="reveal-scene">
        <div class="reveal-card imposter-card">
          <div class="reveal-label">👻 The Imposter</div>
          <div class="reveal-value imposter">${imposterName}</div>
        </div>

        <div class="reveal-card word-card">
          <div class="reveal-label">🔑 Secret Word</div>
          <div class="reveal-value word">${s.secretWord}</div>
        </div>

        <div class="reveal-card verdict-card">
          <div class="reveal-verdict win">${verdictIcon} ${verdictText}</div>
          <div class="mt-8" style="font-size:15px;color:var(--ink-soft);font-weight:600;">
            ${result.isCorrect
              ? `${accusedName} was voted out!`
              : `${accusedName} was wrong — the Imposter got away!`
            }
          </div>
        </div>

        <div class="reveal-players">
          ${s.players.map((p, i) => `
            <div class="reveal-player ${i === s.imposterIndex ? 'is-imposter' : ''}">
              <div class="pname">${p}</div>
              <div class="ptag">
                ${i === s.imposterIndex ? '👻 Imposter' : '👀 Crew'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-play-again">Play Again</button>
        <button class="btn btn-outline" id="btn-scores">Scores</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $('#btn-play-again').addEventListener('click', () => {
    goToSetup()
    renderSetup()
  })

  $('#btn-scores').addEventListener('click', renderScoreboard)
}

/* ---------- SCOREBOARD ---------- */
function renderScoreboard() {
  const scores = getAllScores()
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const medals = ['🥇', '🥈', '🥉']

  const html = `
    <div class="screen active" id="screen-scoreboard">
      <div class="scroll">
        <div class="sb-header">
          <button class="back-btn" id="btn-back-reveal">←</button>
          <h1>Scores</h1>
        </div>

        ${sorted.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--ink-soft);font-size:18px;font-weight:700;">
            No scores yet. Play a round!
          </div>
        ` : `
          <div class="sb-list">
            ${sorted.map(([name, points], i) => `
              <div class="sb-row">
                <span class="rank">${medals[i] || `#${i + 1}`}</span>
                <span class="sname">${name}</span>
                <span class="spoints">${points}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-play-again-sb">Play Again</button>
        <button class="btn btn-outline" id="btn-stats">Stats</button>
        <button class="btn btn-outline" id="btn-reset-scores">Reset Scores</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $('#btn-back-reveal').addEventListener('click', renderReveal)

  $('#btn-play-again-sb').addEventListener('click', () => {
    goToSetup()
    renderSetup()
  })

  $('#btn-stats').addEventListener('click', renderStats)

  $('#btn-reset-scores').addEventListener('click', () => {
    resetScores()
    renderScoreboard()
  })
}

/* ---------- STATS ---------- */
async function renderStats() {
  let total = '...'
  let error = false

  try {
    const res = await fetch(`${SUPABASE_URL}/visits?select=id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    })
    const data = await res.json()
    total = data.length || 0
  } catch {
    error = true
  }

  const html = `
    <div class="screen active" id="screen-stats">
      <div class="sb-header">
        <button class="back-btn" id="btn-back-sb">←</button>
        <h1>Stats</h1>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <div style="font-size:56px;margin-bottom:12px;">📊</div>
        <div style="font-size:18px;color:var(--ink-soft);font-weight:600;">Total visits</div>
        <div style="font-size:48px;font-weight:700;color:var(--ink);margin-top:4px;">
          ${error ? '—' : total}
        </div>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-back-sb-2">Back</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html
  $('#btn-back-sb').addEventListener('click', renderScoreboard)
  $('#btn-back-sb-2').addEventListener('click', renderScoreboard)
}

window.addEventListener('pagehide', () => {
  releaseWakeLock()
  if (online) {
    rt.call(rt.api.presence.goOffline, {
      sessionId: rt.getSessionId(),
      roomId: online.roomId
    }).catch(() => {})
  }
})

renderHome()
