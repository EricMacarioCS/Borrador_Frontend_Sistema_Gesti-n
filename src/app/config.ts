import { z } from 'zod'

/**
 * Configuración en tiempo de ejecución. Se lee de `/config.json` para promover la misma compilación
 * entre ambientes; las variables VITE_* solo dan valores de respaldo en desarrollo.
 */
const ConfigSchema = z.object({
  apiMode: z.enum(['mock', 'http']),
  apiBaseUrl: z.string().min(1),
  environmentName: z.string(),
  supportEmail: z.string().nullable(),
  /** Minutos sin actividad antes de cerrar la sesión. 0 lo desactiva. */
  idleMinutes: z.number().int().min(0).max(480),
  mock: z.object({
    latencyMs: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    failureRate: z.number().min(0).max(1)
  })
})

export type AppConfig = z.infer<typeof ConfigSchema>

const defaults: AppConfig = {
  apiMode: import.meta.env.VITE_API_MODE ?? 'mock',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/admin/v1',
  environmentName: 'local',
  supportEmail: null,
  idleMinutes: 30,
  mock: { latencyMs: [80, 300], failureRate: 0 }
}

export class ConfigError extends Error {}

/**
 * En producción una configuración inválida detiene el arranque: nunca se cae al simulador por accidente.
 * En desarrollo, sin config.json se usan los valores por defecto.
 */
export async function loadConfig(): Promise<AppConfig> {
  let raw: Partial<AppConfig> = {}
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (response.ok) raw = await response.json() as Partial<AppConfig>
    else if (import.meta.env.PROD) throw new ConfigError(`config.json respondió ${response.status}`)
  } catch (error) {
    if (import.meta.env.PROD) throw error instanceof ConfigError ? error : new ConfigError('No se pudo leer config.json')
  }
  const merged = {
    ...defaults, ...raw,
    mock: { ...defaults.mock, ...raw.mock }
  }
  const parsed = ConfigSchema.safeParse(merged)
  if (!parsed.success) {
    console.error('config.json inválido', parsed.error.issues)
    if (import.meta.env.PROD) throw new ConfigError('config.json inválido')
    return defaults
  }
  return parsed.data
}
