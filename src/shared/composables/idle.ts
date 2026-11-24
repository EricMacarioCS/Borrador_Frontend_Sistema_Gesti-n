import { onBeforeUnmount, onMounted } from 'vue'

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Ejecuta `onIdle` tras `minutes()` sin actividad mientras `enabled()` sea verdadero.
 * Se revisa cada 30 s comparando con la última actividad, así funciona aunque el navegador
 * pause los temporizadores de una pestaña en segundo plano.
 */
export function useIdleTimer(minutes: () => number, enabled: () => boolean, onIdle: () => void | Promise<void>) {
  let last = Date.now()
  let timer: ReturnType<typeof setInterval> | undefined
  const touch = () => { last = Date.now() }

  function check() {
    const limit = minutes()
    if (!limit || !enabled()) {
      last = Date.now()
      return
    }
    if (Date.now() - last >= limit * 60_000) {
      last = Date.now()
      void onIdle()
    }
  }

  onMounted(() => {
    EVENTS.forEach(event => window.addEventListener(event, touch, { passive: true }))
    document.addEventListener('visibilitychange', check)
    timer = setInterval(check, 30_000)
  })
  onBeforeUnmount(() => {
    EVENTS.forEach(event => window.removeEventListener(event, touch))
    document.removeEventListener('visibilitychange', check)
    clearInterval(timer)
  })
}
