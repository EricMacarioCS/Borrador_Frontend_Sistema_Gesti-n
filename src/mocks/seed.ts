/** Construye el estado inicial del simulador a partir de los datos por defecto. Determinista para una misma fecha. */
import { addDays } from '@/shared/lib/datetime'
import { endTime } from '@/domain/rules'
import * as F from './fixtures'
import type { CatalogRec, MockState, PriceRec, ProductRec, RoomRec, ScreeningRec } from './store'

export function hash(text: string): number {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  value = Math.imul(value ^ (value >>> 15), 2246822507)
  return (value ^ (value >>> 13)) >>> 0
}

function rooms(): RoomRec[] {
  return F.COMPLEX_SEEDS.flatMap(complex => complex.rooms.map(([type, threeD], i) => ({
    id: `${complex.id}-r${i + 1}`, version: 1, complexId: complex.id, number: i + 1, name: `Sala ${i + 1}`, type,
    projections: threeD ? ['2d', '3d'] : ['2d']
  })))
}

/** Programación de ejemplo: de dos días atrás a seis adelante, sin traslapes y con limpieza entre funciones. */
function screenings(allRooms: RoomRec[]): ScreeningRec[] {
  const today = F.today()
  const result: ScreeningRec[] = []
  for (let offset = -2; offset <= 6; offset++) {
    const date = addDays(today, offset)
    const films = F.MOVIE_SEEDS.filter(movie => {
      const release = addDays(today, movie.releaseOffset)
      const last = movie.lastDayOffset === null ? null : addDays(today, movie.lastDayOffset)
      const onSale = movie.presaleOffset !== null || movie.releaseOffset <= 0
      return onSale && date >= release && (!last || date <= last)
    })
    const regular = films.filter(movie => !movie.isSpecialEvent)
    const events = films.filter(movie => movie.isSpecialEvent)
    for (const room of allRooms) {
      const candidates = room.type === 'junior' ? regular.filter(movie => ['AA', 'A'].includes(movie.rating)) : regular
      if (!candidates.length) continue
      const pick = hash(`${room.id}|${date}`)
      const isEventRoom = events.length > 0 && room.type === 'traditional' && room.number === allRooms.filter(r => r.complexId === room.complexId && r.type === 'traditional').at(-1)?.number
      const movie = candidates[pick % candidates.length]!
      let minutes = 11 * 60 + (pick % 4) * 15
      for (let show = 0; show < 4; show++) {
        const eventSlot = isEventRoom && show === 3
        const film = eventSlot ? events[0]! : movie
        if (eventSlot) minutes = Math.max(minutes, 20 * 60 + 30)
        if (minutes > 23 * 60) break
        const startTime = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
        const projection = room.projections.includes('3d') && show % 2 === 1 ? '3d' : '2d'
        result.push({
          id: `s-${room.id}-${date.replaceAll('-', '')}-${show}`, version: 1, movieId: film.id, roomId: room.id, date, startTime,
          projection, language: (pick + show) % 3 === 0 ? 'sub' : 'es', active: true
        })
        minutes += Math.ceil((film.durationMinutes + F.CLEANING_MINUTES) / 10) * 10
      }
    }
  }
  return result
}

function priceSheet(complexId: string, complexRooms: RoomRec[]): { version: number; prices: PriceRec[] } {
  const base = F.COMPLEX_SEEDS.find(complex => complex.id === complexId)!.baseCents
  const combos = new Set(complexRooms.flatMap(room => room.projections.map(projection => `${room.type}|${projection}`)))
  const prices = [...combos].flatMap(combo => {
    const [roomType, projection] = combo.split('|') as [string, string]
    const full = base + F.ROOM_TYPES.find(type => type.code === roomType)!.surchargeCents + F.PROJECTIONS.find(p => p.code === projection)!.surchargeCents
    return F.TICKET_TYPE_SEEDS.filter(type => type.fixedPriceCents === null).map(type => ({
      roomType, projection, ticketTypeId: type.id,
      // Los precios se guardan al peso entero, como en la tarifa publicada.
      priceCents: Math.round(full * type.percent / 100 / 100) * 100,
      onlineFeeCents: F.SERVICE_FEE_CENTS
    }))
  })
  return { version: 1, prices }
}

function products(): ProductRec[] {
  return F.PRODUCT_SEEDS.map(seed => ({
    id: seed.id, version: 1, apiId: seed.apiId, name: seed.name, description: seed.description, imageUrl: null,
    categoryId: seed.categoryId, structure: seed.structure, requiresTicketCode: seed.requiresTicketCode,
    rules: seed.rules.map((rule, r) => ({
      id: `${seed.id}-g${r + 1}`, title: rule.title, kind: rule.kind, min: rule.min, max: rule.max, allowSplit: rule.allowSplit ?? false,
      options: rule.options.map((option, o) => ({
        id: `${seed.id}-g${r + 1}-o${o + 1}`, apiId: String(16500 + hash(`${seed.id}${r}${o}`) % 1000), name: option.name,
        extraCents: option.extraCents ?? 0, isDefault: option.isDefault ?? false
      }))
    }))
  }))
}

function catalog(complexId: string, allProducts: ProductRec[]): CatalogRec[] {
  const markup = F.CATALOG_MARKUP[complexId] ?? 0
  const isVip = F.COMPLEX_SEEDS.find(complex => complex.id === complexId)?.kind === 'vip'
  return allProducts
    // Las salas VIP no venden el coleccionable; Córdoba no tiene hot dog.
    .filter(product => !(isVip && product.id === 'p-10') && !(complexId === 'cordoba-parque' && product.id === 'p-7'))
    .map(product => {
      const seed = F.PRODUCT_SEEDS.find(item => item.id === product.id)!
      return {
        productId: product.id, version: 1, priceCents: seed.baseCents + markup, available: !(complexId === 'coatza-malecon' && product.id === 'p-6'),
        options: product.rules.flatMap(rule => rule.options.map(option => ({
          optionId: option.id, active: !(option.name === 'Chile' && complexId.startsWith('ver')), extraCents: option.extraCents
        })))
      }
    })
}

/** Boletos vendidos de ejemplo. Los registra el sitio web; la gestión solo necesita saber si una función ya vendió. */
function ticketSales(allScreenings: ScreeningRec[]): Record<string, number> {
  const today = F.today()
  const chosen = allScreenings.filter(s => s.date >= addDays(today, -1) && s.date <= addDays(today, 2)).filter((_, i) => i % 9 === 0)
  return Object.fromEntries(chosen.map(s => [s.id, 1 + (hash(s.id) % 4)]))
}

export function seedState(): MockState {
  const today = F.today()
  const allRooms = rooms()
  const allScreenings = screenings(allRooms)
  const allProducts = products()
  const priceSheets = Object.fromEntries(F.COMPLEX_SEEDS.map(c => [c.id, priceSheet(c.id, allRooms.filter(r => r.complexId === c.id))]))
  const catalogs = Object.fromEntries(F.COMPLEX_SEEDS.map(c => [c.id, catalog(c.id, allProducts)]))
  const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString()

  return {
    v: 3,
    seq: 1000,
    seededOn: today,
    sessions: {},
    logins: {},
    users: F.USER_SEEDS.map(user => ({ ...user, lastAccess: null, createdAt: at(24 * 400) })),
    complexes: F.COMPLEX_SEEDS.map(c => ({
      id: c.id, version: 1, name: c.name, slug: `cinepolis-${c.id}`, kind: c.kind, cityId: c.cityId, address: c.address, postalCode: c.postalCode,
      openedOn: c.openedOn, imageUrl: null, vistaId: String(1000 + hash(c.id) % 9000), timeZone: F.TIME_ZONE
    })),
    rooms: allRooms,
    templates: {},
    movies: F.MOVIE_SEEDS.map(m => ({
      id: m.id, version: 1, title: m.title, slug: m.slug, rating: m.rating, genres: m.genres, durationMinutes: m.durationMinutes, synopsis: m.synopsis,
      category: m.category, isSpecialEvent: m.isSpecialEvent, posterUrl: null, bannerUrl: null, trailerUrl: null, vistaId: String(hash(m.id) % 100000),
      cast: m.cast, releaseDate: F.offsetDate(m.releaseOffset), presaleFrom: F.offsetDate(m.presaleOffset), lastDay: F.offsetDate(m.lastDayOffset)
    })),
    screenings: allScreenings,
    ticketTypes: F.TICKET_TYPE_SEEDS.map(t => ({ id: t.id, version: 1, name: t.name, description: t.description, isPromotional: t.isPromotional, fixedPriceCents: t.fixedPriceCents })),
    priceSheets,
    categories: F.CATEGORY_SEEDS.map(c => ({ ...c })),
    products: allProducts,
    catalogs,
    priceHistory: { 'xal-centro': [{ id: 'ph-1', productId: 'p-3', previousCents: 6900, newCents: 7400, changedAt: at(24 * 9) }] },
    promotions: F.PROMOTION_SEEDS.map(p => ({
      ...p, version: 1, validFrom: addDays(today, p.validFrom), validTo: p.validTo === null ? null : addDays(today, p.validTo)
    })),
    clubLevels: F.CLUB_LEVEL_SEEDS.map(level => ({ ...level, version: 1 })),
    ticketSales: ticketSales(allScreenings),
    banners: F.BANNER_SEEDS.map(b => ({ ...b, version: 1, startsOn: addDays(today, b.startsOn), endsOn: b.endsOn === null ? null : addDays(today, b.endsOn) })),
    home: { version: 1, featuredMovieIds: ['m-101', 'm-102', 'm-104', 'm-109', 'm-105'] },
    faq: { version: 1, items: F.FAQ_SEED.map(item => ({ ...item })) },
    pages: F.PAGE_SEEDS.map(page => ({ ...page, version: 1 })),
    rules: { version: 1, maxSeatsPerPurchase: 10, holdMinutes: 10, cancelMinutesBefore: 60, scheduleDays: 14 },
    roles: F.ROLE_SEEDS.map(role => ({ ...role, version: 1 })),
    employees: [F.ADMIN_EMPLOYEE, ...F.employeeSeeds()].map(employee => ({ ...employee, version: 1 })),
    activity: [
      { id: 'act-3', at: at(1), actor: 'Ana Torres', area: 'Dulcería', summary: 'Cambió el precio de Palomitas en Xalapa Centro.' },
      { id: 'act-2', at: at(5), actor: 'Ana Torres', area: 'Funciones', summary: 'Programó 24 funciones de Horizonte infinito.' },
      { id: 'act-1', at: at(26), actor: 'Ana Torres', area: 'Películas', summary: 'Registró Ciudad de sombras con preventa.' }
    ],
    idempotency: {}
  }
}

/** Duración en minutos de una función guardada. */
export function screeningEnd(startTime: string, durationMinutes: number) {
  return endTime(startTime, durationMinutes)
}
