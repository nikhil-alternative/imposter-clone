import './style.css'
import { categories } from './words.js'
import {
  getState, initGame,
  advanceRoleReveal, advanceClueTurn, setAccused,
  getRevealResult, goToSetup,
  getAllScores, addScore, resetScores
} from './state.js'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

/* ---------- SETUP ---------- */
function renderSetup() {
  const html = `
    <div class="screen active" id="screen-setup">
      <div class="scroll">
        <div class="setup-header">
          <div style="font-size:24px;letter-spacing:6px;margin-bottom:4px;">👻 🔎 👀</div>
          <h1>Imposter</h1>
          <div class="subtitle">Find the ghost among us</div>
        </div>

        <div class="setup-card">
          <div class="label">👋 Players (3–6)</div>
          <div id="player-inputs" class="flex flex-col gap-8">
            <div class="flex gap-8 items-center">
              <input type="text" id="pname-0" class="grow" placeholder="Player 1" maxlength="16" autocomplete="off" />
              <button class="btn btn-sm" id="add-player" style="width:52px;padding:0;">+</button>
            </div>
            <input type="text" id="pname-1" placeholder="Player 2" maxlength="16" autocomplete="off" />
            <input type="text" id="pname-2" placeholder="Player 3" maxlength="16" autocomplete="off" />
          </div>
          <div id="player-error" class="mt-8" style="font-size:14px;display:none;color:var(--accent);font-weight:700;">
            Need at least 3 players!
          </div>
        </div>

        <div class="setup-card">
          <div class="label">📂 Category</div>
          <div id="category-chips" class="chip-group">
            <button class="chip selected" data-cat="mixed">Mixed</button>
            ${Object.keys(categories).map(c =>
              `<button class="chip" data-cat="${c}">${c}</button>`
            ).join('')}
          </div>
        </div>

        <div class="setup-card">
          <div class="how-to">
            <strong>How to Play</strong><br/>
            1. Enter names &amp; pick a category<br/>
            2. Pass the phone — each player secretly sees their role<br/>
            3. One player is the <strong style="color:var(--accent);">Imposter 👻</strong><br/>
            4. Say one word about the secret word (out loud)<br/>
            5. Discuss &amp; vote out the Imposter!
          </div>
        </div>
      </div>
      <div class="footer">
        <button class="btn btn-lg" id="btn-start">Start Game</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html
  bindSetupEvents()
}

function bindSetupEvents() {
  let playerCount = 3
  const container = $('#player-inputs')
  const addBtn = $('#add-player')
  const errEl = $('#player-error')

  function getNames() {
    const names = []
    container.querySelectorAll('input').forEach(inp => {
      const v = inp.value.trim()
      if (v) names.push(v)
    })
    return names
  }

  function validate() {
    const names = getNames()
    const valid = names.length >= 3
    errEl.style.display = valid ? 'none' : 'block'
    return valid
  }

  addBtn.addEventListener('click', () => {
    if (playerCount >= 6) return
    playerCount++
    const input = document.createElement('input')
    input.type = 'text'
    input.id = `pname-${playerCount - 1}`
    input.placeholder = `Player ${playerCount}`
    input.maxLength = 16
    input.autocomplete = 'off'
    input.addEventListener('input', validate)
    container.appendChild(input)
    if (playerCount >= 6) addBtn.style.display = 'none'
    validate()
  })

  container.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', validate)
  })

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
    if (!validate()) return
    const names = getNames()
    initGame(names, selectedCat)
    renderRoleReveal()
  })
}

/* ---------- ROLE REVEAL ---------- */
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
            <div class="role-hint">
              ${isImposter
                ? `The word is about <strong>${s.category}</strong>. Blend in! 👻`
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
      renderCluePhase()
    } else {
      renderRoleReveal()
    }
  })
}

/* ---------- CLUE PHASE ---------- */
function renderCluePhase() {
  const s = getState()
  const player = s.players[s.clueTurnIndex]
  const allDone = s.phase !== 'cluePhase'

  const html = `
    <div class="screen active" id="screen-cluePhase">
      ${!allDone ? `
        <div class="clue-scene">
          <div class="clue-icon">🔎</div>
          <div class="clue-player-name">${player}</div>
          <div class="clue-prompt">
            Say <strong>one word</strong> related to the secret word
          </div>
          <div style="font-size:14px;color:rgba(255,255,255,0.4);font-weight:600;margin-top:8px;">
            Player ${s.clueTurnIndex + 1} of ${s.players.length}
          </div>
          <button class="btn btn-lg mt-16" id="btn-next-clue" style="max-width:280px;">
            Done! Next →
          </button>
        </div>
      ` : `
        <div class="clue-scene">
          <div class="clue-done">
            <div class="clue-done-icon">🗣️</div>
            <div class="clue-done-text">All clues given</div>
            <p style="color:rgba(255,255,255,0.5);font-size:16px;font-weight:600;max-width:260px;line-height:1.5;">
              Discuss who sounds suspicious, then vote!
            </p>
          </div>
          <button class="btn btn-lg" id="btn-go-vote" style="max-width:280px;">
            🎯 Vote Now
          </button>
        </div>
      `}
    </div>
  `
  $('#app').innerHTML = html
  bindCluePhase()
}

function bindCluePhase() {
  const s = getState()
  const allDone = s.phase !== 'cluePhase'

  if (!allDone) {
    $('#btn-next-clue').addEventListener('click', () => {
      advanceClueTurn()
      renderCluePhase()
    })
  } else {
    $('#btn-go-vote').addEventListener('click', () => {
      renderVoting()
    })
  }
}

/* ---------- VOTING ---------- */
function renderVoting() {
  const s = getState()

  const html = `
    <div class="screen active" id="screen-voting">
      <div class="vote-scene">
        <div class="vote-title">🎯 Who got voted out?</div>
        <div class="vote-sub">Tap the name you're accusing</div>
        <div class="vote-grid">
          ${s.players.map((p, i) => `
            <button class="vote-btn" data-target="${i}">
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

/* ---------- REVEAL ---------- */
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
        <div class="reveal-card">
          <div class="reveal-label">👻 The Imposter</div>
          <div class="reveal-value imposter">${imposterName}</div>
        </div>

        <div class="reveal-card">
          <div class="reveal-label">🔑 Secret Word</div>
          <div class="reveal-value word">${s.secretWord}</div>
        </div>

        <div class="reveal-card">
          <div class="reveal-verdict win">${verdictIcon} ${verdictText}</div>
          <div class="mt-8" style="font-size:15px;color:var(--text-dim);font-weight:600;">
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
  const s = getState()
  const scores = getAllScores()
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const medals = ['🥇', '🥈', '🥉']

  const html = `
    <div class="screen active" id="screen-scoreboard">
      <div class="scroll">
        <div class="sb-header">
          <h1>Scores</h1>
        </div>

        ${sorted.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:rgba(255,255,255,0.4);font-size:18px;font-weight:700;">
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
        <button class="btn btn-outline" id="btn-reset-scores">Reset Scores</button>
      </div>
    </div>
  `
  $('#app').innerHTML = html

  $('#btn-play-again-sb').addEventListener('click', () => {
    goToSetup()
    renderSetup()
  })

  $('#btn-reset-scores').addEventListener('click', () => {
    resetScores()
    renderScoreboard()
  })
}

renderSetup()
