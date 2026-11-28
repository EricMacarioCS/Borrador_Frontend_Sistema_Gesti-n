import { ConfigError } from './config'
import { toApiError } from '@/shared/lib/errors'
import { supportReference } from '@/shared/lib/messages'
import './BootError.css'

export default function BootError({ error }: { error: unknown }) {
  const apiError = toApiError(error)
  const message = error instanceof ConfigError
    ? 'La configuración de este ambiente no es válida. Avisa al equipo de infraestructura.'
    : apiError.code === 'NETWORK' || apiError.code === 'TIMEOUT'
      ? 'Revisa tu conexión e intenta de nuevo.'
      : 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'
  const reference = supportReference(apiError)

  return (
    <main className="boot-error">
      <div className="panel card">
        <p className="eyebrow">Administración Cinépolis</p>
        <h1>No pudimos abrir el sistema</h1>
        <p>{message}</p>
        {reference && <small>Referencia: {reference}</small>}
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Intentar de nuevo</button>
      </div>
    </main>
  )
}
