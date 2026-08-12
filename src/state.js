import { getRandomWord } from './words.js'

let state = {
  phase: 'setup',
  players: [],
  category: 'mixed',
  secretWord: '',
  secretHint: '',
  imposterIndex: 0,
  starterIndex: 0,
  round: 0,
  roleRevealIndex: 0,
  accusedIndex: -1
}

let scores = {}

export function getAllScores() {
  return { ...scores }
}

export function addScore(name, points = 1) {
  scores[name] = (scores[name] || 0) + points
}

export function resetScores() {
  scores = {}
}

export function getState() {
  return state
}

export function initGame(playerCount, category) {
  const { word, hint } = getRandomWord(category)
  const players = Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`)
  const imposterIndex = Math.floor(Math.random() * players.length)
  const starterIndex = Math.floor(Math.random() * players.length)

  state = {
    phase: 'roleReveal',
    players,
    category,
    secretWord: word,
    secretHint: hint,
    imposterIndex,
    starterIndex,
    round: (state?.round || 0) + 1,
    roleRevealIndex: 0,
    accusedIndex: -1
  }
}

export function advanceRoleReveal() {
  if (state.roleRevealIndex < state.players.length - 1) {
    state.roleRevealIndex++
    return false
  }
  state.phase = 'starting'
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
