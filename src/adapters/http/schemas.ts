/**
 * Contrato JSON del API de gestión (`/api/admin/v1`). Es la referencia para backend: camelCase,
 * IDs como texto, dinero en centavos, instantes ISO 8601 con zona y fechas de negocio AAAA-MM-DD.
 * El simulador produce exactamente estas formas, así que ambos modos usan los mismos conversores.
 */
import { z } from 'zod'
import { isInstant, isIsoDate } from '@/shared/lib/datetime'

export const MoneyDto = z.object({ amount: z.number().int(), currency: z.literal('MXN') })
export const LabeledDto = z.object({ code: z.string(), name: z.string() })
const Instant = z.string().refine(isInstant, 'Se esperaba un instante ISO 8601 con zona horaria')
const BusinessDate = z.string().refine(isIsoDate, 'Se esperaba una fecha AAAA-MM-DD')
const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Se esperaba una hora HH:MM')
const Version = z.number().int().min(0)

export const ListOf = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) })

/* Sesión */

export const SessionDto = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string(), roleName: z.string() }).nullable(),
  permissions: z.array(z.string()),
  complexIds: z.array(z.string()).nullable(),
  csrfToken: z.string().nullable()
})

/* Datos de referencia */

export const ComplexDto = z.object({
  id: z.string(), version: Version, name: z.string(), slug: z.string(), kind: z.string(),
  cityId: z.string(), cityName: z.string(), address: z.string(), postalCode: z.string(), openedOn: BusinessDate,
  imageUrl: z.string().nullable(), vistaId: z.string().nullable(), timeZone: z.string(),
  roomCount: z.number().int().min(0), seatCount: z.number().int().min(0)
})

export const ReferenceDto = z.object({
  serverNow: Instant,
  cities: z.array(z.object({ id: z.string(), name: z.string() })),
  complexes: z.array(ComplexDto),
  roomTypes: z.array(LabeledDto),
  projections: z.array(LabeledDto),
  languages: z.array(LabeledDto),
  ratings: z.array(z.object({ code: z.string(), description: z.string() })),
  genres: z.array(z.string()),
  limits: z.object({ maxScreeningsPerBatch: z.number().int().positive(), cleaningMinutes: z.number().int().min(0) })
})

export const RoomDto = z.object({
  id: z.string(), version: Version, complexId: z.string(), number: z.number().int().positive(), name: z.string(),
  type: LabeledDto, projections: z.array(LabeledDto), capacity: z.number().int().min(0)
})

export const SeatTemplateDto = z.object({
  roomId: z.string(), version: Version,
  rows: z.array(z.object({
    label: z.string().min(1),
    seats: z.array(z.object({ column: z.number().int().positive(), kind: z.string() }))
  }))
})

/* Películas y funciones */

export const MovieDto = z.object({
  id: z.string(), version: Version, title: z.string(), slug: z.string(), rating: z.string(),
  genres: z.array(z.string()), durationMinutes: z.number().int().positive(), synopsis: z.string(), category: z.string(),
  isSpecialEvent: z.boolean(),
  media: z.object({ posterUrl: z.string().nullable(), bannerUrl: z.string().nullable(), trailerUrl: z.string().nullable() }),
  vistaId: z.string().nullable(),
  cast: z.array(z.object({ name: z.string(), role: z.string() })),
  releaseDate: BusinessDate.nullable(), presaleFrom: BusinessDate.nullable(), lastDay: BusinessDate.nullable(),
  upcomingScreenings: z.number().int().min(0)
})

export const ScreeningDto = z.object({
  id: z.string(), version: Version, movieId: z.string(), movieTitle: z.string(), complexId: z.string(),
  room: z.object({ id: z.string(), number: z.number().int().positive(), type: LabeledDto }),
  projection: LabeledDto, language: LabeledDto,
  date: BusinessDate, startTime: LocalTime, endTime: LocalTime, endsNextDay: z.boolean(),
  isPresale: z.boolean(), active: z.boolean(), ticketsSold: z.number().int().min(0)
})

export const SchedulePlanDto = z.object({
  tooMany: z.boolean(),
  rows: z.array(z.object({
    key: z.string(), movieId: z.string(), movieTitle: z.string(), complexId: z.string(),
    room: z.object({ id: z.string(), number: z.number().int().positive() }).nullable(),
    roomType: LabeledDto, projection: LabeledDto, language: LabeledDto,
    date: BusinessDate, startTime: LocalTime, endTime: LocalTime, endsNextDay: z.boolean(),
    problem: z.string().nullable()
  }))
})

/* Dulcería */

export const ProductDto = z.object({
  id: z.string(), version: Version, apiId: z.string().nullable(), name: z.string(), description: z.string(),
  imageUrl: z.string().nullable(), category: z.object({ id: z.string(), name: z.string() }), structure: z.string(),
  requiresTicketCode: z.boolean(),
  rules: z.array(z.object({
    id: z.string(), title: z.string(), kind: z.string(), min: z.number().int().min(0), max: z.number().int().min(1),
    allowSplit: z.boolean(),
    options: z.array(z.object({ id: z.string(), apiId: z.string().nullable(), name: z.string(), extra: MoneyDto, isDefault: z.boolean() }))
  })),
  complexCount: z.number().int().min(0)
})

export const CatalogEntryDto = z.object({
  complexId: z.string(), version: Version, product: ProductDto, price: MoneyDto, available: z.boolean(),
  optionSettings: z.array(z.object({ optionId: z.string(), active: z.boolean(), extra: MoneyDto })),
  stock: z.number().min(0).nullable()
})

export const PriceChangeDto = z.object({
  id: z.string(), productName: z.string(), previous: MoneyDto, current: MoneyDto, changedAt: Instant
})

export const StockMovementDto = z.object({
  id: z.string(), productName: z.string(), before: z.number(), after: z.number(), reason: z.string(),
  note: z.string(), author: z.string(), at: Instant
})

/* Tarifas y promociones */

export const TicketTypeDto = z.object({
  id: z.string(), version: Version, name: z.string(), description: z.string(), isPromotional: z.boolean(),
  fixedPrice: MoneyDto.nullable()
})

export const PriceSheetDto = z.object({
  complexId: z.string(), version: Version,
  prices: z.array(z.object({
    roomType: z.string(), projection: z.string(), ticketTypeId: z.string(), price: MoneyDto, onlineFee: MoneyDto
  }))
})

export const PromotionDto = z.object({
  id: z.string(), version: Version, name: z.string(), kind: z.string(), description: z.string(), restrictions: z.string(),
  validFrom: BusinessDate, validTo: BusinessDate.nullable(), appliesToAll: z.boolean(), complexIds: z.array(z.string()),
  clubLevelId: z.string().nullable(),
  rules: z.object({
    weekdays: z.array(z.number().int().min(0).max(6)), roomTypes: z.array(z.string()), projections: z.array(z.string()),
    percent: z.number().min(0).max(100).nullable()
  })
})

export const ClubLevelDto = z.object({
  id: z.string(), version: Version, name: z.string(), minVisits: z.number().int().min(0),
  maxVisits: z.number().int().min(0).nullable(), pointsPercent: z.number().min(0), benefits: z.string()
})

/* Pedidos */

export const OrderSummaryDto = z.object({
  id: z.string(), ticketCode: z.string().nullable(), linkedTicketCode: z.string().nullable(), kind: z.string(),
  status: z.string(), foodStatus: z.string().nullable(), channel: z.string(),
  complex: z.object({ id: z.string(), name: z.string() }),
  customer: z.object({ name: z.string(), email: z.string() }),
  createdAt: Instant, total: MoneyDto
})

export const OrderPageDto = z.object({
  items: z.array(OrderSummaryDto), total: z.number().int().min(0), page: z.number().int().min(1), pageSize: z.number().int().min(1)
})

export const OrderDetailDto = OrderSummaryDto.extend({
  screening: z.object({
    movieTitle: z.string(), date: BusinessDate, startTime: LocalTime, room: z.string(), projection: z.string(), language: z.string()
  }).nullable(),
  tickets: z.array(z.object({ seat: z.string(), ticketType: z.string(), price: MoneyDto })),
  items: z.array(z.object({ name: z.string(), detail: z.string(), quantity: z.number().int().positive(), total: MoneyDto })),
  pickup: z.enum(['before', 'during']).nullable(),
  paymentMethod: z.string(),
  totals: z.object({ subtotal: MoneyDto, discount: MoneyDto, serviceFee: MoneyDto, total: MoneyDto }),
  promotionName: z.string().nullable(),
  cancellation: z.object({ allowed: z.boolean(), reason: z.string().nullable(), affectedIds: z.array(z.string()) }),
  refund: z.object({ status: z.string(), amount: MoneyDto }),
  cancelReason: z.string().nullable(),
  linkedOrders: z.array(z.object({ id: z.string(), ticketCode: z.string().nullable(), kind: z.string(), status: z.string() }))
})

/* Contenido */

export const BannerDto = z.object({
  id: z.string(), version: Version, title: z.string(), imageUrl: z.string(), targetUrl: z.string(),
  startsOn: BusinessDate, endsOn: BusinessDate.nullable(), active: z.boolean(), appliesToAll: z.boolean(), complexIds: z.array(z.string())
})
export const HomeDto = z.object({ version: Version, featuredMovieIds: z.array(z.string()) })
export const FaqDto = z.object({ version: Version, items: z.array(z.object({ question: z.string(), answer: z.string() })) })
export const PageDto = z.object({ slug: z.string(), version: Version, title: z.string(), body: z.string() })
export const PurchaseRulesDto = z.object({
  version: Version, maxSeatsPerPurchase: z.number().int().positive(), holdMinutes: z.number().int().positive(),
  cancelMinutesBefore: z.number().int().min(0), scheduleDays: z.number().int().positive()
})

/* Empleados, reportes y actividad */

export const RoleDto = z.object({
  id: z.string(), version: Version, name: z.string(), isManager: z.boolean(), responsibilities: z.string(), area: z.string()
})

export const EmployeeDto = z.object({
  id: z.string(), version: Version, firstName: z.string(), lastName: z.string(), secondLastName: z.string().nullable(),
  email: z.string().nullable(), phone: z.string().nullable(), birthDate: BusinessDate, hiredOn: BusinessDate,
  salary: MoneyDto, status: z.string(), complexId: z.string(), roleId: z.string()
})

export const DailySalesDto = z.object({
  date: BusinessDate, complexId: z.string(), tickets: MoneyDto, food: MoneyDto, other: MoneyDto,
  ticketCount: z.number().int().min(0), transactions: z.number().int().min(0)
})

export const ActivityDto = z.object({ id: z.string(), at: Instant, actor: z.string(), area: z.string(), summary: z.string() })

export type MoneyJson = z.input<typeof MoneyDto>
export type SessionJson = z.input<typeof SessionDto>
export type ReferenceJson = z.input<typeof ReferenceDto>
export type ComplexJson = z.input<typeof ComplexDto>
export type RoomJson = z.input<typeof RoomDto>
export type SeatTemplateJson = z.input<typeof SeatTemplateDto>
export type MovieJson = z.input<typeof MovieDto>
export type ScreeningJson = z.input<typeof ScreeningDto>
export type SchedulePlanJson = z.input<typeof SchedulePlanDto>
export type ProductJson = z.input<typeof ProductDto>
export type CatalogEntryJson = z.input<typeof CatalogEntryDto>
export type PriceChangeJson = z.input<typeof PriceChangeDto>
export type StockMovementJson = z.input<typeof StockMovementDto>
export type TicketTypeJson = z.input<typeof TicketTypeDto>
export type PriceSheetJson = z.input<typeof PriceSheetDto>
export type PromotionJson = z.input<typeof PromotionDto>
export type ClubLevelJson = z.input<typeof ClubLevelDto>
export type OrderSummaryJson = z.input<typeof OrderSummaryDto>
export type OrderDetailJson = z.input<typeof OrderDetailDto>
export type BannerJson = z.input<typeof BannerDto>
export type HomeJson = z.input<typeof HomeDto>
export type FaqJson = z.input<typeof FaqDto>
export type PageJson = z.input<typeof PageDto>
export type PurchaseRulesJson = z.input<typeof PurchaseRulesDto>
export type RoleJson = z.input<typeof RoleDto>
export type EmployeeJson = z.input<typeof EmployeeDto>
export type DailySalesJson = z.input<typeof DailySalesDto>
export type ActivityJson = z.input<typeof ActivityDto>
