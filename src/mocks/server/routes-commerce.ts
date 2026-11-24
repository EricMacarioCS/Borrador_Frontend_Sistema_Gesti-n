/** Tarifas, dulcería, promociones y Club. */
import { PROJECTIONS, ROOM_TYPES } from '../fixtures'
import type { CatalogRec, ProductRec, PromotionRec, RuleRec } from '../store'
import {
  body, cents, checkVersion, fail, integer, invalid, isoDate, list, logActivity, money, nextId, noContent, nullableText, ok,
  requireScope, route, strings, text, type Context
} from './core'
import { catalogJson, productJson } from './views'

/* Tipos de boleto y tarifas */

const ticketTypeJson = (t: { id: string; version: number; name: string; description: string; isPromotional: boolean; fixedPriceCents: number | null }) => ({
  id: t.id, version: t.version, name: t.name, description: t.description, isPromotional: t.isPromotional,
  fixedPrice: t.fixedPriceCents === null ? null : money(t.fixedPriceCents)
})

route('GET', '/ticket-types', 'any', ctx => ok({ items: ctx.state.ticketTypes.map(ticketTypeJson) }))

function saveTicketType(ctx: Context, id: string | null) {
  const input = body(ctx)
  const name = text(input, 'name', 'el nombre', { max: 60 })
  if (ctx.state.ticketTypes.some(t => t.id !== id && t.name.toLowerCase() === name.toLowerCase())) fail(409, 'DUPLICATE', 'Ya existe un tipo de boleto con ese nombre.')
  const fixed = input.fixedPrice === null || input.fixedPrice === undefined ? null : cents(input.fixedPrice, 'El precio fijo', 'fixedPrice', 1)
  const values = { name, description: text(input, 'description', 'la descripción', { optional: true, max: 200 }), isPromotional: input.isPromotional === true, fixedPriceCents: fixed }
  if (id) {
    const current = ctx.state.ticketTypes.find(t => t.id === id) ?? fail(404, 'NOT_FOUND')
    checkVersion(current, input.version)
    Object.assign(current, values, { version: current.version + 1 })
    logActivity(ctx, 'Tarifas', `Actualizó el tipo de boleto ${name}.`)
    return ok(ticketTypeJson(current))
  }
  const created = { id: nextId(ctx.state, 'tt'), version: 1, ...values }
  ctx.state.ticketTypes.push(created)
  logActivity(ctx, 'Tarifas', `Creó el tipo de boleto ${name}.`)
  return ok(ticketTypeJson(created), 201)
}
route('POST', '/ticket-types', 'prices.manage', ctx => saveTicketType(ctx, null))
route('PUT', '/ticket-types/:id', 'prices.manage', ctx => saveTicketType(ctx, ctx.params[0]!))

const sheetJson = (complexId: string, sheet: { version: number; prices: { roomType: string; projection: string; ticketTypeId: string; priceCents: number; onlineFeeCents: number }[] }) => ({
  complexId, version: sheet.version,
  prices: sheet.prices.map(p => ({ roomType: p.roomType, projection: p.projection, ticketTypeId: p.ticketTypeId, price: money(p.priceCents), onlineFee: money(p.onlineFeeCents) }))
})

route('GET', '/complexes/:id/ticket-prices', 'any', ctx => {
  const sheet = ctx.state.priceSheets[ctx.params[0]!] ?? fail(404, 'NOT_FOUND')
  return ok(sheetJson(ctx.params[0]!, sheet))
})

route('PUT', '/complexes/:id/ticket-prices', 'prices.manage', ctx => {
  const complexId = ctx.params[0]!
  const sheet = ctx.state.priceSheets[complexId] ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(sheet, input.version)
  const seen = new Set<string>()
  const prices = list(input, 'prices').map(raw => {
    const p = raw as Record<string, unknown>
    const roomType = String(p.roomType)
    const projection = String(p.projection)
    const ticketTypeId = String(p.ticketTypeId)
    if (!ROOM_TYPES.some(t => t.code === roomType) || !PROJECTIONS.some(x => x.code === projection)) invalid('Combinación de sala o proyección desconocida.', 'prices')
    const type = ctx.state.ticketTypes.find(t => t.id === ticketTypeId) ?? invalid('Tipo de boleto desconocido.', 'prices')
    if (type.fixedPriceCents !== null) invalid(`${type.name} tiene precio fijo: no lleva tarifa por complejo.`, 'prices')
    const key = `${roomType}|${projection}|${ticketTypeId}`
    if (seen.has(key)) invalid('Hay precios repetidos.', 'prices')
    seen.add(key)
    return { roomType, projection, ticketTypeId, priceCents: cents(p.price, 'Un precio', 'prices', 1), onlineFeeCents: cents(p.onlineFee, 'Un cargo por servicio', 'prices') }
  })
  ctx.state.priceSheets[complexId] = { version: sheet.version + 1, prices }
  logActivity(ctx, 'Tarifas', `Actualizó ${prices.length} precios de ${ctx.state.complexes.find(c => c.id === complexId)?.name}.`)
  return ok(sheetJson(complexId, ctx.state.priceSheets[complexId]))
})

/* Dulcería: productos de la cadena */

route('GET', '/product-categories', 'any', ctx => ok({ items: ctx.state.categories }))

/** Los productos son de toda la cadena: solo quien la administra completa puede definirlos. */
function requireChain(ctx: Context) {
  if (ctx.user.complexIds !== null) fail(403, 'FORBIDDEN', 'Solo el administrador de la cadena define productos.')
}

route('POST', '/product-categories', 'products.manage', ctx => {
  requireChain(ctx)
  const name = text(body(ctx), 'name', 'el nombre', { max: 60 })
  if (ctx.state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) fail(409, 'DUPLICATE', 'Esa categoría ya existe.')
  const category = { id: nextId(ctx.state, 'cat'), name }
  ctx.state.categories.push(category)
  logActivity(ctx, 'Dulcería', `Creó la categoría ${name}.`)
  return ok(category, 201)
})

route('GET', '/products', 'any', ctx => ok({ items: ctx.state.products.map(p => productJson(ctx.state, p)) }))

function readProduct(ctx: Context, current: ProductRec | null): Omit<ProductRec, 'id' | 'version'> {
  const input = body(ctx)
  const name = text(input, 'name', 'el nombre', { max: 120 })
  if (ctx.state.products.some(p => p.id !== current?.id && p.name.toLowerCase() === name.toLowerCase())) fail(409, 'DUPLICATE', 'Ya existe un producto con ese nombre.')
  const categoryId = text(input, 'categoryId', 'la categoría')
  if (!ctx.state.categories.some(c => c.id === categoryId)) invalid('La categoría no existe.', 'categoryId')
  const structure = String(input.structure)
  if (!['simple', 'compound', 'combo'].includes(structure)) invalid('Estructura desconocida.', 'structure')
  const rules: RuleRec[] = list(input, 'rules').map(raw => {
    const r = raw as Record<string, unknown>
    const title = text(r, 'title', 'el título de cada regla', { max: 80 })
    const min = integer(r, 'min', `${title}: mínimo`, 0, 20)
    const max = integer(r, 'max', `${title}: máximo`, 1, 20)
    if (min > max) invalid(`${title}: el mínimo no puede ser mayor que el máximo.`, 'rules')
    const options = list(r, 'options').map(rawOption => {
      const o = rawOption as Record<string, unknown>
      const known = typeof o.id === 'string' && !o.id.startsWith('tmp-')
      return {
        id: known ? o.id as string : nextId(ctx.state, 'opt'), apiId: nullableText(o, 'apiId', 'El ID de Vista'),
        name: text(o, 'name', 'el nombre de cada opción', { max: 80 }), extraCents: cents(o.extra, `${title}: precio adicional`, 'rules'), isDefault: o.isDefault === true
      }
    })
    if (!options.length) invalid(`${title}: agrega al menos una opción.`, 'rules')
    if (min > options.length) invalid(`${title}: pide más opciones de las que existen.`, 'rules')
    const kind = ['size', 'flavor', 'extra', 'choice'].includes(String(r.kind)) ? String(r.kind) : 'choice'
    const id = typeof r.id === 'string' && !r.id.startsWith('tmp-') ? r.id : nextId(ctx.state, 'rule')
    return { id, title, kind, min, max: Math.min(max, options.length), allowSplit: r.allowSplit === true && max > 1, options }
  })
  if (structure === 'simple' && rules.length) invalid('Un producto simple no tiene opciones. Cámbialo a configurable o combo.', 'structure')
  if (structure !== 'simple' && !rules.length) invalid('Agrega al menos una regla de personalización.', 'rules')
  return {
    apiId: nullableText(input, 'apiId', 'El ID de Vista'), name, description: text(input, 'description', 'la descripción', { optional: true, max: 400 }),
    imageUrl: nullableText(input, 'imageUrl', 'La imagen'), categoryId, structure, requiresTicketCode: input.requiresTicketCode !== false, rules
  }
}

/** Al cambiar las opciones de un producto, los catálogos de los complejos se ajustan: las nuevas entran activas. */
function syncCatalogs(ctx: Context, product: ProductRec) {
  const options = product.rules.flatMap(rule => rule.options)
  for (const entries of Object.values(ctx.state.catalogs)) {
    const entry = entries.find(e => e.productId === product.id)
    if (!entry) continue
    entry.options = options.map(option => entry.options.find(o => o.optionId === option.id) ?? { optionId: option.id, active: true, extraCents: option.extraCents })
  }
}

route('POST', '/products', 'products.manage', ctx => {
  requireChain(ctx)
  const product: ProductRec = { id: nextId(ctx.state, 'p'), version: 1, ...readProduct(ctx, null) }
  ctx.state.products.push(product)
  logActivity(ctx, 'Dulcería', `Creó el producto ${product.name}.`)
  return ok(productJson(ctx.state, product), 201)
})

route('PUT', '/products/:id', 'products.manage', ctx => {
  requireChain(ctx)
  const product = ctx.state.products.find(p => p.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  checkVersion(product, body(ctx).version)
  Object.assign(product, readProduct(ctx, product), { version: product.version + 1 })
  syncCatalogs(ctx, product)
  logActivity(ctx, 'Dulcería', `Actualizó el producto ${product.name}.`)
  return ok(productJson(ctx.state, product))
})

/* Dulcería: catálogo, precios y disponibilidad de cada complejo */

route('GET', '/complexes/:id/catalog', 'any', ctx => {
  const entries = ctx.state.catalogs[ctx.params[0]!] ?? fail(404, 'NOT_FOUND')
  return ok({ items: entries.map(entry => catalogJson(ctx.state, ctx.params[0]!, entry)) })
})

route('PUT', '/complexes/:id/catalog/:productId', 'products.manage', ctx => {
  const [complexId, productId] = ctx.params as [string, string]
  requireScope(ctx, complexId)
  const entries = ctx.state.catalogs[complexId] ?? fail(404, 'NOT_FOUND')
  const product = ctx.state.products.find(p => p.id === productId) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  const priceCents = cents(input.price, 'El precio', 'price', 1)
  const optionIds = product.rules.flatMap(rule => rule.options.map(option => option.id))
  const options = list(input, 'optionSettings').map(raw => {
    const o = raw as Record<string, unknown>
    if (!optionIds.includes(String(o.optionId))) invalid('Opción desconocida.', 'optionSettings')
    return { optionId: String(o.optionId), active: o.active !== false, extraCents: cents(o.extra, 'Un precio adicional', 'optionSettings') }
  })
  // Cada regla obligatoria debe conservar suficientes opciones activas.
  for (const rule of product.rules) {
    const active = rule.options.filter(option => options.find(o => o.optionId === option.id)?.active ?? true).length
    if (active < Math.max(rule.min, 1)) invalid(`${rule.title}: deja al menos ${Math.max(rule.min, 1)} opción activa.`, 'optionSettings')
  }
  const complexName = ctx.state.complexes.find(c => c.id === complexId)?.name
  let entry = entries.find(e => e.productId === productId)
  if (entry) {
    checkVersion(entry, input.version)
    if (entry.priceCents !== priceCents) {
      // Igual que historial_producto: cada cambio de precio queda registrado.
      (ctx.state.priceHistory[complexId] ??= []).unshift({ id: nextId(ctx.state, 'ph'), productId, previousCents: entry.priceCents, newCents: priceCents, changedAt: new Date(ctx.now).toISOString() })
      logActivity(ctx, 'Dulcería', `Cambió el precio de ${product.name} en ${complexName}.`)
    }
    Object.assign(entry, { priceCents, available: input.available !== false, options, version: entry.version + 1 })
  } else {
    entry = { productId, version: 1, priceCents, available: input.available !== false, options } satisfies CatalogRec
    entries.push(entry)
    logActivity(ctx, 'Dulcería', `Agregó ${product.name} al catálogo de ${complexName}.`)
  }
  return ok(catalogJson(ctx.state, complexId, entry))
})

route('DELETE', '/complexes/:id/catalog/:productId', 'products.manage', ctx => {
  const [complexId, productId] = ctx.params as [string, string]
  requireScope(ctx, complexId)
  const entries = ctx.state.catalogs[complexId] ?? fail(404, 'NOT_FOUND')
  const entry = entries.find(e => e.productId === productId) ?? fail(404, 'NOT_FOUND')
  checkVersion(entry, Number(ctx.request.query.get('version')))
  ctx.state.catalogs[complexId] = entries.filter(e => e !== entry)
  logActivity(ctx, 'Dulcería', `Quitó ${ctx.state.products.find(p => p.id === productId)?.name} del catálogo de ${ctx.state.complexes.find(c => c.id === complexId)?.name}.`)
  return noContent()
})

route('GET', '/complexes/:id/price-history', 'any', ctx => ok({
  items: (ctx.state.priceHistory[ctx.params[0]!] ?? []).map(change => ({
    id: change.id, productName: ctx.state.products.find(p => p.id === change.productId)?.name ?? 'Producto retirado',
    previous: money(change.previousCents), current: money(change.newCents), changedAt: change.changedAt
  }))
}))

/** Sin inventario: el personal marca a mano si el producto está disponible en el complejo. */
route('PUT', '/complexes/:id/catalog/:productId/availability', 'products.manage', ctx => {
  const [complexId, productId] = ctx.params as [string, string]
  requireScope(ctx, complexId)
  const entry = ctx.state.catalogs[complexId]?.find(e => e.productId === productId) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(entry, input.version)
  if (typeof input.available !== 'boolean') invalid('Indica si el producto está disponible.', 'available')
  Object.assign(entry, { available: input.available, version: entry.version + 1 })
  const productName = ctx.state.products.find(p => p.id === productId)?.name
  const complexName = ctx.state.complexes.find(c => c.id === complexId)?.name
  logActivity(ctx, 'Dulcería', `Marcó ${productName} como ${input.available ? 'disponible' : 'no disponible'} en ${complexName}.`)
  return ok(catalogJson(ctx.state, complexId, entry))
})

/* Promociones y Club */

route('GET', '/promotions', 'any', ctx => ok({ items: ctx.state.promotions }))

function readPromotion(ctx: Context): Omit<PromotionRec, 'id' | 'version'> {
  const input = body(ctx)
  const kind = String(input.kind)
  if (!['2x1', 'percent', 'double-points', 'informative'].includes(kind)) invalid('Tipo de promoción desconocido.', 'kind')
  const validFrom = isoDate(input, 'validFrom', 'Inicio de vigencia')!
  const validTo = isoDate(input, 'validTo', 'Fin de vigencia', true)
  if (validTo && validTo < validFrom) invalid('La vigencia termina antes de empezar.', 'validTo')
  const appliesToAll = input.appliesToAll === true
  const complexIds = appliesToAll ? [] : strings(input, 'complexIds')
  if (!appliesToAll && !complexIds.length) invalid('Elige los complejos o márcala para toda la cadena.', 'complexIds')
  const rules = (input.rules ?? {}) as Record<string, unknown>
  const percent = rules.percent === null || rules.percent === undefined ? null : Number(rules.percent)
  if (kind === 'percent' && (percent === null || !(percent > 0 && percent <= 100))) invalid('El porcentaje va de 1 a 100.', 'rules')
  const clubLevelId = typeof input.clubLevelId === 'string' && input.clubLevelId ? input.clubLevelId : null
  if (clubLevelId && !ctx.state.clubLevels.some(level => level.id === clubLevelId)) invalid('Nivel del Club desconocido.', 'clubLevelId')
  return {
    name: text(input, 'name', 'el nombre', { max: 120 }), kind, description: text(input, 'description', 'la descripción', { max: 500 }),
    restrictions: text(input, 'restrictions', 'las restricciones', { max: 1000 }), validFrom, validTo, appliesToAll, complexIds, clubLevelId,
    rules: {
      weekdays: list(rules, 'weekdays').map(day => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6 ? day : invalid('Día de la semana inválido.', 'rules')),
      roomTypes: strings(rules, 'roomTypes'), projections: strings(rules, 'projections'), percent: kind === 'percent' ? percent : null
    }
  }
}

route('POST', '/promotions', 'promotions.manage', ctx => {
  const promotion: PromotionRec = { id: nextId(ctx.state, 'promo'), version: 1, ...readPromotion(ctx) }
  ctx.state.promotions.unshift(promotion)
  logActivity(ctx, 'Promociones', `Creó la promoción ${promotion.name}.`)
  return ok(promotion, 201)
})

route('PUT', '/promotions/:id', 'promotions.manage', ctx => {
  const promotion = ctx.state.promotions.find(p => p.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  checkVersion(promotion, body(ctx).version)
  Object.assign(promotion, readPromotion(ctx), { version: promotion.version + 1 })
  logActivity(ctx, 'Promociones', `Actualizó la promoción ${promotion.name}.`)
  return ok(promotion)
})

route('GET', '/club-levels', 'any', ctx => ok({ items: ctx.state.clubLevels }))

route('PUT', '/club-levels/:id', 'promotions.manage', ctx => {
  const level = ctx.state.clubLevels.find(l => l.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(level, input.version)
  const minVisits = integer(input, 'minVisits', 'Visitas mínimas', 0, 365)
  const maxVisits = input.maxVisits === null ? null : integer(input, 'maxVisits', 'Visitas máximas', 0, 365)
  if (maxVisits !== null && maxVisits < minVisits) invalid('Las visitas máximas no pueden ser menores que las mínimas.', 'maxVisits')
  const pointsPercent = Number(input.pointsPercent)
  if (!(pointsPercent >= 0 && pointsPercent <= 100)) invalid('El porcentaje de puntos va de 0 a 100.', 'pointsPercent')
  Object.assign(level, {
    name: text(input, 'name', 'el nombre', { max: 60 }), minVisits, maxVisits, pointsPercent,
    benefits: text(input, 'benefits', 'los beneficios', { optional: true, max: 1000 }), version: level.version + 1
  })
  logActivity(ctx, 'Club', `Actualizó el nivel ${level.name}.`)
  return ok(level)
})
