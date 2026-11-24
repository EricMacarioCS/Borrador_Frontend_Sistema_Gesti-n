/**
 * Planeación de un lote de funciones. Es la regla que el backend debe aplicar en `POST /screening-batches/preview`
 * y volver a aplicar al crear: el navegador solo muestra el resultado.
 *
 * - Cada combinación (película, complejo, tipo de sala, proyección, idioma, fecha, hora) es un renglón.
 * - Si se eligieron salas a mano se usan esas; si no, se asigna la primera sala compatible y libre.
 * - Entre funciones de una misma sala se reservan minutos de limpieza.
 * - Los traslapes se calculan en minutos absolutos, así que cruzar la medianoche también cuenta.
 */
import type { ScheduleRequest } from '@/domain/models'
import { endTime } from '@/domain/rules'

export interface PlanRoom { id: string; complexId: string; number: number; type: string; projections: string[] }
export interface PlanMovie { id: string; title: string; durationMinutes: number; releaseDate: string | null; lastDay: string | null }
export interface PlanScreening { movieId: string; roomId: string; date: string; startTime: string; projection: string; language: string; durationMinutes: number; title: string }

export interface PlannedRow {
  key: string
  movie: PlanMovie
  complexId: string
  roomType: string
  projection: string
  language: string
  date: string
  startTime: string
  endTime: string
  endsNextDay: boolean
  room: PlanRoom | null
  problem: string | null
}

export interface PlanInput {
  request: ScheduleRequest
  movies: PlanMovie[]
  rooms: PlanRoom[]
  existing: PlanScreening[]
  now: { date: string; time: string }
  cleaningMinutes: number
  maxBatch: number
  excluded?: Set<string>
  names: { roomType: (code: string) => string; projection: (code: string) => string }
}

const toMinutes = (date: string, time: string) => Date.parse(`${date}T${time}:00Z`) / 60000

export function planScreenings(input: PlanInput): { rows: PlannedRow[]; tooMany: boolean } {
  const { request, rooms, existing, now, cleaningMinutes, names } = input
  const movies = input.movies.filter(movie => request.movieIds.includes(movie.id))

  const targets = request.complexIds.flatMap(complexId => request.roomTypes.flatMap(roomType => request.projections.map(projection => {
    // Primero las salas con menos proyecciones, para dejar libres las que admiten más.
    const matching = rooms
      .filter(room => room.complexId === complexId && room.type === roomType && room.projections.includes(projection))
      .sort((a, b) => a.projections.length - b.projections.length || a.number - b.number)
    const chosen = matching.filter(room => request.roomIds.includes(room.id))
    return { complexId, roomType, projection, matching, chosen }
  }))).flatMap(target => (target.chosen.length ? target.chosen : [null]).map(fixed => ({ ...target, fixed })))

  const total = movies.length * request.languages.length * request.dates.length * request.times.length * targets.length
  if (total > input.maxBatch) return { rows: [], tooMany: true }

  const busy = new Map<string, { start: number; end: number; title: string }[]>()
  const occupy = (roomId: string, start: number, duration: number, title: string) => {
    busy.set(roomId, [...(busy.get(roomId) ?? []), { start, end: start + duration + cleaningMinutes, title }])
  }
  const scheduled = new Set<string>()
  const roomOf = (id: string) => rooms.find(room => room.id === id)
  for (const screening of existing) {
    const room = roomOf(screening.roomId)
    if (!room) continue
    scheduled.add([screening.movieId, room.complexId, screening.date, screening.startTime, room.type, screening.projection, screening.language].join('|'))
    occupy(room.id, toMinutes(screening.date, screening.startTime), screening.durationMinutes, screening.title)
  }

  const candidates = [...request.dates].sort().flatMap(date => [...request.times].sort().flatMap(time =>
    movies.flatMap(movie => request.languages.flatMap(language => targets.map(target => ({
      ...target, movie, date, time, language,
      key: [movie.id, target.complexId, date, time, target.roomType, target.projection, language, target.fixed?.id ?? 'auto'].join('|')
    }))))))

  // Se asignan primero las salas elegidas a mano y luego los formatos con menos salas compatibles.
  const order = [
    ...candidates.filter(c => c.fixed !== null),
    ...candidates.filter(c => c.fixed === null).sort((a, b) => a.matching.length - b.matching.length)
  ]
  const planned = new Map<string, PlannedRow>()
  for (const c of order) {
    const end = endTime(c.time, c.movie.durationMinutes)
    const row: PlannedRow = {
      key: c.key, movie: c.movie, complexId: c.complexId, roomType: c.roomType, projection: c.projection, language: c.language,
      date: c.date, startTime: c.time, endTime: end.time, endsNextDay: end.nextDay, room: c.fixed, problem: null
    }
    planned.set(c.key, row)
    if (input.excluded?.has(c.key)) continue

    const label = `${names.roomType(c.roomType)} ${names.projection(c.projection)}`
    if (c.movie.releaseDate && c.date < c.movie.releaseDate) row.problem = 'La fecha es anterior al estreno'
    else if (c.movie.lastDay && c.date > c.movie.lastDay) row.problem = 'La fecha es posterior al último día de exhibición'
    else if (c.date < now.date || (c.date === now.date && c.time <= now.time)) row.problem = 'El horario ya pasó'
    else if (scheduled.has([c.movie.id, c.complexId, c.date, c.time, c.roomType, c.projection, c.language].join('|'))) row.problem = 'Esta función ya está programada'
    else if (!c.matching.length) row.problem = `El complejo no tiene salas ${label}`
    if (row.problem) continue

    const start = toMinutes(c.date, c.time)
    const finish = start + c.movie.durationMinutes + cleaningMinutes
    const clash = (room: PlanRoom) => busy.get(room.id)?.find(b => start < b.end && b.start < finish)
    const free = c.matching.filter(room => !clash(room))
    const room = c.fixed ?? free[0]
    if (!room) {
      const detail = c.matching.length <= 2 ? `: ${c.matching.map(r => `sala ${r.number} ocupada por ${clash(r)!.title}`).join(', ')}` : ''
      row.problem = `No quedan salas ${label} libres${detail}`
      continue
    }
    const conflict = clash(room)
    if (conflict) {
      const others = free.length ? `. Libres: ${free.map(r => r.number).sort((a, b) => a - b).join(', ')}` : ''
      row.problem = `Sala ${room.number} ocupada por ${conflict.title}${others}`
      continue
    }
    row.room = room
    occupy(room.id, start, c.movie.durationMinutes, c.movie.title)
  }
  return { rows: candidates.map(c => planned.get(c.key)!), tooMany: false }
}
