import { onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirmAction } from './feedback'

/**
 * Para páginas que se guardan con un botón (tarifas, contenido): avisa antes de salir con cambios sin guardar,
 * ya sea navegando dentro del sistema o cerrando la pestaña.
 */
export function useDirtyGuard(isDirty: () => boolean) {
  onBeforeRouteLeave(async () => {
    if (!isDirty()) return true
    return confirmAction({ title: 'Hay cambios sin guardar', text: 'Si sales ahora se perderán.', confirmLabel: 'Salir sin guardar', danger: true })
  })
  const beforeUnload = (event: BeforeUnloadEvent) => { if (isDirty()) event.preventDefault() }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
}
