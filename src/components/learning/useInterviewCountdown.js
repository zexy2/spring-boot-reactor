import { useCallback, useEffect, useRef, useState } from 'react'

// Browser timers are throttled in background tabs. Count elapsed wall time,
// rather than treating each delivered interval callback as one elapsed second.
export function useInterviewCountdown(durationSeconds, onExpire) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const [running, setRunning] = useState(false)
  const deadlineRef = useRef(null)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const updateRemaining = useCallback(() => {
    if (deadlineRef.current === null) return
    const nextSeconds = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
    setSecondsLeft(nextSeconds)
    if (nextSeconds === 0) {
      deadlineRef.current = null
      setRunning(false)
      onExpireRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!running) return undefined
    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    // Update immediately when the browser resumes from a suspended tab.
    document.addEventListener('visibilitychange', updateRemaining)
    window.addEventListener('focus', updateRemaining)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateRemaining)
      window.removeEventListener('focus', updateRemaining)
    }
  }, [running, updateRemaining])

  const startCountdown = useCallback(() => {
    deadlineRef.current = Date.now() + durationSeconds * 1000
    setSecondsLeft(durationSeconds)
    setRunning(true)
  }, [durationSeconds])

  const stopCountdown = useCallback(() => {
    deadlineRef.current = null
    setRunning(false)
  }, [])

  const resetCountdown = useCallback(() => {
    deadlineRef.current = null
    setRunning(false)
    setSecondsLeft(durationSeconds)
  }, [durationSeconds])

  return { secondsLeft, running, startCountdown, stopCountdown, resetCountdown }
}
