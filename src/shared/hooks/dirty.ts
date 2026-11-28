import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { confirmAction } from './feedback'

/**
 * Para páginas que se guardan con un botón (tarifas, contenido): avisa antes de salir con cambios sin guardar,
 * ya sea navegando dentro del sistema o cerrando la pestaña.
 */
export function useDirtyGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void confirmAction({ title: 'Hay cambios sin guardar', text: 'Si sales ahora se perderán.', confirmLabel: 'Salir sin guardar', danger: true })
      .then(leave => leave ? blocker.proceed() : blocker.reset())
  }, [blocker])

  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
}
