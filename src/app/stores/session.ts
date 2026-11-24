import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { Complex, Id, Permission, ReferenceData, Session } from '@/domain/models'
import type { Services } from '@/domain/ports'
import { can as allowed } from '@/domain/rules'
import { serverNow } from '@/shared/lib/clock'
import { dateInZone, DEFAULT_TIME_ZONE, formatTime } from '@/shared/lib/datetime'

const GUEST: Session = { user: null, permissions: [], complexIds: null, csrfToken: null }

/** Sesión del administrador y datos de referencia (complejos, catálogos). Nada de esto se guarda en el navegador. */
export const useSessionStore = defineStore('session', () => {
  const services = shallowRef<Services | null>(null)
  const session = ref<Session>(GUEST)
  const reference = ref<ReferenceData | null>(null)
  /** Motivo del último cierre de sesión, para mostrarlo en la pantalla de acceso. */
  const endedReason = ref<'expired' | 'idle' | null>(null)

  const signedIn = computed(() => session.value.user !== null)
  const can = (permission: Permission) => allowed(session.value, permission)

  /** Complejos que este usuario puede administrar. */
  const complexes = computed<Complex[]>(() => {
    const all = reference.value?.complexes ?? []
    const scope = session.value.complexIds
    return scope === null ? all : all.filter(complex => scope.includes(complex.id))
  })
  const complexById = (id: Id) => reference.value?.complexes.find(complex => complex.id === id)
  const complexName = (id: Id) => complexById(id)?.name ?? 'Complejo desconocido'
  /** Fecha de negocio según el reloj del servidor. */
  const today = () => dateInZone(new Date(serverNow()), DEFAULT_TIME_ZONE)
  /** Hora local de los complejos según el reloj del servidor (HH:MM). */
  const nowTime = () => formatTime(new Date(serverNow()), DEFAULT_TIME_ZONE)

  function init(value: Services, current: Session) {
    services.value = value
    session.value = current
  }

  async function loadReference() {
    if (!services.value) return
    reference.value = await services.value.reference.load()
  }

  async function signIn(email: string, password: string) {
    if (!services.value) throw new Error('Servicios no inicializados')
    session.value = await services.value.auth.signIn(email, password)
    endedReason.value = null
    await loadReference()
  }

  async function signOut(reason: 'idle' | null = null) {
    try {
      if (services.value) session.value = await services.value.auth.signOut()
    } finally {
      session.value = GUEST
      reference.value = null
      endedReason.value = reason
    }
  }

  /** El servidor dijo que la sesión ya no es válida. */
  function expire() {
    if (!signedIn.value) return
    session.value = GUEST
    reference.value = null
    endedReason.value = 'expired'
  }

  return {
    services, session, reference, endedReason, signedIn, complexes,
    can, complexById, complexName, today, nowTime, init, loadReference, signIn, signOut, expire
  }
})
