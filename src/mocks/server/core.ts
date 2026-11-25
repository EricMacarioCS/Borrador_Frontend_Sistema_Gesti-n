/**
 * Núcleo del servidor simulado: enrutamiento, sesión, permisos, CSRF, concurrencia optimista e idempotencia.
 * Son las mismas garantías que debe dar el API real (ver docs/contrato-api.md).
 */
import type { Permission } from '@/domain/models'
import { ADMIN_PERMISSIONS, COMPLEX_PERMISSIONS } from '../fixtures'
import type { MockState, MockUser } from '../store'

export interface MockRequest {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  sid: string
  csrf: string | null
  idempotencyKey: string | null
}
export interface MockResponse { status: number; body?: unknown }

export class MockProblem extends Error {
  constructor(readonly status: number, readonly code: string, readonly detail?: string, readonly extra: Record<string, unknown> = {}) {
    super(code)
  }
}

export const fail = (status: number, code: string, detail?: string, extra?: Record<string, unknown>): never => {
  throw new MockProblem(status, code, detail, extra)
}
export const invalid = (detail: string, field?: string): never =>
  fail(422, 'VALIDATION_FAILED', detail, field ? { errors: { [field]: [detail] } } : {})

export interface Context {
  state: MockState
  request: MockRequest
  now: number
  user: MockUser
  params: string[]
  /** Marca que hubo cambios para guardar el estado. */
  changed: () => void
}

type Handler = (ctx: Context) => MockResponse
interface Route { method: string; pattern: RegExp; permission: Permission | 'any' | null; handler: Handler }
const routes: Route[] = []

/**
 * Registra una ruta. `permission`: `null` es pública, `'any'` exige sesión y lo demás exige ese permiso.
 */
export function route(method: string, path: string, permission: Permission | 'any' | null, handler: Handler) {
  routes.push({ method, pattern: new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`), permission, handler })
}

export const ok = (body: unknown, status = 200): MockResponse => ({ status, body })
export const noContent = (): MockResponse => ({ status: 204 })

export function randomToken(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, byte => (byte % 36).toString(36)).join('')
}

export function nextId(state: MockState, prefix: string) {
  state.seq++
  return `${prefix}-${state.seq}`
}

export function sessionOf(state: MockState, sid: string) {
  state.sessions[sid] ??= { csrf: randomToken(), userId: null, startedAt: Date.now() }
  return state.sessions[sid]
}

/** Resuelve la cuenta de la sesión. Una cuenta desactivada deja de tener acceso aunque su sesión siga abierta. */
export function userById(state: MockState, id: string | null): MockUser | null {
  const account = state.users.find(user => user.id === id)
  if (!account?.active) return null
  const employee = state.employees.find(e => e.id === account.employeeId)
  return {
    id: account.id, username: account.username, email: account.email, complexId: account.complexId,
    name: employee ? `${employee.firstName} ${employee.lastName}` : account.username,
    roleName: state.roles.find(role => role.id === account.roleId)?.name ?? 'Sin puesto',
    permissions: account.complexId === null ? ADMIN_PERMISSIONS : COMPLEX_PERMISSIONS
  }
}

/** Concurrencia optimista: rechaza un cambio hecho sobre una versión vieja. */
export function checkVersion(record: { version: number }, version: unknown) {
  if (typeof version !== 'number') fail(422, 'VALIDATION_FAILED', 'Falta la versión del registro.')
  if (record.version !== version) fail(409, 'VERSION_CONFLICT', undefined, { currentVersion: record.version })
}

/** El administrador alcanza todos los complejos; las demás cuentas, solo el que tienen asignado. */
export function inScope(ctx: Context, complexId: string) {
  return ctx.user.complexId === null || ctx.user.complexId === complexId
}
export function requireScope(ctx: Context, complexId: string) {
  if (!inScope(ctx, complexId)) fail(403, 'FORBIDDEN', 'Solo puedes modificar lo de tu complejo.')
}
/** Lo que es de toda la cadena solo lo cambia el administrador. */
export function requireChain(ctx: Context, what: string) {
  if (ctx.user.complexId !== null) fail(403, 'FORBIDDEN', `Solo el administrador puede modificar ${what}.`)
}

/** Bitácora de cambios: requiere tabla nueva en la BD (ver docs/mapeo-bd.md). */
export function logActivity(ctx: Context, area: string, summary: string) {
  ctx.state.activity.unshift({ id: nextId(ctx.state, 'act'), at: new Date(ctx.now).toISOString(), actor: ctx.user.name, area, summary })
  ctx.state.activity = ctx.state.activity.slice(0, 200)
}

/** Repetir la misma petición con la misma clave devuelve el resultado original. */
export function idempotent(ctx: Context, scope: string, run: () => unknown): unknown {
  const key = ctx.request.idempotencyKey ?? fail(400, 'MALFORMED_REQUEST', 'Falta Idempotency-Key.')
  const fingerprint = JSON.stringify(ctx.request.body ?? null)
  const saved = ctx.state.idempotency[`${ctx.user.id}|${scope}|${key}`]
  if (saved) {
    if (saved.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT')
    return saved.result
  }
  const result = run()
  ctx.state.idempotency[`${ctx.user.id}|${scope}|${key}`] = { fingerprint, result }
  return result
}

/* Lectura segura del cuerpo */

export function body(ctx: Context): Record<string, unknown> {
  const value = ctx.request.body
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'MALFORMED_REQUEST', 'Se esperaba un objeto JSON.')
  return value as Record<string, unknown>
}
export function text(source: Record<string, unknown>, key: string, label: string, options: { optional?: boolean; max?: number } = {}): string {
  const value = source[key]
  if (value === null || value === undefined || value === '') {
    if (options.optional) return ''
    return invalid(`Escribe ${label}.`, key)
  }
  if (typeof value !== 'string') return invalid(`${label} no es válido.`, key)
  const trimmed = value.trim()
  if (!trimmed && !options.optional) return invalid(`Escribe ${label}.`, key)
  if (trimmed.length > (options.max ?? 500)) invalid(`${label} es demasiado largo.`, key)
  return trimmed
}
export const nullableText = (source: Record<string, unknown>, key: string, label: string) => text(source, key, label, { optional: true }) || null
export function integer(source: Record<string, unknown>, key: string, label: string, min: number, max: number): number {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return invalid(`${label}: de ${min} a ${max}.`, key)
  return value
}
export function cents(source: unknown, label: string, field: string, min = 0): number {
  const money = source as { amount?: unknown; currency?: unknown } | null
  if (!money || money.currency !== 'MXN' || typeof money.amount !== 'number' || !Number.isSafeInteger(money.amount) || money.amount < min) {
    return invalid(`${label} no es un importe válido.`, field)
  }
  return money.amount
}
export function isoDate(source: Record<string, unknown>, key: string, label: string, optional = false): string | null {
  const value = source[key]
  if ((value === null || value === undefined || value === '') && optional) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid(`${label}: fecha inválida.`, key)
  return value
}
export function list(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key]
  if (!Array.isArray(value)) return invalid('Se esperaba una lista.', key)
  return value
}
export function strings(source: Record<string, unknown>, key: string): string[] {
  return list(source, key).map(item => typeof item === 'string' ? item : invalid('Se esperaba texto.', key))
}

export const money = (amount: number) => ({ amount, currency: 'MXN' as const })

/* Despacho */

/** Solo para rutas públicas: no tiene permisos ni alcance. */
const GUEST_USER: MockUser = { id: '', name: 'Invitado', username: '', email: '', roleName: '', permissions: [], complexId: '' }

export function dispatch(state: MockState, request: MockRequest, now: number): { response: MockResponse; changed: boolean } {
  let changed = false
  const match = routes.find(r => r.method === request.method && r.pattern.test(request.path))
  if (!match) return { response: problem(404, 'NOT_FOUND', `No existe ${request.method} ${request.path}`), changed }
  try {
    const session = sessionOf(state, request.sid)
    changed = true
    const user = userById(state, session.userId)
    if (match.permission !== null) {
      if (!user) {
        session.userId = null
        fail(401, 'SESSION_REQUIRED')
      }
      // Sesión absoluta de 12 horas: después hay que volver a entrar.
      if (now - session.startedAt > 12 * 3600_000) {
        session.userId = null
        fail(401, 'SESSION_EXPIRED')
      }
      if (match.permission !== 'any' && !user!.permissions.includes(match.permission)) fail(403, 'FORBIDDEN')
    }
    if (!['GET', 'HEAD'].includes(request.method) && match.permission !== null && request.csrf !== session.csrf) fail(403, 'CSRF_INVALID')
    const params = match.pattern.exec(request.path)!.slice(1).map(decodeURIComponent)
    const response = match.handler({ state, request, now, user: user ?? GUEST_USER, params, changed: () => { changed = true } })
    return { response, changed }
  } catch (error) {
    if (error instanceof MockProblem) return { response: problem(error.status, error.code, error.detail, error.extra), changed }
    console.error('Error en el servidor simulado', error)
    return { response: problem(500, 'SERVICE_UNAVAILABLE'), changed: false }
  }
}

export function problem(status: number, code: string, detail?: string, extra: Record<string, unknown> = {}): MockResponse {
  return { status, body: { type: 'about:blank', title: code, status, code, detail, ...extra } }
}
