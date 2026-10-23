import { useEffect, useRef, useState } from 'react'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

export function CountUp({
  value,
  duration = 0.85,
  format,
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const reduce = usePrefersReducedMotion()
  const fromRef = useRef(reduce ? value : 0)
  const displayRef = useRef(reduce ? value : 0)
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      fromRef.current = value
      displayRef.current = value
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const to = value
    if (from === to) {
      setDisplay(to)
      displayRef.current = to
      return
    }

    let raf = 0
    const start = performance.now()
    const ms = duration * 1000

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3) // cubic ease-out
      const next = from + (to - from) * eased
      displayRef.current = next
      setDisplay(next)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = displayRef.current
    }
  }, [value, duration, reduce])

  const text = format
    ? format(display)
    : new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }).format(display)

  return <span className={className}>{text}</span>
}
