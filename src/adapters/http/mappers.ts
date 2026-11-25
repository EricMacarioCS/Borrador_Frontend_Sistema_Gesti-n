/**
 * Único lugar que conoce el JSON. Si backend renombra o anida un campo, solo cambia este archivo
 * y su esquema; las vistas no se enteran. Toda respuesta se valida antes de convertirse.
 */
import type { z } from 'zod'
import { ApiError } from '@/shared/lib/errors'
import { parseInstant } from '@/shared/lib/datetime'
import type * as M from '@/domain/models'
import type * as S from './schemas'

/** Valida y lanza un error claro si el backend envía otra forma. */
export function parse<T extends z.ZodType>(schema: T, value: unknown, what: string): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    console.error(`Respuesta inesperada en ${what}`, result.error.issues)
    throw new ApiError({ status: 200, code: 'MALFORMED_RESPONSE', detail: what })
  }
  return result.data
}

type Out<T extends z.ZodType> = z.output<T>

export const cents = (money: Out<typeof S.MoneyDto>) => money.amount
export const money = (amount: number): S.MoneyJson => ({ amount, currency: 'MXN' })

/** Un valor nuevo del backend no rompe la interfaz: cae en un valor seguro y queda registrado. */
export function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T, field: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  console.warn(`Valor desconocido en ${field}: ${value}`)
  return fallback
}

const PERMISSIONS: readonly M.Permission[] = [
  'dashboard.view', 'movies.manage', 'screenings.manage', 'products.manage', 'content.manage', 'prices.manage',
  'promotions.manage', 'complexes.manage', 'employees.manage', 'settings.view'
]

export function toSession(dto: Out<typeof S.SessionDto>): M.Session {
  // Un permiso desconocido se ignora: nunca concede acceso por accidente.
  const permissions = dto.permissions.filter((p): p is M.Permission => (PERMISSIONS as readonly string[]).includes(p))
  return { user: dto.user, permissions, complexId: dto.complexId, csrfToken: dto.csrfToken }
}

export const toComplex = (dto: Out<typeof S.ComplexDto>): M.Complex => ({ ...dto, kind: dto.kind === 'vip' ? 'vip' : 'traditional' })

export const toReference = (dto: Out<typeof S.ReferenceDto>): M.ReferenceData => ({ ...dto, complexes: dto.complexes.map(toComplex) })

export const toRoom = (dto: Out<typeof S.RoomDto>): M.Room => dto

const SEAT_KINDS: readonly M.SeatKind[] = ['standard', 'accessible', 'companion', 'premium']
export const toSeatTemplate = (dto: Out<typeof S.SeatTemplateDto>): M.SeatTemplate => ({
  ...dto,
  rows: dto.rows.map(row => ({
    label: row.label,
    seats: row.seats.map(seat => ({ column: seat.column, kind: oneOf(seat.kind, SEAT_KINDS, 'standard', 'seat.kind') }))
  }))
})

export const toMovie = (dto: Out<typeof S.MovieDto>): M.Movie => ({
  id: dto.id, version: dto.version, title: dto.title, slug: dto.slug, rating: dto.rating, genres: dto.genres,
  durationMinutes: dto.durationMinutes, synopsis: dto.synopsis, category: dto.category, isSpecialEvent: dto.isSpecialEvent,
  posterUrl: dto.media.posterUrl, bannerUrl: dto.media.bannerUrl, trailerUrl: dto.media.trailerUrl, vistaId: dto.vistaId,
  cast: dto.cast.map(person => ({ name: person.name, role: person.role === 'director' ? 'director' : 'actor' })),
  releaseDate: dto.releaseDate, presaleFrom: dto.presaleFrom, lastDay: dto.lastDay, upcomingScreenings: dto.upcomingScreenings
})

export const fromMovie = (input: M.MovieInput & { version?: number }) => ({
  version: input.version, title: input.title, slug: input.slug, rating: input.rating, genres: input.genres,
  durationMinutes: input.durationMinutes, synopsis: input.synopsis, category: input.category, isSpecialEvent: input.isSpecialEvent,
  media: { posterUrl: input.posterUrl, bannerUrl: input.bannerUrl, trailerUrl: input.trailerUrl },
  vistaId: input.vistaId, cast: input.cast, releaseDate: input.releaseDate, presaleFrom: input.presaleFrom, lastDay: input.lastDay
})

export const toScreening = (dto: Out<typeof S.ScreeningDto>): M.Screening => ({
  id: dto.id, version: dto.version, movieId: dto.movieId, movieTitle: dto.movieTitle, complexId: dto.complexId,
  roomId: dto.room.id, roomNumber: dto.room.number, roomType: dto.room.type, projection: dto.projection, language: dto.language,
  date: dto.date, startTime: dto.startTime, endTime: dto.endTime, endsNextDay: dto.endsNextDay,
  isPresale: dto.isPresale, active: dto.active, hasTicketsSold: dto.hasTicketsSold
})

export const toSchedulePlan = (dto: Out<typeof S.SchedulePlanDto>): M.SchedulePlan => ({
  tooMany: dto.tooMany,
  rows: dto.rows.map(row => ({
    key: row.key, movieId: row.movieId, movieTitle: row.movieTitle, complexId: row.complexId,
    roomId: row.room?.id ?? null, roomNumber: row.room?.number ?? null,
    roomType: row.roomType, projection: row.projection, language: row.language,
    date: row.date, startTime: row.startTime, endTime: row.endTime, endsNextDay: row.endsNextDay, problem: row.problem
  }))
})

const STRUCTURES: readonly M.ProductStructure[] = ['simple', 'compound', 'combo']
const MODIFIER_KINDS: readonly M.ModifierKind[] = ['size', 'flavor', 'extra', 'choice']

export const toProduct = (dto: Out<typeof S.ProductDto>): M.Product => ({
  id: dto.id, version: dto.version, apiId: dto.apiId, name: dto.name, description: dto.description, imageUrl: dto.imageUrl,
  category: dto.category, structure: oneOf(dto.structure, STRUCTURES, 'simple', 'product.structure'),
  requiresTicketCode: dto.requiresTicketCode, complexCount: dto.complexCount,
  rules: dto.rules.map(rule => ({
    id: rule.id, title: rule.title, kind: oneOf(rule.kind, MODIFIER_KINDS, 'choice', 'rule.kind'),
    min: rule.min, max: rule.max, allowSplit: rule.allowSplit,
    options: rule.options.map(option => ({ id: option.id, apiId: option.apiId, name: option.name, extraCents: cents(option.extra), isDefault: option.isDefault }))
  }))
})

export const fromProduct = (input: M.ProductInput & { version?: number }) => ({
  version: input.version, apiId: input.apiId, name: input.name, description: input.description, imageUrl: input.imageUrl,
  categoryId: input.categoryId, structure: input.structure, requiresTicketCode: input.requiresTicketCode,
  rules: input.rules.map(rule => ({
    id: rule.id, title: rule.title, kind: rule.kind, min: rule.min, max: rule.max, allowSplit: rule.allowSplit,
    options: rule.options.map(option => ({ id: option.id, apiId: option.apiId, name: option.name, extra: money(option.extraCents), isDefault: option.isDefault }))
  }))
})

export const toCatalogEntry = (dto: Out<typeof S.CatalogEntryDto>): M.CatalogEntry => ({
  complexId: dto.complexId, version: dto.version, product: toProduct(dto.product), priceCents: cents(dto.price),
  available: dto.available,
  optionSettings: dto.optionSettings.map(setting => ({ optionId: setting.optionId, active: setting.active, extraCents: cents(setting.extra) }))
})

export const fromCatalogEntry = (input: M.CatalogEntryInput) => ({
  version: input.version, price: money(input.priceCents), available: input.available,
  optionSettings: input.optionSettings.map(setting => ({ optionId: setting.optionId, active: setting.active, extra: money(setting.extraCents) }))
})

export const toPriceChange = (dto: Out<typeof S.PriceChangeDto>): M.PriceChange => ({
  id: dto.id, productName: dto.productName, previousCents: cents(dto.previous), newCents: cents(dto.current), changedAt: parseInstant(dto.changedAt)
})

export const toTicketType = (dto: Out<typeof S.TicketTypeDto>): M.TicketType => ({
  id: dto.id, version: dto.version, name: dto.name, description: dto.description, isPromotional: dto.isPromotional,
  fixedPriceCents: dto.fixedPrice ? cents(dto.fixedPrice) : null
})

export const toPriceSheet = (dto: Out<typeof S.PriceSheetDto>): M.PriceSheet => ({
  complexId: dto.complexId, version: dto.version,
  prices: dto.prices.map(p => ({ roomType: p.roomType, projection: p.projection, ticketTypeId: p.ticketTypeId, priceCents: cents(p.price), onlineFeeCents: cents(p.onlineFee) }))
})

export const toPromotion = (dto: Out<typeof S.PromotionDto>): M.Promotion => dto

export const toClubLevel = (dto: Out<typeof S.ClubLevelDto>): M.ClubLevel => dto

export const toBanner = (dto: Out<typeof S.BannerDto>): M.Banner => dto

export const toRole = (dto: Out<typeof S.RoleDto>): M.Role => dto

const EMPLOYEE_STATUSES: readonly M.EmployeeStatus[] = ['active', 'leave', 'inactive']
export const toEmployee = (dto: Out<typeof S.EmployeeDto>): M.Employee => ({
  id: dto.id, version: dto.version, firstName: dto.firstName, lastName: dto.lastName, secondLastName: dto.secondLastName,
  email: dto.email, phone: dto.phone, birthDate: dto.birthDate, hiredOn: dto.hiredOn, salaryCents: cents(dto.salary),
  status: oneOf(dto.status, EMPLOYEE_STATUSES, 'active', 'employee.status'), complexId: dto.complexId, roleId: dto.roleId
})

export const fromEmployee = ({ salaryCents, ...rest }: M.EmployeeInput & { version?: number }) => ({ ...rest, salary: money(salaryCents) })

export const toActivity = (dto: Out<typeof S.ActivityDto>): M.Activity => ({ ...dto, at: parseInstant(dto.at) })
