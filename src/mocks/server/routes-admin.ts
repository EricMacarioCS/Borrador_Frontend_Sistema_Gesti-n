/** Contenido del sitio, reglas de compra, empleados, roles y bitácora. */
import { addDays } from '@/shared/lib/datetime'
import type { BannerRec, EmployeeRec } from '../store'
import {
  body, cents, checkVersion, fail, integer, invalid, inScope, isoDate, list, logActivity, nextId, noContent, nullableText, ok, requireChain, requireScope, route,
  strings, text, type Context
} from './core'
import { employeeJson } from './views'

/* Portada y banners */

route('GET', '/content/home', 'any', ctx => ok(ctx.state.home))

route('PUT', '/content/home', 'content.manage', ctx => {
  const input = body(ctx)
  checkVersion(ctx.state.home, input.version)
  const ids = strings(input, 'featuredMovieIds')
  if (!ids.length) invalid('Elige al menos una película para la portada.', 'featuredMovieIds')
  if (ids.length > 8) invalid('La portada admite hasta 8 películas.', 'featuredMovieIds')
  if (ids.some(id => !ctx.state.movies.some(m => m.id === id))) invalid('Una de las películas ya no existe.', 'featuredMovieIds')
  ctx.state.home = { version: ctx.state.home.version + 1, featuredMovieIds: [...new Set(ids)] }
  logActivity(ctx, 'Contenido', 'Actualizó la portada del sitio.')
  return ok(ctx.state.home)
})

route('GET', '/banners', 'any', ctx => ok({ items: ctx.state.banners }))

function readBanner(ctx: Context): Omit<BannerRec, 'id' | 'version'> {
  const input = body(ctx)
  const startsOn = isoDate(input, 'startsOn', 'Inicio')!
  const endsOn = isoDate(input, 'endsOn', 'Fin', true)
  if (endsOn && endsOn < startsOn) invalid('El banner termina antes de empezar.', 'endsOn')
  const appliesToAll = input.appliesToAll === true
  const complexIds = appliesToAll ? [] : strings(input, 'complexIds')
  if (!appliesToAll && !complexIds.length) invalid('Elige los complejos o márcalo para toda la cadena.', 'complexIds')
  const targetUrl = text(input, 'targetUrl', 'el enlace', { max: 300 })
  if (!targetUrl.startsWith('/') && !/^https:\/\//.test(targetUrl)) invalid('El enlace debe empezar con / o https://', 'targetUrl')
  return {
    title: text(input, 'title', 'el título', { max: 120 }), imageUrl: text(input, 'imageUrl', 'la imagen', { max: 300 }), targetUrl,
    startsOn, endsOn, active: input.active !== false, appliesToAll, complexIds
  }
}

route('POST', '/banners', 'content.manage', ctx => {
  const banner: BannerRec = { id: nextId(ctx.state, 'ban'), version: 1, ...readBanner(ctx) }
  ctx.state.banners.unshift(banner)
  logActivity(ctx, 'Contenido', `Creó el banner ${banner.title}.`)
  return ok(banner, 201)
})

route('PUT', '/banners/:id', 'content.manage', ctx => {
  const banner = ctx.state.banners.find(b => b.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  checkVersion(banner, body(ctx).version)
  Object.assign(banner, readBanner(ctx), { version: banner.version + 1 })
  logActivity(ctx, 'Contenido', `Actualizó el banner ${banner.title}.`)
  return ok(banner)
})

route('DELETE', '/banners/:id', 'content.manage', ctx => {
  const banner = ctx.state.banners.find(b => b.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  checkVersion(banner, Number(ctx.request.query.get('version')))
  ctx.state.banners = ctx.state.banners.filter(b => b !== banner)
  logActivity(ctx, 'Contenido', `Eliminó el banner ${banner.title}.`)
  return noContent()
})

/* Preguntas, páginas y reglas de compra */

route('GET', '/content/faq', 'any', ctx => ok(ctx.state.faq))

route('PUT', '/content/faq', 'content.manage', ctx => {
  const input = body(ctx)
  checkVersion(ctx.state.faq, input.version)
  const items = list(input, 'items').map(raw => {
    const item = raw as Record<string, unknown>
    return { question: text(item, 'question', 'cada pregunta', { max: 300 }), answer: text(item, 'answer', 'cada respuesta', { max: 2000 }) }
  })
  ctx.state.faq = { version: ctx.state.faq.version + 1, items }
  logActivity(ctx, 'Contenido', 'Actualizó las preguntas frecuentes.')
  return ok(ctx.state.faq)
})

route('GET', '/content/pages', 'any', ctx => ok({ items: ctx.state.pages }))

route('PUT', '/content/pages/:slug', 'content.manage', ctx => {
  const page = ctx.state.pages.find(p => p.slug === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(page, input.version)
  Object.assign(page, { title: text(input, 'title', 'el título', { max: 120 }), body: text(input, 'body', 'el texto', { max: 20000 }), version: page.version + 1 })
  logActivity(ctx, 'Contenido', `Actualizó la página ${page.title}.`)
  return ok(page)
})

route('GET', '/settings/purchase-rules', 'any', ctx => ok(ctx.state.rules))

route('PUT', '/settings/purchase-rules', 'content.manage', ctx => {
  const input = body(ctx)
  checkVersion(ctx.state.rules, input.version)
  ctx.state.rules = {
    version: ctx.state.rules.version + 1,
    maxSeatsPerPurchase: integer(input, 'maxSeatsPerPurchase', 'Asientos por compra', 1, 30),
    holdMinutes: integer(input, 'holdMinutes', 'Minutos de apartado', 5, 30),
    cancelMinutesBefore: integer(input, 'cancelMinutesBefore', 'Minutos para cancelar', 0, 1440),
    scheduleDays: integer(input, 'scheduleDays', 'Días de cartelera', 1, 60)
  }
  logActivity(ctx, 'Contenido', 'Actualizó las reglas de compra.')
  return ok(ctx.state.rules)
})

/* Empleados y roles */

route('GET', '/employees', 'employees.manage', ctx => ok({ items: ctx.state.employees.filter(e => inScope(ctx, e.complexId)).map(employeeJson) }))

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readEmployee(ctx: Context, current: EmployeeRec | null): Omit<EmployeeRec, 'id' | 'version'> {
  const input = body(ctx)
  const email = nullableText(input, 'email', 'El correo')?.toLowerCase() ?? null
  if (email && !EMAIL.test(email)) invalid('Escribe un correo válido.', 'email')
  if (email && ctx.state.employees.some(e => e.id !== current?.id && e.email === email)) fail(409, 'DUPLICATE', 'Otro empleado ya usa ese correo.')
  const phone = nullableText(input, 'phone', 'El teléfono')
  if (phone && !/^\d{10}$/.test(phone)) invalid('El teléfono tiene 10 dígitos.', 'phone')
  const birthDate = isoDate(input, 'birthDate', 'Fecha de nacimiento')!
  const hiredOn = isoDate(input, 'hiredOn', 'Fecha de contratación')!
  // La edad mínima para trabajar en México es de 15 años; aquí se pide 16 como política interna de ejemplo.
  if (birthDate > addDays(hiredOn, -16 * 365)) invalid('La persona debe tener al menos 16 años al contratarse.', 'birthDate')
  const complexId = text(input, 'complexId', 'el complejo')
  if (!ctx.state.complexes.some(c => c.id === complexId)) invalid('El complejo no existe.', 'complexId')
  // No se puede registrar ni trasladar personal a un complejo ajeno.
  requireScope(ctx, complexId)
  const roleId = text(input, 'roleId', 'el puesto')
  if (!ctx.state.roles.some(r => r.id === roleId)) invalid('El puesto no existe.', 'roleId')
  const status = String(input.status)
  if (!['active', 'leave', 'inactive'].includes(status)) invalid('Estado desconocido.', 'status')
  return {
    firstName: text(input, 'firstName', 'el nombre', { max: 60 }), lastName: text(input, 'lastName', 'el apellido paterno', { max: 60 }),
    secondLastName: nullableText(input, 'secondLastName', 'El apellido materno'), email, phone, birthDate, hiredOn,
    salaryCents: cents(input.salary, 'El salario', 'salary', 1), status, complexId, roleId
  }
}

route('POST', '/employees', 'employees.manage', ctx => {
  const employee: EmployeeRec = { id: nextId(ctx.state, 'emp'), version: 1, ...readEmployee(ctx, null) }
  ctx.state.employees.unshift(employee)
  logActivity(ctx, 'Empleados', `Registró a ${employee.firstName} ${employee.lastName}.`)
  return ok(employeeJson(employee), 201)
})

route('PUT', '/employees/:id', 'employees.manage', ctx => {
  const employee = ctx.state.employees.find(e => e.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  requireScope(ctx, employee.complexId)
  checkVersion(employee, body(ctx).version)
  Object.assign(employee, readEmployee(ctx, employee), { version: employee.version + 1 })
  logActivity(ctx, 'Empleados', `Actualizó a ${employee.firstName} ${employee.lastName}.`)
  return ok(employeeJson(employee))
})

route('GET', '/roles', 'employees.manage', ctx => ok({ items: ctx.state.roles }))

function saveRole(ctx: Context, id: string | null) {
  requireChain(ctx, 'los puestos')
  const input = body(ctx)
  const name = text(input, 'name', 'el nombre del puesto', { max: 80 })
  if (ctx.state.roles.some(r => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) fail(409, 'DUPLICATE', 'Ese puesto ya existe.')
  const values = {
    name, isManager: input.isManager === true, responsibilities: text(input, 'responsibilities', 'las responsabilidades', { optional: true, max: 1000 }),
    area: text(input, 'area', 'el área', { optional: true, max: 80 })
  }
  if (id) {
    const role = ctx.state.roles.find(r => r.id === id) ?? fail(404, 'NOT_FOUND')
    checkVersion(role, input.version)
    Object.assign(role, values, { version: role.version + 1 })
    logActivity(ctx, 'Empleados', `Actualizó el puesto ${name}.`)
    return ok(role)
  }
  const role = { id: nextId(ctx.state, 'rol'), version: 1, ...values }
  ctx.state.roles.push(role)
  logActivity(ctx, 'Empleados', `Creó el puesto ${name}.`)
  return ok(role, 201)
}
route('POST', '/roles', 'employees.manage', ctx => saveRole(ctx, null))
route('PUT', '/roles/:id', 'employees.manage', ctx => saveRole(ctx, ctx.params[0]!))

/* Bitácora */

route('GET', '/activity', 'any', ctx => {
  const limit = Math.min(100, Math.max(1, Number(ctx.request.query.get('limit') ?? 20)))
  return ok({ items: ctx.state.activity.slice(0, limit) })
})
