import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import MovieDialog from './MovieDialog'
import { keys, useMovies } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { STAGE_LABELS } from '@/domain/labels'
import type { Movie, MovieStage } from '@/domain/models'
import { movieStage } from '@/domain/rules'
import StateView from '@/shared/ui/StateView'
import { confirmAction, toast, toastError } from '@/shared/hooks/feedback'
import { formatDate } from '@/shared/lib/datetime'
import { hashHue, normalizeText } from '@/shared/lib/text'
import './MoviesView.css'

const STAGE_TONE: Record<MovieStage, string> = { 'coming-soon': 'info', 'presale': 'warning', 'premiere': 'success', 'now-showing': 'success', 'finished': 'muted' }

export default function MoviesView() {
  const store = useSession()
  const { movies: port } = useServices()
  const queryClient = useQueryClient()
  const movies = useMovies()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | MovieStage | 'events'>('all')
  const [editing, setEditing] = useState<Movie | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const stageOf = (movie: Movie) => movieStage(movie, store.today())
  const shown = (movies.data ?? [])
    .filter(movie => filter === 'all' ? stageOf(movie) !== 'finished'
      : filter === 'events' ? movie.isSpecialEvent : stageOf(movie) === filter)
    .filter(movie => normalizeText(`${movie.title} ${movie.genres.join(' ')} ${movie.cast.map(p => p.name).join(' ')}`).includes(normalizeText(search)))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))

  function open(movie: Movie | null) {
    setEditing(movie)
    setDialogOpen(true)
  }

  const remove = useMutation({
    mutationFn: (movie: Movie) => port.remove(movie.id, movie.version),
    onSuccess: (_, movie) => {
      void queryClient.invalidateQueries({ queryKey: keys.movies() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`${movie.title} se retiró del catálogo.`)
    },
    onError: toastError
  })

  async function retire(movie: Movie) {
    const ok = await confirmAction({ title: `Retirar ${movie.title}`, text: 'Se quitará del catálogo. Solo es posible si no tiene funciones.', confirmLabel: 'Retirar', danger: true })
    if (ok) remove.mutate(movie)
  }

  return (
    <section className="movies-view">
      <div className="page-head">
        <div>
          <h1>Películas</h1>
          <p>Catálogo de películas y eventos especiales de toda la cadena. Dónde se exhiben lo deciden sus funciones.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => open(null)}><Plus size={17} /> Agregar película</button>
      </div>

      <div className="toolbar">
        <div className="field grow search">
          <label htmlFor="buscar-pelicula" className="visually-hidden">Buscar película</label>
          <Search size={17} aria-hidden="true" />
          <input id="buscar-pelicula" value={search} onChange={event => setSearch(event.target.value)} className="input" type="search" placeholder="Título, género o reparto" />
        </div>
        <div className="field">
          <label htmlFor="filtro-etapa" className="visually-hidden">Etapa</label>
          <select id="filtro-etapa" value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className="select">
            <option value="all">Vigentes</option>
            <option value="now-showing">En cartelera</option>
            <option value="premiere">Estreno</option>
            <option value="presale">Preventa</option>
            <option value="coming-soon">Próximamente</option>
            <option value="events">Eventos especiales</option>
            <option value="finished">Finalizadas</option>
          </select>
        </div>
        <span className="count">{shown.length} {shown.length === 1 ? 'película' : 'películas'}</span>
      </div>

      <StateView loading={movies.isPending} error={movies.error} empty={!shown.length} skeleton="cards"
        emptyTitle="No hay películas con estos criterios" onRetry={() => void movies.refetch()}>
        <ul className="grid" role="list">
          {shown.map(movie => (
            <li key={movie.id} className="panel card">
              <div className="art" style={{ '--hue': hashHue(movie.title) } as CSSProperties} aria-hidden="true">
                <span className="rating">{movie.rating}</span>
                <span className="initials">{movie.title.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>
              </div>
              <div className="body">
                <div className="tags">
                  <span className={`pill ${STAGE_TONE[stageOf(movie)]}`}>{STAGE_LABELS[stageOf(movie)]}</span>
                  {movie.isSpecialEvent && <span className="pill info">Evento especial</span>}
                  {movie.category === 'Garantía Cinépolis' && <span className="pill muted">Garantía</span>}
                </div>
                <h2>{movie.title}</h2>
                <p className="meta">{movie.genres.join(', ')} · {movie.durationMinutes} min</p>
                <p className="meta">Estreno: {movie.releaseDate ? formatDate(movie.releaseDate, 'short') : 'sin fecha'}{movie.lastDay && <> · Hasta {formatDate(movie.lastDay, 'short')}</>}</p>
                <p className="meta"><strong>{movie.upcomingScreenings}</strong> {movie.upcomingScreenings === 1 ? 'función programada' : 'funciones programadas'}</p>
                <div className="actions">
                  {store.can('screenings.manage') && stageOf(movie) !== 'finished' && (
                    <Link to={`/funciones/programar?pelicula=${encodeURIComponent(movie.id)}`} className="btn btn-secondary btn-small">
                      <CalendarPlus size={15} /> Programar
                    </Link>
                  )}
                  <button type="button" className="action" aria-label={`Editar ${movie.title}`} onClick={() => open(movie)}><Pencil size={15} /> Editar</button>
                  <button type="button" className="action danger" aria-label={`Retirar ${movie.title}`} disabled={movie.upcomingScreenings > 0}
                    title={movie.upcomingScreenings ? 'Tiene funciones programadas' : undefined} onClick={() => void retire(movie)}><Trash2 size={15} /> Retirar</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </StateView>

      <MovieDialog open={dialogOpen} movie={editing} onClose={() => setDialogOpen(false)} />
    </section>
  )
}
