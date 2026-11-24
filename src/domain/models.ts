/**
 * Modelo del sistema de gestión. Sigue las tablas de la base de datos (ver docs/mapeo-bd.md),
 * pero es independiente del JSON del backend: los adaptadores convierten hacia este modelo.
 * Los catálogos abiertos (tipo de sala, proyección, idioma) llegan como código y nombre.
 */
import type { Cents } from '@/shared/lib/money'

export type Id = string

export interface Labeled {
  code: string
  name: string
}

/** Concurrencia optimista: el servidor rechaza un cambio hecho sobre una versión vieja. */
export interface Versioned {
  version: number
}

/* Sesión y permisos */

export type Permission =
  | 'dashboard.view'
  | 'movies.manage' | 'screenings.manage' | 'products.manage' | 'content.manage'
  | 'prices.manage' | 'promotions.manage'
  | 'complexes.manage' | 'employees.manage' | 'settings.view'

export interface AdminUser {
  id: Id
  name: string
  email: string
  roleName: string
}

export interface Session {
  user: AdminUser | null
  permissions: Permission[]
  /** Complejos que puede administrar. `null`: toda la cadena. */
  complexIds: Id[] | null
  csrfToken: string | null
}

/* Datos de referencia que se cargan al iniciar */

export interface City {
  id: Id
  name: string
}

export interface Complex extends Versioned {
  id: Id
  name: string
  slug: string
  /** En la base de datos, la versión VIP de una plaza es un complejo distinto. */
  kind: 'traditional' | 'vip'
  cityId: Id
  cityName: string
  address: string
  postalCode: string
  openedOn: string
  imageUrl: string | null
  /** Identificador en Vista. Nulo si se dio de alta a mano. */
  vistaId: string | null
  timeZone: string
  roomCount: number
  seatCount: number
}

export interface Rating {
  code: string
  description: string
}

export interface Limits {
  /** Funciones por lote en el asistente. */
  maxScreeningsPerBatch: number
  cleaningMinutes: number
}

export interface ReferenceData {
  serverNow: string
  cities: City[]
  complexes: Complex[]
  /** Tipos de sala (infraestructura): Tradicional, VIP, IMAX, Macro XE, 4DX, Junior. */
  roomTypes: Labeled[]
  /** Proyecciones: 2D y 3D (`formato_sala` con `es_proyeccion`). */
  projections: Labeled[]
  languages: Labeled[]
  ratings: Rating[]
  genres: string[]
  limits: Limits
}

/* Salas y asientos */

export type SeatKind = 'standard' | 'accessible' | 'companion' | 'premium'

export interface Room extends Versioned {
  id: Id
  complexId: Id
  number: number
  name: string
  /** Tipo estructural, fijo: define el plano de asientos. */
  type: Labeled
  /** Proyecciones que admite (`sala_formato_sala`). */
  projections: Labeled[]
  capacity: number
}

export interface SeatTemplateRow {
  label: string
  /** Las columnas que faltan son pasillos o huecos. */
  seats: { column: number; kind: SeatKind }[]
}

export interface SeatTemplate extends Versioned {
  roomId: Id
  rows: SeatTemplateRow[]
}

/* Películas */

export type MovieStage = 'coming-soon' | 'presale' | 'premiere' | 'now-showing' | 'finished'

export interface CastMember {
  name: string
  role: 'director' | 'actor'
}

export interface Movie extends Versioned {
  id: Id
  title: string
  slug: string
  rating: string
  genres: string[]
  durationMinutes: number
  synopsis: string
  /** "Garantía Cinépolis" habilita la reclamación de satisfacción. */
  category: string
  isSpecialEvent: boolean
  posterUrl: string | null
  bannerUrl: string | null
  trailerUrl: string | null
  vistaId: string | null
  cast: CastMember[]
  /** Fechas de cartelera. Requieren columnas nuevas en `pelicula` (ver docs). */
  releaseDate: string | null
  presaleFrom: string | null
  lastDay: string | null
  /** Funciones vigentes: impiden retirarla o cambiar su duración. */
  upcomingScreenings: number
}

export type MovieInput = Omit<Movie, 'id' | 'version' | 'upcomingScreenings'>

/* Funciones */

export interface Screening extends Versioned {
  id: Id
  movieId: Id
  movieTitle: string
  complexId: Id
  roomId: Id
  roomNumber: number
  roomType: Labeled
  projection: Labeled
  language: Labeled
  /** Fecha y hora locales del complejo, como en `funcion`. */
  date: string
  startTime: string
  endTime: string
  /** La función termina después de la medianoche. */
  endsNextDay: boolean
  isPresale: boolean
  active: boolean
  /** Ya tiene boletos vendidos: no se mueve, no se desactiva y no se retira. */
  hasTicketsSold: boolean
}

export interface ScreeningUpdate {
  version: number
  roomId: Id
  date: string
  startTime: string
  projection: string
  language: string
  active: boolean
}

export interface ScheduleRequest {
  movieIds: Id[]
  languages: string[]
  complexIds: Id[]
  roomTypes: string[]
  projections: string[]
  /** Salas elegidas a mano. Si un tipo de sala no tiene ninguna, el servidor asigna una libre. */
  roomIds: Id[]
  dates: string[]
  times: string[]
}

export interface SchedulePlanRow {
  key: string
  movieId: Id
  movieTitle: string
  complexId: Id
  roomId: Id | null
  roomNumber: number | null
  roomType: Labeled
  projection: Labeled
  language: Labeled
  date: string
  startTime: string
  endTime: string
  endsNextDay: boolean
  /** Motivo por el que no se puede crear. */
  problem: string | null
}

export interface SchedulePlan {
  rows: SchedulePlanRow[]
  tooMany: boolean
}

/* Dulcería */

export type ProductStructure = 'simple' | 'compound' | 'combo'
export type ModifierKind = 'size' | 'flavor' | 'extra' | 'choice'

export interface ModifierOption {
  id: Id
  /** Identificador en la API de Vista. */
  apiId: string | null
  name: string
  extraCents: Cents
  isDefault: boolean
}

export interface ModifierRule {
  id: Id
  title: string
  kind: ModifierKind
  min: number
  max: number
  /** Permite repartir la porción entre opciones (mitad y mitad). Requiere columna nueva. */
  allowSplit: boolean
  options: ModifierOption[]
}

export interface ProductCategory {
  id: Id
  name: string
}

/** Producto de la cadena (`producto_dulceria`). Precio y disponibilidad son de cada complejo. */
export interface Product extends Versioned {
  id: Id
  apiId: string | null
  name: string
  description: string
  imageUrl: string | null
  category: ProductCategory
  structure: ProductStructure
  /** Exige folio de boletos vigente en la compra en línea. Requiere columna nueva. */
  requiresTicketCode: boolean
  rules: ModifierRule[]
  /** Complejos que lo tienen en su catálogo. */
  complexCount: number
}

export type ProductInput = Omit<Product, 'id' | 'version' | 'category' | 'complexCount'> & { categoryId: Id }

export interface OptionSetting {
  optionId: Id
  active: boolean
  extraCents: Cents
}

/**
 * Producto en el catálogo de un complejo (`detalle_catalogo` y `disponibilidad_modificador`).
 * No hay inventario: el personal marca a mano si el producto está disponible.
 */
export interface CatalogEntry extends Versioned {
  complexId: Id
  product: Product
  priceCents: Cents
  available: boolean
  optionSettings: OptionSetting[]
}

export interface CatalogEntryInput {
  version: number | null
  priceCents: Cents
  available: boolean
  optionSettings: OptionSetting[]
}

export interface PriceChange {
  id: Id
  productName: string
  previousCents: Cents
  newCents: Cents
  changedAt: Date
}

/* Tarifas */

export interface TicketType extends Versioned {
  id: Id
  name: string
  description: string
  isPromotional: boolean
  /** Precio fijo en todos los complejos (por ejemplo, Fiesta Cinépolis). */
  fixedPriceCents: Cents | null
}

/** Un precio explícito (`precio_boleto`): complejo + tipo de sala + proyección + tipo de boleto. */
export interface TicketPrice {
  roomType: string
  projection: string
  ticketTypeId: Id
  priceCents: Cents
  onlineFeeCents: Cents
}

export interface PriceSheet extends Versioned {
  complexId: Id
  prices: TicketPrice[]
}

/* Promociones */

export type PromotionKind = '2x1' | 'percent' | 'double-points' | 'informative'

export interface Promotion extends Versioned {
  id: Id
  name: string
  kind: PromotionKind | (string & {})
  description: string
  /** Texto libre de la BD (`restricciones`). */
  restrictions: string
  validFrom: string
  validTo: string | null
  appliesToAll: boolean
  complexIds: Id[]
  /** Promoción del Club para un nivel. */
  clubLevelId: Id | null
  /** Reglas que se evalúan solas. Requieren columnas nuevas. */
  rules: { weekdays: number[]; roomTypes: string[]; projections: string[]; percent: number | null }
}

export type PromotionInput = Omit<Promotion, 'id' | 'version'>

/* Contenido del sitio */

export interface Banner extends Versioned {
  id: Id
  title: string
  imageUrl: string
  targetUrl: string
  startsOn: string
  endsOn: string | null
  active: boolean
  appliesToAll: boolean
  complexIds: Id[]
}

export type BannerInput = Omit<Banner, 'id' | 'version'>

export interface FaqItem {
  question: string
  answer: string
}

export interface InfoPage extends Versioned {
  slug: string
  title: string
  body: string
}

export interface HomeContent extends Versioned {
  featuredMovieIds: Id[]
}

export interface FaqContent extends Versioned {
  items: FaqItem[]
}

export interface PurchaseRules extends Versioned {
  maxSeatsPerPurchase: number
  holdMinutes: number
  cancelMinutesBefore: number
  scheduleDays: number
}

export interface ClubLevel extends Versioned {
  id: Id
  name: string
  minVisits: number
  maxVisits: number | null
  pointsPercent: number
  benefits: string
}

/* Empleados */

export interface Role extends Versioned {
  id: Id
  name: string
  isManager: boolean
  responsibilities: string
  area: string
}

export type EmployeeStatus = 'active' | 'leave' | 'inactive'

export interface Employee extends Versioned {
  id: Id
  firstName: string
  lastName: string
  secondLastName: string | null
  email: string | null
  phone: string | null
  birthDate: string
  hiredOn: string
  salaryCents: Cents
  status: EmployeeStatus
  complexId: Id
  roleId: Id
}

export type EmployeeInput = Omit<Employee, 'id' | 'version'>

/* Bitácora */

export interface Activity {
  id: Id
  at: Date
  actor: string
  area: string
  summary: string
}
