import { ConvexClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

export { api }

const SESSION_KEY = 'imposter_session_id'
const ROOM_KEY = 'imposter_online_room'
const PRESENCE_INTERVAL = 5000

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = makeId()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function getSavedRoom() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_KEY))
  } catch {
    return null
  }
}

export function saveRoom(room) {
  localStorage.setItem(ROOM_KEY, JSON.stringify(room))
}

export function clearRoom() {
  localStorage.removeItem(ROOM_KEY)
}

let client = null

export function getClient() {
  if (!client) {
    client = new ConvexClient(import.meta.env.VITE_CONVEX_URL)
  }
  return client
}

export function subscribe(query, args, cb) {
  return getClient().onUpdate(query, args, cb)
}

export function call(mutation, args) {
  return getClient().mutation(mutation, args)
}

export function query(query, args) {
  return getClient().query(query, args)
}

export function getPresenceInterval() {
  return PRESENCE_INTERVAL
}
