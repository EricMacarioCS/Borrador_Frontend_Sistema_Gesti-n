import { useMemo } from 'react'
import { create } from 'zustand'
import type { Complex, Id, Permission, ReferenceData, Session } from '@/domain/models'
import type { Services } from '@/domain/ports'
import { can as allowed, isChainAdmin } from '@/domain/rules'
import { serverNow } from '@/shared/lib/clock'
import { dateInZone, DEFAULT_TIME_ZONE, formatTime } from '@/shared/lib/datetime'

const GUEST: Session = { user: null, permissions: [], complexId: null, csrfToken: null }

interface SessionState {
  services: Services | null
  session: Session
  reference: ReferenceData | null
  /** Motivo del último cierre de sesión, para mostrarlo en la pantalla de acceso. */
  endedReason: 'expired' | 'idle' | null
  init: (services: Services, current: Session) => void
  loadReference: () => Promise<void>
  signIn: (login: string, password: string) => Promise<void>
  signOut: (reason?: 'idle' | null) => Promise<void>
  /** El servidor dijo que la sesión ya no es válida. */
  expire: () => void
}

/** Sesión del administrador y datos de referencia (complejos, catálogos). Nada de esto se guarda en el navegador. */
export const useSessionStore = create<SessionState>()((set, get) => ({
  services: null,
  session: GUEST,
  reference: null,
  endedReason: null,

  init: (services, current) => set({ services, session: current }),

  async loadReference() {
    const { services } = get()
    if (!services) return
    set({ reference: await services.reference.load() })
  },

  async signIn(login, password) {
    const { services } = get()
    if (!services) throw new Error('Servicios no inicializados')
    // La sesión se publica junto con los catálogos: el guardia redirige en cuanto hay sesión.
    const session = await services.auth.signIn(login, password)
    const reference = await services.reference.load()
    set({ session, reference, endedReason: null })
  },

  async signOut(reason = null) {
    const { services } = get()
    try {
      if (services) await services.auth.signOut()
    } finally {
      set({ session: GUEST, reference: null, endedReason: reason })
    }
  },

  expire() {
    if (get().session.user === null) return
    set({ session: GUEST, reference: null, endedReason: 'expired' })
  }
}))

/** Fecha de negocio según el reloj del servidor. */
export const today = () => dateInZone(new Date(serverNow()), DEFAULT_TIME_ZONE)
/** Hora local de los complejos según el reloj del servidor (HH:MM). */
export const nowTime = () => formatTime(new Date(serverNow()), DEFAULT_TIME_ZONE)

/** Vista de la sesión con los cálculos que usan las pantallas. */
export function useSession() {
  const state = useSessionStore()
  const { session, reference } = state
  return useMemo(() => {
    const all = reference?.complexes ?? []
    const assigned = session.complexId
    /** Complejos que este usuario puede administrar: todos, o solo el que tiene asignado. */
    const complexes: Complex[] = assigned === null ? all : all.filter(complex => complex.id === assigned)
    const complexById = (id: Id) => all.find(complex => complex.id === id)
    return {
      ...state,
      signedIn: session.user !== null,
      /** Administrador de toda la cadena (cuenta sin complejo asignado). */
      chainAdmin: isChainAdmin(session),
      complexes,
      can: (permission: Permission) => allowed(session, permission),
      complexById,
      complexName: (id: Id) => complexById(id)?.name ?? 'Complejo desconocido',
      today,
      nowTime
    }
  }, [state, session, reference])
}
