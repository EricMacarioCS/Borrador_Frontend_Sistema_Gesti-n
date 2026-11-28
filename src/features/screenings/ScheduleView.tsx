/**
 * Programación por lote en cuatro pasos. El navegador solo arma la solicitud; el servidor planea,
 * asigna salas, detecta traslapes y vuelve a validar todo al crear.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { toRequest, useScheduleDraft } from './scheduleDraft'
import { keys, useMovies } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Room } from '@/domain/models'
import { STAGE_LABELS } from '@/domain/labels'
import { endTime, movieStage } from '@/domain/rules'
import MultiSelect from '@/shared/ui/MultiSelect'
import StateView from '@/shared/ui/StateView'
import { confirmAction, toast, toastError } from '@/shared/hooks/feedback'
import { addDays, formatDate } from '@/shared/lib/datetime'
import { newIdempotencyKey } from '@/shared/lib/ids'
import './ScheduleView.css'

const STEPS = [
  { title: 'Película e idioma', question: '¿Qué se va a proyectar?', help: 'Puedes marcar varias películas y los dos idiomas.' },
  { title: 'Complejos y salas', question: '¿Dónde y en qué formato?', help: 'Elige complejos, tipos de sala y proyección. Las salas son opcionales: si no eliges, el sistema asigna una libre.' },
  { title: 'Fechas y horarios', question: '¿Cuándo se proyecta?', help: 'Los horarios que marques se repiten en todas las fechas elegidas.' },
  { title: 'Revisar y crear', question: 'Revisa antes de crear', help: 'Cada renglón es una función. Desmarca las que no quieras crear.' }
]
const HALF_HOURS = Array.from({ length: 28 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const sorted = (values: string[]) => [...values].sort()
const timeRange = (start: string, duration: number) => {
  const end = endTime(start, duration)
  return `${start}–${end.time}${end.nextDay ? ' (+1)' : ''}`
}

export default function ScheduleView() {
  const store = useSession()
  const { screenings: port, complexes: complexesPort } = useServices()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const movies = useMovies()
  const draft = useScheduleDraft()
  const { patch, reset } = draft
  const heading = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)
  const idempotencyKey = useRef<string | null>(null)
  const today = store.today()
  const cleaning = store.reference?.limits.cleaningMinutes ?? 20

  // Película indicada desde el catálogo: empieza el borrador con ella.
  const movieParam = params.get('pelicula')
  useEffect(() => {
    if (!movieParam) return
    reset()
    patch({ movieIds: [movieParam] })
    // Se quita de la dirección para que volver a esta página no reinicie el borrador.
    setParams({}, { replace: true })
  }, [movieParam, patch, reset, setParams])

  /* Paso 1 */
  const activeMovies = (movies.data ?? []).filter(movie => movieStage(movie, today) !== 'finished')
  const movieOptions = activeMovies.map(movie => ({ value: movie.id, label: movie.title, hint: `${movie.durationMinutes} min · ${STAGE_LABELS[movieStage(movie, today)]}` }))
  const chosenMovies = activeMovies.filter(movie => draft.movieIds.includes(movie.id))
  const languageOptions = (store.reference?.languages ?? []).map(l => ({ value: l.code, label: l.name }))

  /* Paso 2: salas de los complejos elegidos */
  const complexOptions = store.complexes.map(c => ({ value: c.id, label: c.name, hint: c.cityName }))
  const roomQueries = useQueries({
    queries: draft.complexIds.map(complexId => ({
      queryKey: keys.rooms(complexId),
      queryFn: ({ signal }: { signal: AbortSignal }) => complexesPort.listRooms(complexId, signal),
      staleTime: 5 * 60_000
    }))
  })
  const rooms: Room[] = roomQueries.flatMap(query => query.data ?? [])
  const roomsLoading = roomQueries.some(query => query.isPending)
  const hasComplexes = draft.complexIds.length > 0
  const countHint = (count: number) => hasComplexes ? (count ? `${count} ${count === 1 ? 'sala' : 'salas'}` : 'Sin salas') : undefined
  const roomTypeOptions = (store.reference?.roomTypes ?? []).map(type => {
    const count = rooms.filter(room => room.type.code === type.code).length
    return { value: type.code, label: type.name, hint: countHint(count), disabled: hasComplexes && !roomsLoading && !count }
  })
  const projectionOptions = (store.reference?.projections ?? []).map(p => {
    const count = rooms.filter(room => draft.roomTypes.includes(room.type.code) && room.projections.some(x => x.code === p.code)).length
    return { value: p.code, label: p.name, hint: countHint(count), disabled: hasComplexes && !roomsLoading && !count }
  })
  const usableRooms = rooms.filter(room => draft.roomTypes.includes(room.type.code) && room.projections.some(p => draft.projections.includes(p.code)))

  // Al cambiar una selección se retira lo que ya no aplica.
  const types = draft.roomTypes.filter(code => roomTypeOptions.some(o => o.value === code && !o.disabled))
  const projections = draft.projections.filter(code => projectionOptions.some(o => o.value === code && !o.disabled))
  const picks = draft.roomIds.filter(id => usableRooms.some(room => room.id === id))
  const stale = !roomsLoading && (types.length !== draft.roomTypes.length || projections.length !== draft.projections.length || picks.length !== draft.roomIds.length)
  useEffect(() => {
    if (stale) patch({ roomTypes: types, projections, roomIds: picks })
  })

  /* Paso 3 */
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const horizon = Array.from({ length: 21 }, (_, i) => addDays(today, i))
  const dateOptions = sorted([...new Set([...horizon, ...draft.extraDates])]).map(date => ({
    value: date, label: formatDate(date), hint: chosenMovies.some(m => m.releaseDate && date < m.releaseDate) ? 'Antes del estreno' : date === today ? 'Hoy' : undefined
  }))
  const timeOptions = sorted([...new Set([...HALF_HOURS, ...draft.extraTimes])]).map(time => ({ value: time, label: time }))
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const presets = [
    { label: 'Hoy', dates: [today] },
    { label: 'Mañana', dates: [week[1]!] },
    { label: 'Fin de semana', dates: week.filter(date => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) },
    { label: 'Próximos 7 días', dates: week }
  ]
  function addDate() {
    if (!customDate) return
    if (customDate < today) return toast('Elige una fecha a partir de hoy.', 'error')
    patch({ extraDates: [...draft.extraDates, customDate], dates: [...new Set([...draft.dates, customDate])] })
    setCustomDate('')
  }
  function addTime() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime)) return
    patch({ extraTimes: [...draft.extraTimes, customTime], times: [...new Set([...draft.times, customTime])] })
    setCustomTime('')
  }

  /* Paso 4: vista previa del servidor */
  const request = toRequest(draft)
  const preview = useQuery({
    queryKey: ['schedule-preview', request],
    queryFn: ({ signal }) => port.preview(request, signal),
    enabled: draft.step === 4,
    staleTime: 0,
    refetchOnWindowFocus: false
  })
  const rows = preview.data?.rows ?? []
  const ready = rows.filter(row => !row.problem && !draft.excluded.includes(row.key))
  const problems = rows.filter(row => row.problem)
  const [onlyProblems, setOnlyProblems] = useState(false)
  const shownRows = onlyProblems && problems.length ? problems : rows
  function toggleRow(key: string) {
    patch({ excluded: draft.excluded.includes(key) ? draft.excluded.filter(k => k !== key) : [...draft.excluded, key] })
  }

  /* Navegación entre pasos */
  function problemIn(step: number): string | null {
    if (step === 1) return !draft.movieIds.length ? 'Elige al menos una película.' : !draft.languages.length ? 'Elige al menos un idioma.' : null
    if (step === 2) return !draft.complexIds.length ? 'Elige al menos un complejo.' : !draft.roomTypes.length ? 'Elige al menos un tipo de sala.' : !draft.projections.length ? 'Elige al menos una proyección.' : null
    if (step === 3) {
      if (customDate || customTime) return 'Pulsa Agregar para incluir la fecha u hora que escribiste.'
      return !draft.dates.length ? 'Elige al menos una fecha.' : !draft.times.length ? 'Elige al menos un horario.' : null
    }
    return null
  }
  const [stepError, setStepError] = useState<string | null>(null)
  function goTo(target: number) {
    let step = target
    let error: string | null = null
    for (let before = 1; before < target; before++) {
      const problem = problemIn(before)
      if (problem) {
        error = problem
        step = before
        break
      }
    }
    setStepError(error)
    patch(step === 4 && draft.step !== 4 ? { step, excluded: [] } : { step })
    focusHeading.current = true
  }
  useEffect(() => {
    if (!focusHeading.current) return
    focusHeading.current = false
    heading.current?.focus()
  }, [draft.step, stepError])

  const summary = [
    { label: 'Películas', values: chosenMovies.map(m => m.title) },
    { label: 'Idiomas', values: draft.languages.map(code => store.reference?.languages.find(l => l.code === code)?.name ?? code) },
    { label: 'Complejos', values: draft.complexIds.map(store.complexName) },
    { label: 'Tipos de sala', values: draft.roomTypes.map(code => store.reference?.roomTypes.find(t => t.code === code)?.name ?? code) },
    { label: 'Proyección', values: draft.projections.map(code => store.reference?.projections.find(p => p.code === code)?.name ?? code) },
    { label: 'Salas', values: [draft.roomIds.length ? `${draft.roomIds.length} elegidas` : 'Automáticas'] },
    { label: 'Fechas', values: sorted(draft.dates).map(date => formatDate(date, 'short')) },
    { label: 'Horarios', values: sorted(draft.times) }
  ]
  const combos = draft.movieIds.length * draft.languages.length * draft.dates.length * draft.times.length * Math.max(1, draft.complexIds.length) * Math.max(1, draft.roomTypes.length) * Math.max(1, draft.projections.length)

  /* Crear */
  const create = useMutation({
    mutationFn: () => {
      idempotencyKey.current ??= newIdempotencyKey()
      return port.createBatch(request, draft.excluded, idempotencyKey.current)
    },
    onSuccess: created => {
      idempotencyKey.current = null
      void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
      void queryClient.invalidateQueries({ queryKey: keys.movies() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      reset()
      const ids = created.map(s => s.id)
      toast(`Se programaron ${created.length} ${created.length === 1 ? 'función' : 'funciones'}.`, 'success', {
        label: 'Deshacer',
        run: () => void port.remove(ids).then(() => {
          void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
          toast('Se deshizo la programación.', 'info')
        }).catch(toastError)
      })
      void navigate('/funciones')
    },
    onError: error => {
      toastError(error)
      void preview.refetch()
    }
  })

  async function startOver() {
    if (draft.movieIds.length && !await confirmAction({ title: 'Empezar de nuevo', text: 'Se vaciará la selección de los cuatro pasos.', confirmLabel: 'Vaciar', danger: true })) return
    reset()
    setCustomDate('')
    setCustomTime('')
  }

  const current = STEPS[draft.step - 1]!
  return (
    <section className="schedule-view">
      <div className="page-head">
        <div>
          <h1>Programar funciones</h1>
          <p>Completa cuatro pasos. Nada se guarda hasta que pulses Crear.</p>
        </div>
        <Link to="/funciones" className="btn btn-secondary"><ArrowLeft size={16} /> Ver programación</Link>
      </div>

      <ol className="steps" aria-label="Pasos para programar">
        {STEPS.map((step, index) => {
          const n = index + 1
          return (
            <li key={step.title}>
              <button type="button" className={draft.step === n ? 'current' : draft.step > n ? 'done' : undefined} aria-current={draft.step === n ? 'step' : undefined} onClick={() => goTo(n)}>
                <span className="n">{draft.step > n ? <Check size={15} /> : n}</span>{step.title}
              </button>
            </li>
          )
        })}
      </ol>

      <div className={`wizard${draft.step === 4 ? ' wide' : ''}`}>
        <div className="panel panel-pad main">
          <h2 ref={heading} tabIndex={-1}>{current.question}</h2>
          <p className="muted">{current.help}</p>
          {stepError && <p className="notice danger" role="alert">{stepError}</p>}

          {draft.step === 1 && (
            <div className="form-grid">
              <MultiSelect value={draft.movieIds} onChange={movieIds => patch({ movieIds })} className="full" label="Películas *" options={movieOptions} placeholder="Elige una o varias películas" />
              <MultiSelect value={draft.languages} onChange={languages => patch({ languages })} className="full" label="Idiomas *" options={languageOptions} />
              {chosenMovies.length > 0 && (
                <ul className="picked full" role="list">
                  {chosenMovies.map(movie => (
                    <li key={movie.id}>
                      <span className="stack">
                        <strong>{movie.title}</strong>
                        <small>{movie.durationMinutes} min + {cleaning} de limpieza · {movie.rating} · Estreno {movie.releaseDate ? formatDate(movie.releaseDate, 'short') : 'sin fecha'}</small>
                      </span>
                      <button type="button" className="icon-btn" aria-label={`Quitar ${movie.title}`} onClick={() => patch({ movieIds: draft.movieIds.filter(id => id !== movie.id) })}><X size={16} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {draft.step === 2 && (
            <div className="form-grid">
              <MultiSelect value={draft.complexIds} onChange={complexIds => patch({ complexIds })} className="full" label="Complejos *" options={complexOptions} placeholder="Elige uno o varios complejos" />
              <MultiSelect value={draft.roomTypes} onChange={roomTypes => patch({ roomTypes })} label="Tipos de sala *" options={roomTypeOptions} />
              <MultiSelect value={draft.projections} onChange={value => patch({ projections: value })} label="Proyección *" options={projectionOptions} />
              {!hasComplexes ? (
                <p className="notice full">Al elegir complejos verás cuántas salas admiten cada formato.</p>
              ) : (
                <div className="full rooms">
                  <p className="field-label">Salas (opcional)</p>
                  <p className="field-hint">Si no marcas ninguna, el servidor asigna la primera sala compatible y libre de cada tipo.</p>
                  <StateView loading={roomsLoading} skeleton="rows">
                    {draft.complexIds.map(complexId => (
                      <section key={complexId} className="room-group" aria-label={`Salas de ${store.complexName(complexId)}`}>
                        <h3>{store.complexName(complexId)}</h3>
                        <div className="room-list">
                          {rooms.filter(r => r.complexId === complexId).map(room => {
                            const usable = usableRooms.includes(room)
                            const on = draft.roomIds.includes(room.id)
                            return (
                              <label key={room.id} className={`room${usable ? '' : ' off'}${on ? ' on' : ''}`}>
                                <input type="checkbox" value={room.id} checked={on} disabled={!usable}
                                  onChange={e => patch({ roomIds: e.target.checked ? [...draft.roomIds, room.id] : draft.roomIds.filter(id => id !== room.id) })} />
                                <span className="stack"><strong>Sala {room.number}</strong><small>{room.type.name} · {room.projections.map(p => p.name).join(', ')}</small></span>
                              </label>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </StateView>
                </div>
              )}
            </div>
          )}

          {draft.step === 3 && (
            <div className="form-grid">
              <div className="full presets">
                <span className="field-label">Agregar rápido:</span>
                {presets.map(preset => (
                  <button key={preset.label} type="button" className="btn btn-secondary btn-small" onClick={() => patch({ dates: [...new Set([...draft.dates, ...preset.dates])] })}>{preset.label}</button>
                ))}
              </div>
              <MultiSelect value={draft.dates} onChange={dates => patch({ dates })} label="Fechas *" options={dateOptions} placeholder="Elige una o varias fechas"
                footer={<>
                  <input value={customDate} onChange={e => setCustomDate(e.target.value)} className="input" type="date" min={today} aria-label="Otra fecha" />
                  <button type="button" className="btn btn-secondary btn-small" onClick={addDate}>Agregar</button>
                </>} />
              <MultiSelect value={draft.times} onChange={times => patch({ times })} label="Horarios de inicio *" options={timeOptions} placeholder="Elige uno o varios horarios"
                footer={<>
                  <input value={customTime} onChange={e => setCustomTime(e.target.value)} className="input" type="time" aria-label="Otro horario" />
                  <button type="button" className="btn btn-secondary btn-small" onClick={addTime}>Agregar</button>
                </>} />
              <div className="chips">
                {sorted(draft.dates).map(date => (
                  <span key={date} className="chip">{formatDate(date, 'short')}
                    <button type="button" aria-label={`Quitar ${formatDate(date)}`} onClick={() => patch({ dates: draft.dates.filter(d => d !== date) })}><X size={13} /></button>
                  </span>
                ))}
              </div>
              <div className="chips">
                {sorted(draft.times).map(time => (
                  <span key={time} className="chip">{time}
                    <button type="button" aria-label={`Quitar ${time}`} onClick={() => patch({ times: draft.times.filter(t => t !== time) })}><X size={13} /></button>
                  </span>
                ))}
              </div>
              {draft.times.length > 0 && chosenMovies.length > 0 && (
                <div className="full durations">
                  <h3 className="field-label">Inicio y fin de cada proyección</h3>
                  {chosenMovies.map(movie => (
                    <p key={movie.id}><strong>{movie.title}:</strong> {sorted(draft.times).map(time => timeRange(time, movie.durationMinutes)).join(' · ')}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {draft.step === 4 && (
            <StateView loading={preview.isPending} error={preview.error} skeleton="rows" onRetry={() => void preview.refetch()}>
              {preview.data?.tooMany ? (
                <p className="notice warning" role="alert">La selección supera {store.reference?.limits.maxScreeningsPerBatch} funciones por lote. Reduce alguna de las listas.</p>
              ) : (
                <>
                  <div className="preview-summary" aria-live="polite">
                    <span className="pill success">{ready.length} por crear</span>
                    {problems.length > 0 && <span className="pill warning">{problems.length} con problema: no se crearán</span>}
                    {draft.excluded.length > 0 && <span className="pill muted">{draft.excluded.length} desmarcadas</span>}
                    {problems.length > 0 && <label className="check small"><input checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} type="checkbox" /> Ver solo las que tienen problema</label>}
                  </div>
                  <div className="table-wrap preview">
                    <table className="data">
                      <thead><tr><th>Crear</th><th>Película</th><th>Fecha y horario</th><th>Complejo y sala</th><th>Formato</th><th>Resultado</th></tr></thead>
                      <tbody>
                        {shownRows.map(row => {
                          const excluded = draft.excluded.includes(row.key)
                          return (
                            <tr key={row.key} className={excluded || row.problem ? 'row-off' : undefined}>
                              <td><input type="checkbox" checked={!row.problem && !excluded} disabled={!!row.problem}
                                aria-label={`Crear ${row.movieTitle}, ${row.date}, ${row.startTime}`} onChange={() => toggleRow(row.key)} /></td>
                              <td><span className="stack"><strong>{row.movieTitle}</strong><small>{row.language.name}</small></span></td>
                              <td><span className="stack"><span>{formatDate(row.date, 'short')}</span><small>{row.startTime}–{row.endTime}{row.endsNextDay ? ' (+1 día)' : ''}</small></span></td>
                              <td><span className="stack"><span>{store.complexName(row.complexId)}</span><small>{row.roomNumber ? `Sala ${row.roomNumber}` : 'Sin sala'}</small></span></td>
                              <td><span className="tags"><span className="tag">{row.roomType.name}</span><span className="tag">{row.projection.name}</span></span></td>
                              <td>
                                {row.problem
                                  ? <span className="problem">{row.problem}</span>
                                  : <span className={`pill ${excluded ? 'muted' : 'success'}`}>{excluded ? 'No se creará' : 'Lista'}</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="field-hint">Entre funciones de una misma sala se reservan {cleaning} minutos de limpieza. Al crear, el servidor vuelve a revisar todo.</p>
                </>
              )}
            </StateView>
          )}

          <div className="footer">
            {draft.step > 1 && <button type="button" className="btn btn-secondary" onClick={() => goTo(draft.step - 1)}><ArrowLeft size={16} /> Anterior</button>}
            <button type="button" className="btn btn-ghost" onClick={() => void startOver()}>Empezar de nuevo</button>
            {draft.step < 4 ? (
              <button type="button" className="btn btn-primary next" onClick={() => goTo(draft.step + 1)}>Siguiente: {STEPS[draft.step]!.title} <ArrowRight size={16} /></button>
            ) : (
              <button type="button" className="btn btn-primary next" disabled={!ready.length || create.isPending} onClick={() => create.mutate()}>
                <Check size={16} /> {create.isPending ? 'Creando…' : `Crear ${ready.length} ${ready.length === 1 ? 'función' : 'funciones'}`}
              </button>
            )}
          </div>
        </div>

        {draft.step < 4 && (
          <aside className="panel panel-pad side" aria-label="Resumen de la programación">
            <h2>Resumen</h2>
            <dl>
              {summary.map(item => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd className={item.values.length ? undefined : 'pending'}>
                    {!item.values.length ? 'Por elegir' : item.values.length > 3 ? `${item.values.slice(0, 3).join(', ')} y ${item.values.length - 3} más` : item.values.join(', ')}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="muted small">Hasta {combos.toLocaleString('es-MX')} combinaciones por revisar.</p>
          </aside>
        )}
      </div>
    </section>
  )
}
