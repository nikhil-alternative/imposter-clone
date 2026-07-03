import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js'

const SENT_KEY = 'imposter_analytics_sent'

;(async function sendVisit() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SENT_KEY)) return

  try {
    const geoRes = await fetch('https://ip-api.com/json/', { signal: AbortSignal.timeout(5000) })
    const geo = await geoRes.json()

    const body = {
      ip: geo.query || null,
      country: geo.country || null,
      city: geo.city || null,
      isp: geo.isp || null,
      user_agent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language
    }

    const res = await fetch(`${SUPABASE_URL}/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(body)
    })

    if (res.ok || res.status === 201) {
      localStorage.setItem(SENT_KEY, '1')
    }
  } catch {
    // fail silently — never block the game
  }
})()
