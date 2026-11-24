/**
 * Reglas del servidor, probadas a través de los adaptadores HTTP reales sobre el simulador.
 * Son la especificación ejecutable para el backend: el API de .NET debe pasar por los mismos casos
 * (sesión, permisos, CSRF, versiones, idempotencia, planeación sin traslapes, cancelación en cascada).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockBackend } from '@/mocks'
import { resetForTests } from '@/mocks/store'
import { createHttpAdapters } from '@/adapters/http/adapters'
import { ApiError } from '@/shared/lib/errors'
import { addDays, dateInZone, zonedInstant } from '@/shared/lib/datetime'
import type { ScheduleRequest } from '@/domain/models'

const SESSION_KEY = 'cp-admin-mock-session'
const ADMIN = { email: 'admin@cinepolis.test', password: 'Demo-2026' }
const MANAGER = { email: 'gerente.xalapa@cinepolis.test', password: 'Demo-2026' }

/** Un cliente con su propia "cookie" de sesión. */
function client(sid: string) {
  const backend = createMockBackend({ baseUrl: '/api/admin/v1', latencyMs: [0, 0], failureRate: 0 })
  const fetchImpl: typeof fetch = (input, init) => {
    sessionStorage.setItem(SESSION_KEY, sid)
    return backend.fetchImpl(input, init)
  }
  return { ...createHttpAdapters({ baseUrl: '/api/admin/v1', fetchImpl }), fetchImpl }
}

async function signedIn(sid: string, user = ADMIN) {
  const ports = client(sid)
  await ports.auth.getSession()
  await ports.auth.signIn(user.email, user.password)
  return ports
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Se esperaba un error')
}

const today = () => dateInZone(new Date())

beforeEach(() => {
  resetForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  // Siempre a mediodía de la Ciudad de México: las pruebas no dependen de la hora en que corren.
  vi.setSystemTime(zonedInstant(dateInZone(new Date()), '12:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('sesión y seguridad', () => {
  it('sin sesión no se puede leer nada del sistema', async () => {
    const error = await rejection(client('anonimo').movies.list())
    expect(error.status).toBe(401)
    expect(error.code).toBe('SESSION_REQUIRED')
  })

  it('credenciales incorrectas dan el mismo error, y tras 5 intentos la cuenta se bloquea', async () => {
    const ports = client('intruso')
    const unknown = await rejection(ports.auth.signIn('nadie@cinepolis.test', 'x'))
    expect(unknown.code).toBe('INVALID_CREDENTIALS')
    for (let i = 0; i < 5; i++) await rejection(ports.auth.signIn(ADMIN.email, 'incorrecta'))
    const locked = await rejection(ports.auth.signIn(ADMIN.email, ADMIN.password))
    expect(locked.code).toBe('ACCOUNT_LOCKED')
    vi.setSystemTime(new Date(Date.now() + 16 * 60_000))
    const session = await ports.auth.signIn(ADMIN.email, ADMIN.password)
    expect(session.user?.email).toBe(ADMIN.email)
  })

  it('el servidor rechaza escrituras sin el token CSRF de la sesión', async () => {
    const ports = await signedIn('admin-a')
    const response = await ports.fetchImpl('/api/admin/v1/product-categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Snacks' })
    })
    expect(response.status).toBe(403)
    expect(((await response.json()) as { code: string }).code).toBe('CSRF_INVALID')
  })

  it('cerrar sesión invalida el acceso', async () => {
    const ports = await signedIn('admin-b')
    await ports.auth.signOut()
    expect((await rejection(ports.movies.list())).code).toBe('SESSION_REQUIRED')
  })
})

describe('permisos y alcance por complejo', () => {
  it('un gerente no puede tocar tarifas ni definir productos de la cadena', async () => {
    const manager = await signedIn('gerente-a', MANAGER)
    const prices = await rejection(manager.prices.saveSheet('xal-centro', 1, []))
    expect(prices.code).toBe('FORBIDDEN')
    const categories = await rejection(manager.products.createCategory('Snacks'))
    expect(categories.code).toBe('FORBIDDEN')
  })

  it('un gerente solo ve y modifica lo de sus complejos', async () => {
    const manager = await signedIn('gerente-b', MANAGER)
    const screenings = await manager.screenings.list({ from: today(), to: addDays(today(), 2) })
    expect(screenings.length).toBeGreaterThan(0)
    expect(new Set(screenings.map(s => s.complexId))).toEqual(new Set(['xal-centro', 'xal-centro-vip']))
    const orders = await manager.orders.list({ page: 1, pageSize: 100 })
    expect(orders.items.every(o => ['xal-centro', 'xal-centro-vip'].includes(o.complexId))).toBe(true)
    const entry = (await manager.products.catalog('ver-boulevard'))[0]!
    const error = await rejection(manager.products.saveCatalogEntry('ver-boulevard', entry.product.id, {
      version: entry.version, priceCents: entry.priceCents + 100, available: true, optionSettings: entry.optionSettings
    }))
    expect(error.code).toBe('FORBIDDEN')
  })
})

describe('películas', () => {
  it('concurrencia optimista: guardar sobre una versión vieja da VERSION_CONFLICT', async () => {
    const a = await signedIn('admin-c')
    const b = await signedIn('admin-d')
    const movie = (await a.movies.list()).find(m => m.id === 'm-105')!
    const { id: _id, version, upcomingScreenings: _u, ...input } = movie
    await a.movies.update(movie.id, { ...input, synopsis: 'Primera edición.', version })
    const error = await rejection(b.movies.update(movie.id, { ...input, synopsis: 'Edición sobre la versión vieja.', version }))
    expect(error.status).toBe(409)
    expect(error.code).toBe('VERSION_CONFLICT')
  })

  it('no se retira una película con funciones ni se repite una URL amigable', async () => {
    const ports = await signedIn('admin-e')
    const movie = (await ports.movies.list()).find(m => m.id === 'm-101')!
    expect((await rejection(ports.movies.remove(movie.id, movie.version))).code).toBe('RESOURCE_IN_USE')
    const { id: _id, version: _v, upcomingScreenings: _u, ...input } = movie
    expect((await rejection(ports.movies.create({ ...input, title: 'Otra' }))).code).toBe('DUPLICATE')
  })
})

describe('programación por lote', () => {
  const request = (date: string, times: string[]): ScheduleRequest => ({
    movieIds: ['m-101'], languages: ['es'], complexIds: ['xal-centro'], roomTypes: ['traditional'], projections: ['2d'],
    roomIds: [], dates: [date], times
  })

  it('asigna salas libres, respeta la limpieza y la creación es idempotente', async () => {
    const ports = await signedIn('admin-f')
    const date = addDays(today(), 9)
    const plan = await ports.screenings.preview(request(date, ['11:00', '13:00']))
    expect(plan.rows.every(row => row.problem === null)).toBe(true)
    // 138 min + 20 de limpieza: la de 13:00 no cabe en la misma sala que la de 11:00.
    expect(plan.rows[0]!.roomId).not.toBe(plan.rows[1]!.roomId)

    const key = crypto.randomUUID()
    const created = await ports.screenings.createBatch(request(date, ['11:00', '13:00']), [], key)
    const again = await ports.screenings.createBatch(request(date, ['11:00', '13:00']), [], key)
    expect(again.map(s => s.id)).toEqual(created.map(s => s.id))

    const repeated = await ports.screenings.preview(request(date, ['11:00']))
    expect(repeated.rows[0]!.problem).toBe('Esta función ya está programada')
  })

  it('el servidor vuelve a validar al crear: un horario pasado no se crea', async () => {
    const ports = await signedIn('admin-g')
    const error = await rejection(ports.screenings.createBatch(request(today(), ['09:00']), [], crypto.randomUUID()))
    expect(error.code).toBe('VALIDATION_FAILED')
  })

  it('mover una función a una sala ocupada da SCHEDULE_CONFLICT', async () => {
    const ports = await signedIn('admin-h')
    const tomorrow = addDays(today(), 1)
    const list = (await ports.screenings.list({ from: tomorrow, to: tomorrow, complexId: 'xal-centro' })).filter(s => s.ticketsSold === 0)
    const [first, second] = [list.find(s => s.roomNumber === 4)!, list.find(s => s.roomNumber === 5)!]
    const error = await rejection(ports.screenings.update(first.id, {
      version: first.version, roomId: second.roomId, date: second.date, startTime: second.startTime,
      projection: '2d', language: first.language.code, active: true
    }))
    expect(error.code).toBe('SCHEDULE_CONFLICT')
  })
})

describe('dulcería', () => {
  it('cambiar el precio en un complejo queda en el historial y no afecta a otro', async () => {
    const ports = await signedIn('admin-i')
    const entry = (await ports.products.catalog('xal-centro')).find(e => e.product.id === 'p-3')!
    const other = (await ports.products.catalog('ver-boulevard')).find(e => e.product.id === 'p-3')!
    await ports.products.saveCatalogEntry('xal-centro', 'p-3', {
      version: entry.version, priceCents: entry.priceCents + 500, available: true, optionSettings: entry.optionSettings
    })
    const history = await ports.products.priceHistory('xal-centro')
    expect(history[0]).toMatchObject({ productName: 'Palomitas', previousCents: entry.priceCents, newCents: entry.priceCents + 500 })
    expect((await ports.products.catalog('ver-boulevard')).find(e => e.product.id === 'p-3')!.priceCents).toBe(other.priceCents)
  })

  it('no se deja una regla obligatoria sin opciones activas', async () => {
    const ports = await signedIn('admin-j')
    const entry = (await ports.products.catalog('xal-centro')).find(e => e.product.id === 'p-4')!
    const sizes = entry.product.rules.find(rule => rule.kind === 'size')!.options.map(o => o.id)
    const error = await rejection(ports.products.saveCatalogEntry('xal-centro', 'p-4', {
      version: entry.version, priceCents: entry.priceCents, available: true,
      optionSettings: entry.optionSettings.map(s => sizes.includes(s.optionId) ? { ...s, active: false } : s)
    }))
    expect(error.code).toBe('VALIDATION_FAILED')
  })
})

describe('pedidos', () => {
  async function cancellableWithFood(ports: Awaited<ReturnType<typeof signedIn>>) {
    const page = await ports.orders.list({ kind: 'tickets', status: 'confirmed', page: 1, pageSize: 100 })
    for (const summary of page.items) {
      const detail = await ports.orders.get(summary.id)
      if (detail.cancellation.allowed && detail.cancellation.affectedIds.length > 1) return detail
    }
    throw new Error('No hay pedidos cancelables con alimentos ligados')
  }

  it('cancelar boletos cancela sus alimentos no preparados y el reembolso termina después', async () => {
    const ports = await signedIn('admin-k')
    const order = await cancellableWithFood(ports)
    const key = crypto.randomUUID()
    const cancelled = await ports.orders.cancel(order.id, 'Prueba', key)
    expect(cancelled.status).toBe('refund-pending')
    const linked = await ports.orders.get(order.cancellation.affectedIds[1]!)
    expect(linked.status).toBe('refund-pending')
    // Repetir con la misma clave no cancela dos veces.
    expect((await ports.orders.cancel(order.id, 'Prueba', key)).id).toBe(order.id)
    vi.setSystemTime(new Date(Date.now() + 5000))
    expect((await ports.orders.get(order.id)).status).toBe('refunded')
  })

  it('a menos de 60 minutos de la función ya no se cancela', async () => {
    const ports = await signedIn('admin-l')
    const order = await cancellableWithFood(ports)
    const target = zonedInstant(order.screening!.date, order.screening!.startTime).getTime() - 30 * 60_000
    vi.setSystemTime(new Date(target))
    // Si pasaron más de 12 horas la sesión anterior expiró (es absoluta): se entra de nuevo.
    const again = await signedIn('admin-l2')
    const error = await rejection(again.orders.cancel(order.id, 'Tarde', crypto.randomUUID()))
    expect(error.code).toBe('CANCELLATION_WINDOW_CLOSED')
  })

  it('la sesión vence a las 12 horas aunque haya actividad', async () => {
    const ports = await signedIn('admin-n')
    vi.setSystemTime(new Date(Date.now() + 12 * 3600_000 + 60_000))
    expect((await rejection(ports.movies.list())).code).toBe('SESSION_EXPIRED')
  })
})

describe('salas', () => {
  it('el plano define la capacidad; las columnas repetidas se rechazan', async () => {
    const ports = await signedIn('admin-m')
    const template = await ports.complexes.getSeatTemplate('xal-centro-vip-r2')
    const rows = template.rows.map(row => ({ ...row, seats: row.seats.slice(0, 4) }))
    await ports.complexes.saveSeatTemplate({ ...template, rows })
    const rooms = await ports.complexes.listRooms('xal-centro-vip')
    expect(rooms.find(r => r.id === 'xal-centro-vip-r2')!.capacity).toBe(rows.length * 4)

    const current = await ports.complexes.getSeatTemplate('xal-centro-vip-r2')
    const duplicated = current.rows.map((row, i) => i === 0 ? { ...row, seats: [...row.seats, row.seats[0]!] } : row)
    expect((await rejection(ports.complexes.saveSeatTemplate({ ...current, rows: duplicated }))).code).toBe('VALIDATION_FAILED')
  })
})
