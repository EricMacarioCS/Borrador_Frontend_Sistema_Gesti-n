/** Estados de una consulta: cargando, error recuperable o vacío. */
import type { ReactNode } from 'react'
import { CircleAlert, RefreshCw, SearchX } from 'lucide-react'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage, supportReference } from '@/shared/lib/messages'
import './StateView.css'

interface Props {
  loading?: boolean
  error?: unknown
  empty?: boolean
  emptyTitle?: string
  emptyText?: string
  emptyActions?: ReactNode
  skeleton?: 'cards' | 'rows' | 'block'
  onRetry?: () => void
  children?: ReactNode
}

export default function StateView({ loading, error, empty, emptyTitle, emptyText, emptyActions, skeleton, onRetry, children }: Props) {
  const apiError = error ? toApiError(error) : null
  let content: ReactNode
  if (loading) {
    content = (
      <div className="state" aria-busy="true">
        <span className="visually-hidden" role="status">Cargando…</span>
        {skeleton === 'cards'
          ? <div className="skeleton-grid">{Array.from({ length: 8 }, (_, n) => <div key={n} className="skeleton card-skeleton" />)}</div>
          : skeleton === 'rows'
            ? <div className="skeleton-rows">{Array.from({ length: 5 }, (_, n) => <div key={n} className="skeleton row-skeleton" />)}</div>
            : <div className="skeleton block-skeleton" />}
      </div>
    )
  } else if (apiError) {
    const reference = supportReference(apiError)
    content = (
      <div className="state message" role="alert">
        <CircleAlert size={34} aria-hidden="true" />
        <h2>No pudimos cargar esta información</h2>
        <p>{errorMessage(apiError)}</p>
        {reference && <small>Referencia: {reference}</small>}
        <button type="button" className="btn btn-secondary" onClick={onRetry}><RefreshCw size={16} /> Reintentar</button>
      </div>
    )
  } else if (empty) {
    content = (
      <div className="state message">
        <SearchX size={34} aria-hidden="true" />
        <h2>{emptyTitle ?? 'Sin resultados'}</h2>
        {emptyText && <p>{emptyText}</p>}
        {emptyActions}
      </div>
    )
  } else {
    content = children
  }
  return <div className="state-view">{content}</div>
}
