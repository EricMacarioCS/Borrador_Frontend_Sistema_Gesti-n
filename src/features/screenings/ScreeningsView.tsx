import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Pencil, Search, Trash2 } from 'lucide-react'
import ScreeningDialog from './ScreeningDialog'
import { keys, useScreenings } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Screening } from '@/domain/models'
import StateView from '@/shared/ui/StateView'
import { confirmAction, toast, toastError } from '@/shared/hooks/feedback'
import { addDays, formatDate } from '@/shared/lib/datetime'
import { normalizeText } from '@/shared/lib/text'
import './ScreeningsView.css'

export default function ScreeningsView() {
  const store = useSession()
  const { screenings: port } = useServices()
  const queryClient = useQueryClient()
  const today = store.today()

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 6))
  const [complexId, setComplexId] = useState('')
  const [projection, setProjection] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<Screening | null>(null)

  const screenings = useScreenings({ from, to: to < from ? from : to, complexId: complexId || undefined })

  const shown = (screenings.data ?? []).filter(s =>
    (!projection || s.projection.code === projection) &&
    (!search || normalizeText(s.movieTitle).includes(normalizeText(search))))
  const groups = new Map<string, Screening[]>()
  for (const s of shown) groups.set(s.date, [...(groups.get(s.date) ?? []), s])
  const days = [...groups]
  /** Una función que ya empezó es historia: no se edita ni se retira. */
  const started = (s: Screening) => s.date < today || (s.date === today && s.startTime <= store.nowTime())
  const removable = shown.filter(s => !s.hasTicketsSold && !started(s))
  const allChecked = removable.length > 0 && removable.every(s => selected.includes(s.id))

  function setRange(count: number) {
    setFrom(today)
    setTo(addDays(today, count - 1))
  }

  const remove = useMutation({
    mutationFn: (ids: string[]) => port.remove(ids),
    onSuccess: (_, ids) => {
      setSelected(current => current.filter(id => !ids.includes(id)))
      void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
      void queryClient.invalidateQueries({ queryKey: keys.movies() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(ids.length === 1 ? 'Se retiró la función.' : `Se retiraron ${ids.length} funciones.`)
    },
    onError: toastError
  })

  async function retire(ids: string[]) {
    const ok = await confirmAction({
      title: ids.length === 1 ? 'Retirar la función' : `Retirar ${ids.length} funciones`,
      text: 'Dejarán de estar a la venta y se borrarán de la programación. Las que tienen boletos vendidos no se pueden retirar.',
      confirmLabel: 'Retirar', danger: true
    })
    if (ok) remove.mutate(ids)
  }

  return (
    <section className="screenings-view">
      <div className="page-head">
        <div>
          <h1>Funciones y horarios</h1>
          <p>Consulta la programación o crea funciones en varios complejos, salas y horarios a la vez.</p>
        </div>
        <Link to="/funciones/programar" className="btn btn-primary"><CalendarPlus size={17} /> Programar funciones</Link>
      </div>

      <div className="panel filters">
        <div className="field search grow">
          <label htmlFor="f-pelicula">Película</label>
          <Search size={17} aria-hidden="true" />
          <input id="f-pelicula" value={search} onChange={e => setSearch(e.target.value)} className="input" type="search" placeholder="Buscar por título" />
        </div>
        <div className="field">
          <label htmlFor="f-complejo">Complejo</label>
          <select id="f-complejo" value={complexId} onChange={e => setComplexId(e.target.value)} className="select">
            <option value="">Todos</option>
            {store.complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-proyeccion">Proyección</label>
          <select id="f-proyeccion" value={projection} onChange={e => setProjection(e.target.value)} className="select">
            <option value="">Todas</option>
            {store.reference?.projections.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-desde">Desde</label>
          <input id="f-desde" value={from} onChange={e => setFrom(e.target.value)} className="input" type="date" />
        </div>
        <div className="field">
          <label htmlFor="f-hasta">Hasta</label>
          <input id="f-hasta" value={to} onChange={e => setTo(e.target.value)} className="input" type="date" min={from} />
        </div>
        <div className="presets">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setRange(1)}>Hoy</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setRange(7)}>7 días</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setRange(14)}>14 días</button>
        </div>
      </div>

      <div className="summary">
        <p><strong>{shown.length}</strong> {shown.length === 1 ? 'función' : 'funciones'}</p>
        {selected.length > 0 && (
          <button type="button" className="btn btn-danger btn-small" disabled={remove.isPending} onClick={() => void retire(selected)}>
            <Trash2 size={15} /> Retirar {selected.length} seleccionadas
          </button>
        )}
      </div>

      <StateView loading={screenings.isPending} error={screenings.error} empty={!shown.length} skeleton="rows"
        emptyTitle="No hay funciones con estos criterios" emptyText="Cambia los filtros o programa funciones nuevas." onRetry={() => void screenings.refetch()}>
        <div className="panel table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allChecked} aria-label="Seleccionar todas las que se pueden retirar" onChange={e => setSelected(e.target.checked ? removable.map(s => s.id) : [])} /></th>
                <th>Horario</th><th>Película</th><th>Complejo</th><th>Sala</th><th>Proyección</th><th>Estado</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            {days.map(([date, items]) => (
              <tbody key={date}>
                <tr className="day"><th colSpan={8} scope="colgroup">{formatDate(date)}{date === today && <span> · Hoy</span>}</th></tr>
                {items.map(s => (
                  <tr key={s.id} className={s.active ? undefined : 'row-off'}>
                    <td><input type="checkbox" value={s.id} checked={selected.includes(s.id)} disabled={s.hasTicketsSold || started(s)} aria-label={`Seleccionar ${s.movieTitle} ${s.startTime}`}
                      onChange={e => setSelected(e.target.checked ? [...selected, s.id] : selected.filter(id => id !== s.id))} /></td>
                    <td className="time">{s.startTime} – {s.endTime}{s.endsNextDay && <small> (+1 día)</small>}</td>
                    <td><span className="stack"><strong>{s.movieTitle}</strong><small>{s.language.name}</small></span></td>
                    <td>{store.complexName(s.complexId)}</td>
                    <td>Sala {s.roomNumber} · {s.roomType.name}</td>
                    <td><span className="tag">{s.projection.name}</span></td>
                    <td><span className={`pill ${started(s) ? 'muted' : s.active ? 'success' : 'warning'}`}>{started(s) ? 'Ya empezó' : s.active ? 'A la venta' : 'Inactiva'}</span></td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button type="button" className="action" disabled={started(s)} aria-label={`Editar ${s.movieTitle}, ${s.startTime}`} onClick={() => setEditing(s)}><Pencil size={15} /> Editar</button>
                        <button type="button" className="action danger" disabled={s.hasTicketsSold || started(s)} title={s.hasTicketsSold ? 'Tiene boletos vendidos' : undefined}
                          aria-label={`Retirar ${s.movieTitle}, ${s.startTime}`} onClick={() => void retire([s.id])}><Trash2 size={15} /> Retirar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </StateView>

      <ScreeningDialog screening={editing} onClose={() => setEditing(null)} />
    </section>
  )
}
