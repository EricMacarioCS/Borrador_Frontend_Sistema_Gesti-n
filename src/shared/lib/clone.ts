/**
 * Copia profunda de datos simples (lo que llega del API). Para borradores de formularios
 * que no deben tocar la caché de consultas.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
