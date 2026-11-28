import { useEffect, useRef } from 'react'

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Ejecuta `onIdle` tras `minutes` sin actividad mientras `enabled` sea verdadero.
 * Se revisa cada 30 s comparando con la última actividad, así funciona aunque el navegador
 * pause los temporizadores de una pestaña en segundo plano.
 */
export function useIdleTimer(minutes: number, enabled: boolean, onIdle: () => void | Promise<void>) {
  const settings = useRef({ minutes, enabled, onIdle })
  useEffect(() => { settings.current = { minutes, enabled, onIdle } })

  useEffect(() => {
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const check = () => {
      const { minutes: limit, enabled: active, onIdle: run } = settings.current
      if (!limit || !active) {
        last = Date.now()
        return
      }
      if (Date.now() - last >= limit * 60_000) {
        last = Date.now()
        void run()
      }
    }
    EVENTS.forEach(event => window.addEventListener(event, touch, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, 30_000)
    return () => {
      EVENTS.forEach(event => window.removeEventListener(event, touch))
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [])
}
