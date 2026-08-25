import { useEffect, useRef, useState } from "react"

/**
 * useCountdown — second-resolution countdown timer. Used by:
 *   · LoginPage     · 429 / lockout countdown UX
 *   · ForgotPasswordPage · resend cooldown
 *
 * @returns {{ seconds:number, start:(s:number)=>void, stop:()=>void, isRunning:boolean }}
 *
 * The hook is dependency-free and self-cleans on unmount.
 */
export default function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef(null)

  function stop() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Always clear interval on unmount.
  useEffect(() => () => stop(), [])

  function tick() {
    setSeconds((prev) => {
      if (prev <= 1) {
        stop()
        return 0
      }
      return prev - 1
    })
  }

  function start(s) {
    if (typeof s !== "number" || s <= 0) return
    stop()
    setSeconds(s)
    intervalRef.current = window.setInterval(tick, 1000)
  }

  return { seconds, start, stop, isRunning: seconds > 0 }
}
