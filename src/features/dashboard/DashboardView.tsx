import { useState } from 'react'
import { Link } from 'react-router'
import { useQueries } from '@tanstack/react-query'
import { ArrowUpRight, Building2, CalendarPlus, Clapperboard, Clock, Sparkles } from 'lucide-react'
import { keys, useActivity, useMovies, useScreenings } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { STAGE_LABELS } from '@/domain/labels'
import type { Movie } from '@/domain/models'
import { movieStage } from '@/domain/rules'
import StateView from '@/shared/ui/StateView'
import { addDays, formatDate, formatDateTime } from '@/shared/lib/datetime'
import './DashboardView.css'

const count = (n: number) => n.toLocaleString('es-MX')

/**
 * Panel operativo: lo que pasa hoy y lo que requiere atención. No muestra ventas ni ingresos;
 * esas cifras se consultan en Vista y en los sistemas de la cadena.
 */
export default function DashboardView() {
  const store = useSession()
  const { products: productsPort } = useServices()
  const today = store.today()
  const weekEnd = addDays(today, 6)

  const [complexId, setComplexId] = useState('')
  const scopeComplexes = complexId ? store.complexes.filter(c => c.id === complexId) : store.complexes
  const scopeLabel = complexId ? store.complexName(complexId) : store.chainAdmin ? 'Toda la cadena' : store.complexes[0]?.name ?? 'Tu complejo'

  const week = useScreenings({ from: today, to: weekEnd, complexId: complexId || undefined })
  const movies = useMovies()
  const activity = useActivity(8)

  /* Funciones de hoy */
  const todays = (week.data ?? []).filter(s => s.date === today && s.active)
  const pending = todays.filter(s => s.startTime > store.nowTime())
  const nextUp = pending.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 8)

  /* Cartelera */
  const stageOf = (movie: Movie) => movieStage(movie, today)
  const showing = (movies.data ?? []).filter(m => ['premiere', 'now-showing'].includes(stageOf(m)))
  const releases = (movies.data ?? [])
    .filter(m => (m.releaseDate && m.releaseDate >= today && m.releaseDate <= weekEnd) || stageOf(m) === 'presale')
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))

  /* Atención */
  const scheduledMovieIds = new Set((week.data ?? []).filter(s => s.active).map(s => s.movieId))
  const withoutScreenings = showing.filter(m => !scheduledMovieIds.has(m.id))
  const endingSoon = showing
    .filter(m => m.lastDay && m.lastDay >= today && m.lastDay <= weekEnd)
    .sort((a, b) => a.lastDay!.localeCompare(b.lastDay!))

  /* Dulcería: productos marcados como no disponibles en los complejos que se ven */
  const showProducts = store.can('products.manage')
  const catalogs = useQueries({
    queries: (showProducts ? scopeComplexes : []).map(complex => ({
      queryKey: keys.catalog(complex.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => productsPort.catalog(complex.id, signal)
    }))
  })
  const unavailable = catalogs
    .flatMap(query => query.data ?? [])
    .filter(entry => !entry.available)
    .map(entry => ({ key: `${entry.complexId}-${entry.product.id}`, name: entry.product.name, complex: store.complexName(entry.complexId) }))
  const catalogsLoading = catalogs.some(query => query.isPending)

  const attentionCount = withoutScreenings.length + endingSoon.length
  const canSchedule = store.can('screenings.manage')

  return (
    <section className="dashboard-view">
      <div className="page-head">
        <div>
          <h1>Panel principal</h1>
          <p>Operación de {store.chainAdmin ? 'la cadena' : store.complexes[0]?.name ?? 'tu complejo'}: funciones de hoy, cartelera y pendientes.</p>
        </div>
        <div className="page-actions">
          {store.complexes.length > 1 && (
            <div className="field scope">
              <label htmlFor="d-complejo" className="visually-hidden">Complejo</label>
              <select id="d-complejo" value={complexId} onChange={event => setComplexId(event.target.value)} className="select">
                <option value="">Toda la cadena</option>
                {store.complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {canSchedule && <Link to="/funciones/programar" className="btn btn-primary"><CalendarPlus size={16} /> Programar funciones</Link>}
        </div>
      </div>

      <div className="metric-grid">
        <article className="panel metric">
          <div className="metric-top"><span>Funciones hoy</span><span className="metric-icon"><Clock size={17} /></span></div>
          <strong>{week.isPending ? '—' : count(todays.length)}</strong>
          <span className="foot">{count(pending.length)} por empezar · {scopeLabel}</span>
        </article>
        <article className="panel metric">
          <div className="metric-top"><span>Películas en cartelera</span><span className="metric-icon"><Clapperboard size={17} /></span></div>
          <strong>{movies.isPending ? '—' : count(showing.length)}</strong>
          <span className="foot">{showing.filter(m => stageOf(m) === 'premiere').length} en periodo de estreno</span>
        </article>
        <article className="panel metric">
          <div className="metric-top"><span>Estrenos y preventas</span><span className="metric-icon"><Sparkles size={17} /></span></div>
          <strong>{movies.isPending ? '—' : count(releases.length)}</strong>
          <span className="foot">Estrenan esta semana o ya están en preventa</span>
        </article>
        <article className="panel metric">
          <div className="metric-top"><span>Complejos</span><span className="metric-icon"><Building2 size={17} /></span></div>
          <strong>{scopeComplexes.length}</strong>
          <span className="foot">{scopeComplexes.reduce((sum, c) => sum + c.roomCount, 0)} salas · {count(scopeComplexes.reduce((sum, c) => sum + c.seatCount, 0))} asientos</span>
        </article>
      </div>

      <div className="grid">
        <article className="panel">
          <div className="panel-head">
            <div><h2>Próximas funciones de hoy</h2><p>{scopeLabel} · {formatDate(today)}</p></div>
            <Link to="/funciones" className="action">Ver programación <ArrowUpRight size={14} /></Link>
          </div>
          <StateView loading={week.isPending} error={week.error} empty={!nextUp.length} skeleton="rows"
            emptyTitle="No quedan funciones hoy" emptyText="Las funciones de hoy ya empezaron o no hay programación." onRetry={() => void week.refetch()}>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Hora</th><th>Película</th><th>Complejo</th><th>Sala</th><th>Proyección</th></tr></thead>
                <tbody>
                  {nextUp.map(s => (
                    <tr key={s.id}>
                      <td className="time">{s.startTime}</td>
                      <td><span className="stack"><strong>{s.movieTitle}</strong><small>{s.language.name}</small></span></td>
                      <td>{store.complexName(s.complexId)}</td>
                      <td>Sala {s.roomNumber} · {s.roomType.name}</td>
                      <td><span className="tag">{s.projection.name}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StateView>
        </article>

        <article className="panel">
          <div className="panel-head"><div><h2>Estrenos y preventas</h2><p>Estrenos de los próximos 7 días y preventas abiertas</p></div></div>
          <StateView loading={movies.isPending} error={movies.error} empty={!releases.length} skeleton="rows"
            emptyTitle="Sin estrenos esta semana" onRetry={() => void movies.refetch()}>
            <ul className="list" role="list">
              {releases.map(m => (
                <li key={m.id}>
                  <span className="stack"><strong>{m.title}</strong><small>Estreno {m.releaseDate ? formatDate(m.releaseDate, 'short') : 'sin fecha'}</small></span>
                  <span className={`pill ${stageOf(m) === 'presale' ? 'info' : 'muted'}`}>{STAGE_LABELS[stageOf(m)]}</span>
                </li>
              ))}
            </ul>
          </StateView>
        </article>
      </div>

      <div className="grid">
        <article className="panel">
          <div className="panel-head">
            <div><h2>Requiere atención</h2><p>Cartelera de los próximos 7 días · {scopeLabel}</p></div>
            {attentionCount > 0 && <span className="pill warning">{attentionCount}</span>}
          </div>
          <StateView loading={movies.isPending || week.isPending} error={movies.error ?? week.error} empty={!attentionCount} skeleton="rows"
            emptyTitle="Todo en orden" emptyText="Las películas en cartelera tienen funciones y ninguna termina esta semana."
            onRetry={() => { void movies.refetch(); void week.refetch() }}>
            <ul className="list" role="list">
              {withoutScreenings.map(m => (
                <li key={`sin-${m.id}`}>
                  <span className="stack"><strong>{m.title}</strong><small>En cartelera sin funciones programadas</small></span>
                  {canSchedule && <Link to="/funciones/programar" className="action">Programar</Link>}
                </li>
              ))}
              {endingSoon.map(m => (
                <li key={`fin-${m.id}`}>
                  <span className="stack"><strong>{m.title}</strong><small>Último día: {formatDate(m.lastDay!, 'short')}</small></span>
                  <span className="pill muted">Termina pronto</span>
                </li>
              ))}
            </ul>
          </StateView>
        </article>

        {showProducts && (
          <article className="panel">
            <div className="panel-head">
              <div><h2>Productos no disponibles</h2><p>Dulcería · {scopeLabel}</p></div>
              <Link to="/dulceria" className="action">Ver dulcería <ArrowUpRight size={14} /></Link>
            </div>
            <StateView loading={catalogsLoading} empty={!unavailable.length} skeleton="rows"
              emptyTitle="Todo disponible" emptyText="Ningún producto está marcado como no disponible.">
              <ul className="list" role="list">
                {unavailable.map(item => (
                  <li key={item.key}>
                    <span className="stack"><strong>{item.name}</strong><small>{item.complex}</small></span>
                    <span className="pill danger">No disponible</span>
                  </li>
                ))}
              </ul>
            </StateView>
          </article>
        )}

        <article className="panel">
          <div className="panel-head"><div><h2>Actividad reciente</h2><p>Cambios hechos en el sistema</p></div></div>
          <StateView loading={activity.isPending} error={activity.error} empty={!activity.data?.length} skeleton="rows" emptyTitle="Sin actividad" onRetry={() => void activity.refetch()}>
            <ol className="activity" role="list">
              {activity.data?.map(item => (
                <li key={item.id}>
                  <span className="tag">{item.area}</span>
                  <p>{item.summary}</p>
                  <small>{item.actor} · {formatDateTime(item.at)}</small>
                </li>
              ))}
            </ol>
          </StateView>
        </article>
      </div>
    </section>
  )
}
