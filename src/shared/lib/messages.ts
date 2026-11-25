import type { ApiError, ErrorCode } from './errors'

/** Mensajes para el personal. La interfaz decide por código, nunca por el texto del servidor. */
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  NETWORK: 'No hay conexión. Revisa tu red e inténtalo de nuevo.',
  TIMEOUT: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  MALFORMED_RESPONSE: 'Recibimos una respuesta inesperada del servidor. Avisa a soporte.',
  MALFORMED_REQUEST: 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible por el momento.',
  RATE_LIMITED: 'Hiciste demasiados intentos. Espera un momento.',
  VALIDATION_FAILED: 'Revisa los datos marcados.',
  INVALID_CREDENTIALS: 'El usuario o la contraseña no son correctos.',
  ACCOUNT_LOCKED: 'La cuenta se bloqueó por varios intentos fallidos. Espera 15 minutos o avisa a soporte.',
  SESSION_REQUIRED: 'Inicia sesión para continuar.',
  SESSION_EXPIRED: 'Tu sesión venció. Vuelve a iniciarla.',
  FORBIDDEN: 'Tu cuenta no tiene permiso para hacer esto.',
  CSRF_INVALID: 'Tu sesión necesita actualizarse. Vuelve a intentarlo.',
  NOT_FOUND: 'Ya no existe. Quizás alguien más lo borró.',
  VERSION_CONFLICT: 'Alguien más modificó esta información mientras la editabas. Recarga para ver lo más reciente.',
  DUPLICATE: 'Ya existe un registro con esos datos.',
  RESOURCE_IN_USE: 'No se puede porque está en uso.',
  SCHEDULE_CONFLICT: 'El horario choca con otra función de la sala.',
  IDEMPOTENCY_CONFLICT: 'Esta operación ya se envió con otros datos. Recarga la página.'
}

export function errorMessage(error: ApiError): string {
  // El servidor puede explicar una regla de negocio en `detail` para los códigos de validación.
  if (['VALIDATION_FAILED', 'RESOURCE_IN_USE', 'SCHEDULE_CONFLICT', 'DUPLICATE'].includes(error.code) && error.detail) return error.detail
  return MESSAGES[error.code] ?? 'Ocurrió un problema. Inténtalo de nuevo.'
}

/** Identificador corto para que soporte encuentre el error en los registros. */
export function supportReference(error: ApiError): string | null {
  return error.traceId ? error.traceId.slice(0, 16) : null
}
