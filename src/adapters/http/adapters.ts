/**
 * Implementación HTTP de los puertos. En modo simulado se usa este mismo código con un `fetch` falso,
 * así que lo que funciona en la simulación ya ejercita la conversión real.
 */
import { z } from 'zod'
import type { Services } from '@/domain/ports'
import { ApiError } from '@/shared/lib/errors'
import { createHttpClient, type HttpClient, type RequestOptions } from '@/shared/lib/http'
import { syncClock } from '@/shared/lib/clock'
import * as S from './schemas'
import * as M from './mappers'

export interface HttpAdapterOptions {
  baseUrl: string
  fetchImpl?: typeof fetch
  /** Se llama cuando el servidor responde que la sesión ya no es válida. */
  onUnauthorized?: () => void
}

const path = (template: string, ...values: string[]) =>
  values.reduce((result, value) => result.replace(/\{[^}]+\}/, encodeURIComponent(value)), template)

export function createHttpAdapters(options: HttpAdapterOptions): Omit<Services, 'mode'> {
  let csrfToken: string | null = null
  const raw = createHttpClient({ baseUrl: options.baseUrl, fetchImpl: options.fetchImpl, csrfToken: () => csrfToken })

  async function guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'SESSION_REQUIRED' || error.code === 'SESSION_EXPIRED')) options.onUnauthorized?.()
      throw error
    }
  }

  // Ante CSRF_INVALID se renueva la sesión y se repite la escritura una sola vez.
  async function write<T>(send: (target: string, request?: RequestOptions) => Promise<T>, target: string, request?: RequestOptions): Promise<T> {
    try {
      return await send(target, request)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'CSRF_INVALID') throw error
      const session = M.parse(S.SessionDto, await raw.get('/session'), 'session')
      csrfToken = session.csrfToken
      return send(target, request)
    }
  }

  const http: HttpClient = {
    get: <T>(target: string, request?: RequestOptions) => guard(() => raw.get<T>(target, request)),
    post: <T>(target: string, request?: RequestOptions) => guard(() => write<T>((p, r) => raw.post<T>(p, r), target, request)),
    put: <T>(target: string, request?: RequestOptions) => guard(() => write<T>((p, r) => raw.put<T>(p, r), target, request)),
    delete: <T>(target: string, request?: RequestOptions) => guard(() => write<T>((p, r) => raw.delete<T>(p, r), target, request))
  }

  const list = async <T extends z.ZodType, R>(target: string, schema: T, map: (dto: z.output<T>) => R, what: string, request?: RequestOptions) =>
    M.parse(S.ListOf(schema), await http.get(target, request), what).items.map(map)

  const keepSession = (dto: z.output<typeof S.SessionDto>) => {
    csrfToken = dto.csrfToken
    return M.toSession(dto)
  }

  return {
    auth: {
      async getSession(signal) {
        return keepSession(M.parse(S.SessionDto, await raw.get('/session', { signal }), 'session'))
      },
      async signIn(email, password) {
        // Inicia sin token: el servidor emite uno nuevo con la sesión.
        return keepSession(M.parse(S.SessionDto, await raw.post('/session', { body: { email, password } }), 'session'))
      },
      async signOut() {
        return keepSession(M.parse(S.SessionDto, await raw.delete('/session'), 'session'))
      }
    },

    reference: {
      async load(signal) {
        const started = Date.now()
        const data = M.toReference(M.parse(S.ReferenceDto, await http.get('/reference-data', { signal }), 'reference-data'))
        syncClock(data.serverNow, started)
        return data
      }
    },

    movies: {
      list: signal => list('/movies', S.MovieDto, M.toMovie, 'movies', { signal }),
      async create(input) {
        return M.toMovie(M.parse(S.MovieDto, await http.post('/movies', { body: M.fromMovie(input) }), 'movie'))
      },
      async update(id, input) {
        return M.toMovie(M.parse(S.MovieDto, await http.put(path('/movies/{id}', id), { body: M.fromMovie(input) }), 'movie'))
      },
      async remove(id, version) {
        await http.delete(path('/movies/{id}', id), { query: { version } })
      }
    },

    screenings: {
      list: (query, signal) => list('/screenings', S.ScreeningDto, M.toScreening, 'screenings', {
        signal, query: { from: query.from, to: query.to, complexId: query.complexId, movieId: query.movieId }
      }),
      async preview(request, signal) {
        return M.toSchedulePlan(M.parse(S.SchedulePlanDto, await http.post('/screening-batches/preview', { body: request, signal }), 'schedule-plan'))
      },
      async createBatch(request, excludedKeys, idempotencyKey) {
        const body = await http.post('/screening-batches', { body: { ...request, excludedKeys }, idempotencyKey })
        return M.parse(S.ListOf(S.ScreeningDto), body, 'screening-batch').items.map(M.toScreening)
      },
      async update(id, input) {
        return M.toScreening(M.parse(S.ScreeningDto, await http.put(path('/screenings/{id}', id), { body: input }), 'screening'))
      },
      async remove(ids) {
        await http.post('/screenings/removals', { body: { ids } })
      }
    },

    complexes: {
      async update(complex) {
        const { roomCount: _r, seatCount: _s, cityName: _c, ...body } = complex
        return M.toComplex(M.parse(S.ComplexDto, await http.put(path('/complexes/{id}', complex.id), { body }), 'complex'))
      },
      listRooms: (complexId, signal) => list(path('/complexes/{id}/rooms', complexId), S.RoomDto, M.toRoom, 'rooms', { signal }),
      async updateRoom(room) {
        const body = { version: room.version, name: room.name, type: room.type.code, projections: room.projections.map(p => p.code) }
        return M.toRoom(M.parse(S.RoomDto, await http.put(path('/rooms/{id}', room.id), { body }), 'room'))
      },
      async getSeatTemplate(roomId, signal) {
        return M.toSeatTemplate(M.parse(S.SeatTemplateDto, await http.get(path('/rooms/{id}/seat-template', roomId), { signal }), 'seat-template'))
      },
      async saveSeatTemplate(template) {
        const body = await http.put(path('/rooms/{id}/seat-template', template.roomId), { body: template })
        return M.toSeatTemplate(M.parse(S.SeatTemplateDto, body, 'seat-template'))
      }
    },

    prices: {
      listTicketTypes: signal => list('/ticket-types', S.TicketTypeDto, M.toTicketType, 'ticket-types', { signal }),
      async saveTicketType(type) {
        const body = { version: type.version, name: type.name, description: type.description, isPromotional: type.isPromotional, fixedPrice: type.fixedPriceCents === null ? null : M.money(type.fixedPriceCents) }
        const response = type.id ? await http.put(path('/ticket-types/{id}', type.id), { body }) : await http.post('/ticket-types', { body })
        return M.toTicketType(M.parse(S.TicketTypeDto, response, 'ticket-type'))
      },
      async getSheet(complexId, signal) {
        return M.toPriceSheet(M.parse(S.PriceSheetDto, await http.get(path('/complexes/{id}/ticket-prices', complexId), { signal }), 'ticket-prices'))
      },
      async saveSheet(complexId, version, prices) {
        const body = {
          version,
          prices: prices.map(p => ({ roomType: p.roomType, projection: p.projection, ticketTypeId: p.ticketTypeId, price: M.money(p.priceCents), onlineFee: M.money(p.onlineFeeCents) }))
        }
        return M.toPriceSheet(M.parse(S.PriceSheetDto, await http.put(path('/complexes/{id}/ticket-prices', complexId), { body }), 'ticket-prices'))
      }
    },

    products: {
      listCategories: signal => list('/product-categories', z.object({ id: z.string(), name: z.string() }), c => c, 'product-categories', { signal }),
      async createCategory(name) {
        return M.parse(z.object({ id: z.string(), name: z.string() }), await http.post('/product-categories', { body: { name } }), 'product-category')
      },
      list: signal => list('/products', S.ProductDto, M.toProduct, 'products', { signal }),
      async create(input) {
        return M.toProduct(M.parse(S.ProductDto, await http.post('/products', { body: M.fromProduct(input) }), 'product'))
      },
      async update(id, input) {
        return M.toProduct(M.parse(S.ProductDto, await http.put(path('/products/{id}', id), { body: M.fromProduct(input) }), 'product'))
      },
      catalog: (complexId, signal) => list(path('/complexes/{id}/catalog', complexId), S.CatalogEntryDto, M.toCatalogEntry, 'catalog', { signal }),
      async saveCatalogEntry(complexId, productId, input) {
        const body = await http.put(path('/complexes/{id}/catalog/{productId}', complexId, productId), { body: M.fromCatalogEntry(input) })
        return M.toCatalogEntry(M.parse(S.CatalogEntryDto, body, 'catalog-entry'))
      },
      async removeCatalogEntry(complexId, productId, version) {
        await http.delete(path('/complexes/{id}/catalog/{productId}', complexId, productId), { query: { version } })
      },
      priceHistory: (complexId, signal) => list(path('/complexes/{id}/price-history', complexId), S.PriceChangeDto, M.toPriceChange, 'price-history', { signal }),
      async adjustStock(complexId, productId, input) {
        const body = await http.post(path('/complexes/{id}/catalog/{productId}/stock-adjustments', complexId, productId), { body: input })
        return M.toCatalogEntry(M.parse(S.CatalogEntryDto, body, 'catalog-entry'))
      },
      stockMovements: (complexId, signal) => list(path('/complexes/{id}/stock-movements', complexId), S.StockMovementDto, M.toStockMovement, 'stock-movements', { signal })
    },

    promotions: {
      list: signal => list('/promotions', S.PromotionDto, M.toPromotion, 'promotions', { signal }),
      async create(input) {
        return M.toPromotion(M.parse(S.PromotionDto, await http.post('/promotions', { body: input }), 'promotion'))
      },
      async update(id, input) {
        return M.toPromotion(M.parse(S.PromotionDto, await http.put(path('/promotions/{id}', id), { body: input }), 'promotion'))
      },
      listClubLevels: signal => list('/club-levels', S.ClubLevelDto, M.toClubLevel, 'club-levels', { signal }),
      async saveClubLevel(level) {
        return M.toClubLevel(M.parse(S.ClubLevelDto, await http.put(path('/club-levels/{id}', level.id), { body: level }), 'club-level'))
      }
    },

    orders: {
      async list(query, signal) {
        const body = await http.get('/orders', { signal, query: { ...query } })
        const page = M.parse(S.OrderPageDto, body, 'orders')
        return { ...page, items: page.items.map(M.toOrderSummary) }
      },
      async get(id, signal) {
        return M.toOrderDetail(M.parse(S.OrderDetailDto, await http.get(path('/orders/{id}', id), { signal }), 'order'))
      },
      async cancel(id, reason, idempotencyKey) {
        const body = await http.post(path('/orders/{id}/cancellations', id), { body: { reason }, idempotencyKey })
        return M.toOrderDetail(M.parse(S.OrderDetailDto, body, 'order'))
      },
      async advanceFood(id) {
        return M.toOrderDetail(M.parse(S.OrderDetailDto, await http.post(path('/orders/{id}/food-status', id)), 'order'))
      }
    },

    content: {
      async getHome(signal) {
        return M.parse(S.HomeDto, await http.get('/content/home', { signal }), 'home')
      },
      async saveHome(content) {
        return M.parse(S.HomeDto, await http.put('/content/home', { body: content }), 'home')
      },
      listBanners: signal => list('/banners', S.BannerDto, M.toBanner, 'banners', { signal }),
      async createBanner(input) {
        return M.toBanner(M.parse(S.BannerDto, await http.post('/banners', { body: input }), 'banner'))
      },
      async updateBanner(id, input) {
        return M.toBanner(M.parse(S.BannerDto, await http.put(path('/banners/{id}', id), { body: input }), 'banner'))
      },
      async removeBanner(id, version) {
        await http.delete(path('/banners/{id}', id), { query: { version } })
      },
      async getFaq(signal) {
        return M.parse(S.FaqDto, await http.get('/content/faq', { signal }), 'faq')
      },
      async saveFaq(content) {
        return M.parse(S.FaqDto, await http.put('/content/faq', { body: content }), 'faq')
      },
      listPages: signal => list('/content/pages', S.PageDto, page => page, 'pages', { signal }),
      async savePage(page) {
        return M.parse(S.PageDto, await http.put(path('/content/pages/{slug}', page.slug), { body: page }), 'page')
      },
      async getPurchaseRules(signal) {
        return M.parse(S.PurchaseRulesDto, await http.get('/settings/purchase-rules', { signal }), 'purchase-rules')
      },
      async savePurchaseRules(rules) {
        return M.parse(S.PurchaseRulesDto, await http.put('/settings/purchase-rules', { body: rules }), 'purchase-rules')
      }
    },

    employees: {
      list: signal => list('/employees', S.EmployeeDto, M.toEmployee, 'employees', { signal }),
      async create(input) {
        return M.toEmployee(M.parse(S.EmployeeDto, await http.post('/employees', { body: M.fromEmployee(input) }), 'employee'))
      },
      async update(id, input) {
        return M.toEmployee(M.parse(S.EmployeeDto, await http.put(path('/employees/{id}', id), { body: M.fromEmployee(input) }), 'employee'))
      },
      listRoles: signal => list('/roles', S.RoleDto, M.toRole, 'roles', { signal }),
      async saveRole(role) {
        const { id, ...body } = role
        const response = id ? await http.put(path('/roles/{id}', id), { body }) : await http.post('/roles', { body })
        return M.toRole(M.parse(S.RoleDto, response, 'role'))
      }
    },

    reports: {
      dailySales: (from, to, signal) => list('/reports/daily-sales', S.DailySalesDto, M.toDailySales, 'daily-sales', { signal, query: { from, to } }),
      activity: (limit, signal) => list('/activity', S.ActivityDto, M.toActivity, 'activity', { signal, query: { limit } })
    }
  }
}
