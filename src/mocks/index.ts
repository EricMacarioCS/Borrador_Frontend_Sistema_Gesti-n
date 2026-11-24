/**
 * Backend simulado: un `fetch` que atiende el contrato REST del API de gestión.
 * Solo se carga en modo "mock"; con la API real este módulo no se descarga.
 */
import { sessionId } from './store'
import { handle } from './server'

export interface MockOptions {
  baseUrl: string
  latencyMs: [number, number]
  failureRate: number
}

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelado', 'AbortError'))
    }, { once: true })
  })
}

export function createMockBackend(options: MockOptions) {
  const base = new URL(options.baseUrl, globalThis.location?.origin ?? 'http://localhost')

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, base)
    const headers = new Headers(init?.headers)
    const [min, max] = options.latencyMs
    await wait(min + Math.random() * Math.max(0, max - min), init?.signal)

    if (options.failureRate > 0 && Math.random() < options.failureRate) {
      return json(503, { code: 'SERVICE_UNAVAILABLE', title: 'Falla simulada', status: 503 })
    }

    const response = handle({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname.slice(base.pathname.replace(/\/$/, '').length) || '/',
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
      sid: sessionId(),
      csrf: headers.get('X-CSRF-Token'),
      idempotencyKey: headers.get('Idempotency-Key')
    })
    return json(response.status, response.body)
  }

  return { fetchImpl }
}

function json(status: number, body: unknown): Response {
  if (status === 204) return new Response(null, { status })
  const problem = status >= 400 ? body as Record<string, unknown> : null
  const headers: Record<string, string> = {
    'Content-Type': problem ? 'application/problem+json' : 'application/json',
    'X-Correlation-Id': crypto.randomUUID().replaceAll('-', '')
  }
  if (problem && typeof problem.retryAfter === 'number') headers['Retry-After'] = String(problem.retryAfter)
  return new Response(JSON.stringify(body), { status, headers })
}
