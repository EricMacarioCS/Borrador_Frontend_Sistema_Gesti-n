/** Conversión del estado del simulador al JSON del contrato (`src/adapters/http/schemas.ts`). */
import type {
  CatalogEntryJson, ComplexJson, EmployeeJson, MovieJson, OrderDetailJson, OrderSummaryJson, ProductJson, RoomJson, ScreeningJson,
  SeatTemplateJson
} from '@/adapters/http/schemas'
import { endTime } from '@/domain/rules'
import { dateInZone, formatTime, zonedInstant } from '@/shared/lib/datetime'
import { CITIES, LANGUAGES, PROJECTIONS, ROOM_TYPES, SEAT_SHAPES, TIME_ZONE, today } from '../fixtures'
import type { CatalogRec, EmployeeRec, MockState, MovieRec, OrderRec, ProductRec, RoomRec, ScreeningRec, TemplateRec } from '../store'
import { money } from './core'

export const roomTypeLabel = (code: string) => ({ code, name: ROOM_TYPES.find(type => type.code === code)?.name ?? code })
export const projectionLabel = (code: string) => ({ code, name: PROJECTIONS.find(p => p.code === code)?.name ?? code })
export const languageLabel = (code: string) => ({ code, name: LANGUAGES.find(l => l.code === code)?.name ?? code })

/** Plano por defecto según el tipo de sala, si aún no se capturó uno. */
export function templateOf(state: MockState, room: RoomRec): TemplateRec {
  const saved = state.templates[room.id]
  if (saved) return saved
  const shape = SEAT_SHAPES[room.type] ?? SEAT_SHAPES.traditional!
  return {
    version: 0,
    rows: Array.from({ length: shape.rows }, (_, r) => ({
      label: String.fromCharCode(65 + r),
      seats: Array.from({ length: shape.columns }, (_, c) => c + 1)
        .filter(column => !shape.aisles.includes(column))
        .map(column => ({
          column,
          kind: r === shape.rows - 1 && (column === 1 || column === 2) ? 'accessible'
            : r === shape.rows - 1 && column === 3 ? 'companion'
              : r >= shape.rows - shape.premiumRows ? 'premium' : 'standard'
        }))
    }))
  }
}

export const capacityOf = (template: TemplateRec) => template.rows.reduce((sum, row) => sum + row.seats.length, 0)

export function roomJson(state: MockState, room: RoomRec): RoomJson {
  return {
    id: room.id, version: room.version, complexId: room.complexId, number: room.number, name: room.name,
    type: roomTypeLabel(room.type), projections: room.projections.map(projectionLabel), capacity: capacityOf(templateOf(state, room))
  }
}

export function templateJson(state: MockState, room: RoomRec): SeatTemplateJson {
  const template = templateOf(state, room)
  return { roomId: room.id, version: template.version, rows: template.rows }
}

export function complexJson(state: MockState, id: string): ComplexJson {
  const complex = state.complexes.find(c => c.id === id)!
  const rooms = state.rooms.filter(room => room.complexId === id)
  return {
    ...complex,
    cityName: CITIES.find(city => city.id === complex.cityId)?.name ?? '',
    roomCount: rooms.length,
    seatCount: rooms.reduce((sum, room) => sum + capacityOf(templateOf(state, room)), 0)
  }
}

/** Fecha y hora locales de los complejos. */
export function nowLocal(now: number) {
  return { date: dateInZone(new Date(now), TIME_ZONE), time: formatTime(new Date(now), TIME_ZONE) }
}

/** Funciones que todavía no empiezan. */
export function upcoming(state: MockState, now: number, filter: (s: ScreeningRec) => boolean = () => true) {
  const { date, time } = nowLocal(now)
  return state.screenings.filter(s => filter(s) && (s.date > date || (s.date === date && s.startTime > time)))
}

export const startsAt = (screening: ScreeningRec) => zonedInstant(screening.date, screening.startTime, TIME_ZONE).getTime()

export function movieJson(state: MockState, movie: MovieRec, now: number): MovieJson {
  return {
    id: movie.id, version: movie.version, title: movie.title, slug: movie.slug, rating: movie.rating, genres: movie.genres,
    durationMinutes: movie.durationMinutes, synopsis: movie.synopsis, category: movie.category, isSpecialEvent: movie.isSpecialEvent,
    media: { posterUrl: movie.posterUrl, bannerUrl: movie.bannerUrl, trailerUrl: movie.trailerUrl }, vistaId: movie.vistaId,
    cast: movie.cast, releaseDate: movie.releaseDate, presaleFrom: movie.presaleFrom, lastDay: movie.lastDay,
    upcomingScreenings: upcoming(state, now, s => s.movieId === movie.id).length
  }
}

export function ticketsSold(state: MockState, screeningId: string) {
  return state.orders
    .filter(order => order.screeningId === screeningId && ['confirmed', 'payment-pending'].includes(order.status))
    .reduce((sum, order) => sum + order.tickets.length, 0)
}

export function screeningJson(state: MockState, screening: ScreeningRec): ScreeningJson {
  const room = state.rooms.find(r => r.id === screening.roomId)!
  const movie = state.movies.find(m => m.id === screening.movieId)
  const duration = movie?.durationMinutes ?? 120
  const end = endTime(screening.startTime, duration)
  return {
    id: screening.id, version: screening.version, movieId: screening.movieId, movieTitle: movie?.title ?? 'Película retirada',
    complexId: room.complexId, room: { id: room.id, number: room.number, type: roomTypeLabel(room.type) },
    projection: projectionLabel(screening.projection), language: languageLabel(screening.language),
    date: screening.date, startTime: screening.startTime, endTime: end.time, endsNextDay: end.nextDay,
    isPresale: Boolean(movie?.releaseDate && screening.date >= movie.releaseDate && movie.presaleFrom && today() < movie.releaseDate),
    active: screening.active, ticketsSold: ticketsSold(state, screening.id)
  }
}

export function productJson(state: MockState, product: ProductRec): ProductJson {
  return {
    id: product.id, version: product.version, apiId: product.apiId, name: product.name, description: product.description, imageUrl: product.imageUrl,
    category: state.categories.find(c => c.id === product.categoryId) ?? { id: product.categoryId, name: 'Sin categoría' },
    structure: product.structure, requiresTicketCode: product.requiresTicketCode,
    rules: product.rules.map(rule => ({
      id: rule.id, title: rule.title, kind: rule.kind, min: rule.min, max: rule.max, allowSplit: rule.allowSplit,
      options: rule.options.map(option => ({ id: option.id, apiId: option.apiId, name: option.name, extra: money(option.extraCents), isDefault: option.isDefault }))
    })),
    complexCount: Object.values(state.catalogs).filter(entries => entries.some(entry => entry.productId === product.id)).length
  }
}

export function catalogJson(state: MockState, complexId: string, entry: CatalogRec, inventory: boolean): CatalogEntryJson {
  const product = state.products.find(p => p.id === entry.productId)!
  return {
    complexId, version: entry.version, product: productJson(state, product), price: money(entry.priceCents), available: entry.available,
    optionSettings: entry.options.map(option => ({ optionId: option.optionId, active: option.active, extra: money(option.extraCents) })),
    stock: inventory ? entry.stock : null
  }
}

/** El reembolso simulado termina unos segundos después de pedirlo. */
export function settleRefunds(state: MockState, now: number) {
  for (const order of state.orders) {
    if (order.status === 'refund-pending' && order.refund.completeAt !== null && order.refund.completeAt <= now) {
      order.status = 'refunded'
      order.refund = { ...order.refund, status: 'completed', completeAt: null }
    }
  }
}

export function orderSummaryJson(state: MockState, order: OrderRec): OrderSummaryJson {
  return {
    id: order.id, ticketCode: order.ticketCode, linkedTicketCode: order.linkedTicketCode, kind: order.kind, status: order.status,
    foodStatus: order.foodStatus, channel: order.channel,
    complex: { id: order.complexId, name: state.complexes.find(c => c.id === order.complexId)?.name ?? '' },
    customer: { name: order.customerName, email: order.customerEmail }, createdAt: order.createdAt, total: money(order.totalCents)
  }
}

export function linkedOrders(state: MockState, order: OrderRec) {
  return state.orders.filter(other => other.id !== order.id && (
    (order.ticketCode && other.linkedTicketCode === order.ticketCode) || (order.linkedTicketCode && other.ticketCode === order.linkedTicketCode)
  ))
}

/** Qué se cancela con este pedido: los boletos arrastran a sus alimentos que aún no se preparan. */
export function cancellationOf(state: MockState, order: OrderRec, now: number): { allowed: boolean; reason: string | null; affected: OrderRec[] } {
  if (!['confirmed'].includes(order.status)) return { allowed: false, reason: 'Solo se cancelan pedidos pagados.', affected: [] }
  if (order.kind === 'tickets') {
    const screening = state.screenings.find(s => s.id === order.screeningId)
    if (screening) {
      if (startsAt(screening) - now < state.rules.cancelMinutesBefore * 60_000) {
        return { allowed: false, reason: `Los boletos se cancelan hasta ${state.rules.cancelMinutesBefore} minutos antes de la función.`, affected: [] }
      }
    }
    const food = linkedOrders(state, order).filter(other => other.kind === 'food' && other.status === 'confirmed' && other.foodStatus === 'paid')
    return { allowed: true, reason: null, affected: [order, ...food] }
  }
  if (order.foodStatus !== 'paid') return { allowed: false, reason: 'El pedido ya se empezó a preparar o se entregó.', affected: [] }
  return { allowed: true, reason: null, affected: [order] }
}

export function orderDetailJson(state: MockState, order: OrderRec, now: number): OrderDetailJson {
  const screening = state.screenings.find(s => s.id === order.screeningId)
  const room = screening ? state.rooms.find(r => r.id === screening.roomId) : undefined
  const movie = screening ? state.movies.find(m => m.id === screening.movieId) : undefined
  const cancellation = cancellationOf(state, order, now)
  return {
    ...orderSummaryJson(state, order),
    screening: screening && room ? {
      movieTitle: movie?.title ?? 'Película retirada', date: screening.date, startTime: screening.startTime,
      room: `Sala ${room.number} · ${roomTypeLabel(room.type).name}`, projection: projectionLabel(screening.projection).name, language: languageLabel(screening.language).name
    } : null,
    tickets: order.tickets.map(t => ({ seat: t.seat, ticketType: t.ticketType, price: money(t.priceCents) })),
    items: order.items.map(i => ({ name: i.name, detail: i.detail, quantity: i.quantity, total: money(i.totalCents) })),
    pickup: order.pickup, paymentMethod: order.paymentMethod,
    totals: { subtotal: money(order.subtotalCents), discount: money(order.discountCents), serviceFee: money(order.serviceFeeCents), total: money(order.totalCents) },
    promotionName: order.promotionName,
    cancellation: { allowed: cancellation.allowed, reason: cancellation.reason, affectedIds: cancellation.affected.map(o => o.id) },
    refund: { status: order.refund.status, amount: money(order.refund.amountCents) },
    cancelReason: order.cancelReason,
    linkedOrders: linkedOrders(state, order).map(o => ({ id: o.id, ticketCode: o.ticketCode, kind: o.kind, status: o.status }))
  }
}

export function employeeJson(employee: EmployeeRec): EmployeeJson {
  const { salaryCents, ...rest } = employee
  return { ...rest, salary: money(salaryCents) }
}
