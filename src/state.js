import { getRandomWord } from './words.js'

const STORAGE_SCORES = 'imposter_scores'

let state = {
  phase: 'setup',
  players: [],
  category: 'mixed',
  secretWord: '',
  imposterIndex: 0,
  round: 0,
  roleRevealIndex: 0,
  clueTurnIndex: 0,
  accusedIndex: -1
}

let scores = loadScores()

function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_SCORES)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveScores() {
  try {
    localStorage.setItem(STORAGE_SCORES, JSON.stringify(scores))
  } catch {}
}

export function getAllScores() {
  return { ...scores }
}

export function addScore(name, points = 1) {
  scores[name] = (scores[name] || 0) + points
  saveScores()
}

export function resetScores() {
  scores = {}
  saveScores()
}

export function getState() {
  return state
}

export function initGame(players, category) {
  const secretWord = getRandomWord(category)
  const imposterIndex = Math.floor(Math.random() * players.length)

  state = {
    phase: 'roleReveal',
    players: [...players],
    category,
    secretWord,
    imposterIndex,
    round: (state?.round || 0) + 1,
    roleRevealIndex: 0,
    clueTurnIndex: 0,
    accusedIndex: -1
  }
}

export function advanceRoleReveal() {
  if (state.roleRevealIndex < state.players.length - 1) {
    state.roleRevealIndex++
    return false
  }
  state.phase = 'cluePhase'
  state.clueTurnIndex = 0
  return true
}

export function advanceClueTurn() {
  if (state.clueTurnIndex < state.players.length - 1) {
    state.clueTurnIndex++
    return false
  }
  state.phase = 'voting'
  return true
}

export function setAccused(index) {
  state.accusedIndex = index
  state.phase = 'reveal'
}

export function getRevealResult() {
  return {
    accused: state.accusedIndex,
    imposterIndex: state.imposterIndex,
    isCorrect: state.accusedIndex === state.imposterIndex
  }
}

export function goToSetup() {
  state.phase = 'setup'
}
