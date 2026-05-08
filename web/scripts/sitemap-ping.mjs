import { setTimeout as wait } from "node:timers/promises"

const SITE_URL = (process.env.VITE_SITE_URL || "https://mustaphaukizuru.com").replace(/\/$/, "")
const SITEMAP  = `${SITE_URL}/sitemap.xml`
const ENDPOINTS = [
  `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`,
  `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`,
]

async function pingOne(url) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      console.log(`  ${res.status}  ${url}`)
    } finally { clearTimeout(timer) }
  } catch (err) {
    console.warn(`  ERR  ${url}  ${err.message}`)
  }
}

;(async () => {
  console.log(`[seo:ping] ${SITEMAP}`)
  for (const u of ENDPOINTS) { await pingOne(u); await wait(250) }
})()
