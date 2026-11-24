import { toRaw } from 'vue'

/**
 * Copia profunda de datos simples (lo que llega del API). Sirve también con objetos reactivos de Vue,
 * que `structuredClone` no acepta. Para borradores de formularios que no deben tocar la caché.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(toRaw(value))) as T
}
