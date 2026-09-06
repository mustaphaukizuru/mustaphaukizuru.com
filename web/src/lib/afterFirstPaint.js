/**
 * afterFirstPaint · run work well after the page has rendered, never during.
 *
 * requestIdleCallback ALONE is not enough, and a trace explains why: while
 * the app is waiting on network the main thread is idle, so rIC fires almost
 * immediately — measured at ~500 ms, still 800 ms before the nav rendered.
 * An idle main thread is not the same as a finished page.
 *
 * So the load event gates it first, and idle only schedules within that. The
 * setTimeout covers Safari < 16.4, which has no requestIdleCallback.
 *
 * Extracted from i18n/index.js when T3-6 needed the same thing for the Web
 * Vitals collector — the first-paint budget test does not care why a byte was
 * fetched, only whether it was fetched before the page appeared, and a second
 * hand-rolled copy of this is a second chance to get the ordering wrong.
 *
 * @param {() => void} fn
 */
export default function afterFirstPaint(fn) {
  if (typeof window === "undefined") return
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 10000 })
    else window.setTimeout(fn, 1000)
  }
  const afterLoad = () => window.setTimeout(schedule, 1500)
  if (document.readyState === "complete") afterLoad()
  else window.addEventListener("load", afterLoad, { once: true })
}
