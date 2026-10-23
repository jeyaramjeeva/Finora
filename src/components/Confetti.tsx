import { useEffect, useRef } from 'react'

export function triggerConfetti() {
  window.dispatchEvent(new CustomEvent('cashmetry-confetti'))
}

export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let animationId: number
    let particles: Array<{
      x: number
      y: number
      w: number
      h: number
      color: string
      vx: number
      vy: number
      rotation: number
      vRot: number
      opacity: number
    }> = []

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

    function spawn() {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      particles = Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 50,
        w: 6 + Math.random() * 8,
        h: 6 + Math.random() * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 5,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
      }))

      render()
    }

    function render() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = 0

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.vRot
        p.opacity -= 0.007

        if (p.opacity > 0 && p.y < canvas.height + 20) {
          alive++
          ctx.save()
          ctx.globalAlpha = Math.max(0, p.opacity)
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          ctx.restore()
        }
      }

      if (alive > 0) {
        animationId = requestAnimationFrame(render)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    const onConfetti = () => spawn()
    window.addEventListener('cashmetry-confetti', onConfetti)
    return () => {
      window.removeEventListener('cashmetry-confetti', onConfetti)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  )
}
