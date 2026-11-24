/**
 * Estado del simulador. Se guarda en localStorage (una "base de datos" por navegador) y se reconstruye
 * con los datos por defecto si no existe o cambió de versión. Nada de esto existe con la API real.
 */
import type { Permission } from '@/domain/models'

const KEY = 'cp-admin-mock-v2'
/** Versión anterior del estado (con pedidos e inventario). Se borra al cargar. */
const OLD_KEY = 'cp-admin-mock-v1'
const SESSION_KEY = 'cp-admin-mock-session'

export interface ComplexRec {
  id: string; version: number; name: string; slug: string; kind: string; cityId: string; address: string; postalCode: string
  openedOn: string; imageUrl: string | null; vistaId: string | null; timeZone: string
}
export interface RoomRec { id: string; version: number; complexId: string; number: number; name: string; type: string; projections: string[] }
export interface TemplateRec { version: number; rows: { label: string; seats: { column: number; kind: string }[] }[] }
export interface MovieRec {
  id: string; version: number; title: string; slug: string; rating: string; genres: string[]; durationMinutes: number; synopsis: string
  category: string; isSpecialEvent: boolean; posterUrl: string | null; bannerUrl: string | null; trailerUrl: string | null; vistaId: string | null
  cast: { name: string; role: string }[]; releaseDate: string | null; presaleFrom: string | null; lastDay: string | null
}
export interface ScreeningRec {
  id: string; version: number; movieId: string; roomId: string; date: string; startTime: string; projection: string; language: string; active: boolean
}
export interface TicketTypeRec { id: string; version: number; name: string; description: string; isPromotional: boolean; fixedPriceCents: number | null }
export interface PriceRec { roomType: string; projection: string; ticketTypeId: string; priceCents: number; onlineFeeCents: number }
export interface OptionRec { id: string; apiId: string | null; name: string; extraCents: number; isDefault: boolean }
export interface RuleRec { id: string; title: string; kind: string; min: number; max: number; allowSplit: boolean; options: OptionRec[] }
export interface ProductRec {
  id: string; version: number; apiId: string | null; name: string; description: string; imageUrl: string | null; categoryId: string
  structure: string; requiresTicketCode: boolean; rules: RuleRec[]
}
export interface CatalogRec {
  productId: string; version: number; priceCents: number; available: boolean
  options: { optionId: string; active: boolean; extraCents: number }[]
}
export interface PriceChangeRec { id: string; productId: string; previousCents: number; newCents: number; changedAt: string }
export interface PromotionRec {
  id: string; version: number; name: string; kind: string; description: string; restrictions: string; validFrom: string; validTo: string | null
  appliesToAll: boolean; complexIds: string[]; clubLevelId: string | null
  rules: { weekdays: number[]; roomTypes: string[]; projections: string[]; percent: number | null }
}
export interface ClubLevelRec { id: string; version: number; name: string; minVisits: number; maxVisits: number | null; pointsPercent: number; benefits: string }
export interface BannerRec {
  id: string; version: number; title: string; imageUrl: string; targetUrl: string; startsOn: string; endsOn: string | null
  active: boolean; appliesToAll: boolean; complexIds: string[]
}
export interface RoleRec { id: string; version: number; name: string; isManager: boolean; responsibilities: string; area: string }
export interface EmployeeRec {
  id: string; version: number; firstName: string; lastName: string; secondLastName: string | null; email: string | null; phone: string | null
  birthDate: string; hiredOn: string; salaryCents: number; status: string; complexId: string; roleId: string
}
export interface ActivityRec { id: string; at: string; actor: string; area: string; summary: string }

export interface MockState {
  v: 2
  seq: number
  seededOn: string
  sessions: Record<string, { csrf: string; userId: string | null; startedAt: number }>
  logins: Record<string, { failures: number; lockedUntil: number }>
  complexes: ComplexRec[]
  rooms: RoomRec[]
  templates: Record<string, TemplateRec>
  movies: MovieRec[]
  screenings: ScreeningRec[]
  ticketTypes: TicketTypeRec[]
  priceSheets: Record<string, { version: number; prices: PriceRec[] }>
  categories: { id: string; name: string }[]
  products: ProductRec[]
  catalogs: Record<string, CatalogRec[]>
  priceHistory: Record<string, PriceChangeRec[]>
  promotions: PromotionRec[]
  clubLevels: ClubLevelRec[]
  /** Boletos vendidos por función. Los registra el sitio web; la gestión solo los consulta para proteger la función. */
  ticketSales: Record<string, number>
  banners: BannerRec[]
  home: { version: number; featuredMovieIds: string[] }
  faq: { version: number; items: { question: string; answer: string }[] }
  pages: { slug: string; version: number; title: string; body: string }[]
  rules: { version: number; maxSeatsPerPurchase: number; holdMinutes: number; cancelMinutesBefore: number; scheduleDays: number }
  roles: RoleRec[]
  employees: EmployeeRec[]
  activity: ActivityRec[]
  idempotency: Record<string, { fingerprint: string; result: unknown }>
}

export interface MockUser { id: string; name: string; email: string; password: string; roleName: string; permissions: Permission[]; complexIds: string[] | null }

/** Memoria de respaldo si el navegador bloquea el almacenamiento (también se usa en pruebas). */
let memory: string | null = null
let memorySid: string | null = null

export function load(seed: () => MockState): MockState {
  let raw: string | null = memory
  try {
    raw = localStorage.getItem(KEY) ?? memory
    localStorage.removeItem(OLD_KEY)
  } catch { /* Sin acceso: memoria. */ }
  try {
    const parsed = raw ? JSON.parse(raw) as MockState : null
    if (parsed?.v === 2) return parsed
  } catch { /* Dato dañado: se regenera. */ }
  const fresh = seed()
  save(fresh)
  return fresh
}

export function save(state: MockState) {
  const raw = JSON.stringify(state)
  memory = raw
  try { localStorage.setItem(KEY, raw) } catch { /* Se queda en memoria. */ }
}

/** Identificador de la "cookie" de sesión del simulador, por pestaña del navegador. */
export function sessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  } catch {
    memorySid ??= crypto.randomUUID()
    return memorySid
  }
}

/** Para pruebas: borra el estado y la sesión. */
export function resetForTests() {
  memory = null
  memorySid = null
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch { /* Nada que borrar. */ }
}
