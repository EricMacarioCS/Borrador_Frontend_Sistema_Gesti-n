/** Conversión del estado del simulador al JSON del contrato (`src/adapters/http/schemas.ts`). */
import type {
  CatalogEntryJson, ComplexJson, EmployeeJson, MovieJson, ProductJson, RoomJson, ScreeningJson,
  SeatTemplateJson
} from '@/adapters/http/schemas'
import { endTime } from '@/domain/rules'
import { dateInZone, formatTime } from '@/shared/lib/datetime'
import { CITIES, LANGUAGES, PROJECTIONS, ROOM_TYPES, SEAT_SHAPES, TIME_ZONE, today } from '../fixtures'
import type { CatalogRec, EmployeeRec, MockState, MovieRec, ProductRec, RoomRec, ScreeningRec, TemplateRec } from '../store'
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

export function movieJson(state: MockState, movie: MovieRec, now: number): MovieJson {
  return {
    id: movie.id, version: movie.version, title: movie.title, slug: movie.slug, rating: movie.rating, genres: movie.genres,
    durationMinutes: movie.durationMinutes, synopsis: movie.synopsis, category: movie.category, isSpecialEvent: movie.isSpecialEvent,
    media: { posterUrl: movie.posterUrl, bannerUrl: movie.bannerUrl, trailerUrl: movie.trailerUrl }, vistaId: movie.vistaId,
    cast: movie.cast, releaseDate: movie.releaseDate, presaleFrom: movie.presaleFrom, lastDay: movie.lastDay,
    upcomingScreenings: upcoming(state, now, s => s.movieId === movie.id).length
  }
}

/** Boletos vendidos por el sitio web para la función. */
export function ticketsSold(state: MockState, screeningId: string) {
  return state.ticketSales[screeningId] ?? 0
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
    active: screening.active, hasTicketsSold: ticketsSold(state, screening.id) > 0
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

export function catalogJson(state: MockState, complexId: string, entry: CatalogRec): CatalogEntryJson {
  const product = state.products.find(p => p.id === entry.productId)!
  return {
    complexId, version: entry.version, product: productJson(state, product), price: money(entry.priceCents), available: entry.available,
    optionSettings: entry.options.map(option => ({ optionId: option.optionId, active: option.active, extra: money(option.extraCents) }))
  }
}

export function employeeJson(employee: EmployeeRec): EmployeeJson {
  const { salaryCents, ...rest } = employee
  return { ...rest, salary: money(salaryCents) }
}
