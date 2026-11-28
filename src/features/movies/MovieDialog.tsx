import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Movie, MovieInput } from '@/domain/models'
import { movieDatesProblem, slugify } from '@/domain/rules'
import BaseDialog from '@/shared/ui/BaseDialog'
import MultiSelect from '@/shared/ui/MultiSelect'
import { numberValue, useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import { clone } from '@/shared/lib/clone'
import './MovieDialog.css'

interface Props { open: boolean; movie: Movie | null; onClose: () => void }

export default function MovieDialog({ open, movie, onClose }: Props) {
  const store = useSession()
  const { movies } = useServices()
  const queryClient = useQueryClient()
  const id = useId()

  const blank = (): MovieInput => ({
    title: '', slug: '', rating: 'B', genres: [], durationMinutes: 120, synopsis: '', category: 'Normal', isSpecialEvent: false,
    posterUrl: null, bannerUrl: null, trailerUrl: null, vistaId: null, cast: [], releaseDate: store.today(), presaleFrom: null, lastDay: null
  })
  const { draft, update, dirty, touched, setTouched } = useDraft<MovieInput>(open, () => {
    const { id: _i, version: _v, upcomingScreenings: _u, ...rest } = movie ?? { id: '', version: 0, upcomingScreenings: 0, ...blank() }
    return clone(rest)
  })
  const [person, setPerson] = useState<{ name: string; role: 'actor' | 'director' }>({ name: '', role: 'actor' })

  const errors = {
    title: draft.title.trim() ? null : 'Escribe el título.',
    genres: draft.genres.length ? null : 'Elige al menos un género.',
    duration: Number.isInteger(draft.durationMinutes) && draft.durationMinutes > 0 && draft.durationMinutes <= 600 ? null : 'De 1 a 600 minutos.',
    synopsis: draft.synopsis.trim() ? null : 'Escribe la sinopsis.',
    dates: movieDatesProblem(draft)
  }
  const valid = Object.values(errors).every(error => !error)
  const scheduled = movie?.upcomingScreenings ?? 0
  const genreOptions = (store.reference?.genres ?? []).map(value => ({ value, label: value }))

  const save = useMutation({
    mutationFn: () => {
      const input: MovieInput = {
        ...draft, title: draft.title.trim(), slug: slugify(draft.slug || draft.title),
        posterUrl: draft.posterUrl?.trim() || null, bannerUrl: draft.bannerUrl?.trim() || null,
        trailerUrl: draft.trailerUrl?.trim() || null, vistaId: draft.vistaId?.trim() || null,
        releaseDate: draft.releaseDate || null, presaleFrom: draft.presaleFrom || null, lastDay: draft.lastDay || null
      }
      return movie ? movies.update(movie.id, { ...input, version: movie.version }) : movies.create(input)
    },
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.movies() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(movie ? `${saved.title} se actualizó.` : `${saved.title} se registró.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (valid) save.mutate()
  }
  function addPerson() {
    const name = person.name.trim()
    if (!name) return
    update({ cast: [...draft.cast, { name, role: person.role }] })
    setPerson({ ...person, name: '' })
  }
  const show = (key: keyof typeof errors) => touched ? errors[key] : null
  const invalid = (key: keyof typeof errors) => (show(key) ? 'true' : undefined)

  return (
    <BaseDialog open={open} label={movie ? `Editar ${movie.title}` : 'Agregar película'} eyebrow="Catálogo de películas" size="large" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar película'}</button>
      </>}>
      <form id={`${id}-form`} className="form-grid movie-form" noValidate onSubmit={submit}>
        <h3 className="form-section">Información general</h3>
        <div className="field full">
          <label htmlFor={`${id}-title`}>Título *</label>
          <input id={`${id}-title`} value={draft.title} onChange={e => update({ title: e.target.value })} className="input" maxLength={150} aria-invalid={invalid('title')} />
          <p className="field-error">{show('title')}</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-slug`}>URL amigable</label>
          <input id={`${id}-slug`} value={draft.slug} onChange={e => update({ slug: e.target.value })} className="input" placeholder={slugify(draft.title) || 'se genera del título'} />
          <p className="field-hint">Se usa en la dirección del sitio web.</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-rating`}>Clasificación</label>
          <select id={`${id}-rating`} value={draft.rating} onChange={e => update({ rating: e.target.value })} className="select">
            {store.reference?.ratings.map(rating => <option key={rating.code} value={rating.code}>{rating.code} · {rating.description}</option>)}
          </select>
        </div>
        <MultiSelect value={draft.genres} onChange={genres => update({ genres })} label="Géneros *" options={genreOptions} placeholder="Elige uno o varios" error={show('genres')} />
        <div className="field">
          <label htmlFor={`${id}-duration`}>Duración (minutos) *</label>
          <input id={`${id}-duration`} value={numberValue(draft.durationMinutes)} onChange={e => update({ durationMinutes: e.target.valueAsNumber })} className="input" type="number" min={1} max={600} disabled={scheduled > 0} aria-invalid={invalid('duration')} />
          {scheduled > 0 && <p className="field-hint">Tiene {scheduled} funciones programadas: retíralas para cambiar la duración.</p>}
          <p className="field-error">{show('duration')}</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-category`}>Categoría</label>
          <select id={`${id}-category`} value={draft.category} onChange={e => update({ category: e.target.value })} className="select">
            <option>Normal</option>
            <option>Garantía Cinépolis</option>
          </select>
          <p className="field-hint">Garantía Cinépolis habilita la reclamación de satisfacción.</p>
        </div>
        <label className="check full"><input checked={draft.isSpecialEvent} onChange={e => update({ isSpecialEvent: e.target.checked })} type="checkbox" /> Evento especial (concierto, ópera, deporte o anime)</label>
        <div className="field full">
          <label htmlFor={`${id}-synopsis`}>Sinopsis *</label>
          <textarea id={`${id}-synopsis`} value={draft.synopsis} onChange={e => update({ synopsis: e.target.value })} className="textarea" maxLength={2000} aria-invalid={invalid('synopsis')} />
          <p className="field-error">{show('synopsis')}</p>
        </div>

        <h3 className="form-section">Fechas de cartelera</h3>
        <div className="field">
          <label htmlFor={`${id}-release`}>Estreno</label>
          <input id={`${id}-release`} value={draft.releaseDate ?? ''} onChange={e => update({ releaseDate: e.target.value })} className="input" type="date" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-presale`}>Inicio de preventa (opcional)</label>
          <input id={`${id}-presale`} value={draft.presaleFrom ?? ''} onChange={e => update({ presaleFrom: e.target.value })} className="input" type="date" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-last`}>Último día (opcional)</label>
          <input id={`${id}-last`} value={draft.lastDay ?? ''} onChange={e => update({ lastDay: e.target.value })} className="input" type="date" />
        </div>
        <p className="field-error full">{show('dates')}</p>
        <p className="notice full small">Estas fechas calculan Próximamente, Preventa y Estreno. Requieren columnas nuevas en la tabla <code>pelicula</code>.</p>

        <h3 className="form-section">Reparto</h3>
        <div className="full chips">
          {draft.cast.map((item, index) => (
            <span key={`${item.name}-${index}`} className="chip">
              {item.name} · {item.role === 'director' ? 'Dirección' : 'Actuación'}
              <button type="button" aria-label={`Quitar a ${item.name}`} onClick={() => update({ cast: draft.cast.filter((_, i) => i !== index) })}><X size={13} /></button>
            </span>
          ))}
          {!draft.cast.length && <span className="muted small">Sin personas registradas.</span>}
        </div>
        <div className="full add-person">
          <input value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} className="input" placeholder="Nombre" aria-label="Nombre de la persona"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPerson() } }} />
          <select value={person.role} onChange={e => setPerson({ ...person, role: e.target.value as 'actor' | 'director' })} className="select" aria-label="Rol">
            <option value="actor">Actuación</option>
            <option value="director">Dirección</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={addPerson}><Plus size={16} /> Agregar</button>
        </div>

        <h3 className="form-section">Medios e integración</h3>
        <div className="field full">
          <label htmlFor={`${id}-poster`}>URL del póster vertical (2:3)</label>
          <input id={`${id}-poster`} value={draft.posterUrl ?? ''} onChange={e => update({ posterUrl: e.target.value })} className="input" placeholder="https://…" />
        </div>
        <div className="field full">
          <label htmlFor={`${id}-banner`}>URL de la imagen horizontal</label>
          <input id={`${id}-banner`} value={draft.bannerUrl ?? ''} onChange={e => update({ bannerUrl: e.target.value })} className="input" placeholder="https://…" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-trailer`}>URL del tráiler</label>
          <input id={`${id}-trailer`} value={draft.trailerUrl ?? ''} onChange={e => update({ trailerUrl: e.target.value })} className="input" placeholder="https://…" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-vista`}>ID en Vista</label>
          <input id={`${id}-vista`} value={draft.vistaId ?? ''} onChange={e => update({ vistaId: e.target.value })} className="input" />
          <p className="field-hint">Opcional. Lo llena la integración con Vista.</p>
        </div>
      </form>
    </BaseDialog>
  )
}
