import { describe, expect, it } from 'vitest'
import { planScreenings, type PlanInput, type PlanRoom } from './planner'
import type { ScheduleRequest } from '@/domain/models'

const rooms: PlanRoom[] = [
  { id: 'r1', complexId: 'c', number: 1, type: 'traditional', projections: ['2d', '3d'] },
  { id: 'r2', complexId: 'c', number: 2, type: 'traditional', projections: ['2d'] },
  { id: 'r3', complexId: 'c', number: 3, type: 'imax', projections: ['2d', '3d'] }
]
const movie = { id: 'm', title: 'Película', durationMinutes: 120, releaseDate: '2026-12-01', lastDay: '2026-12-31' }
const base = (overrides: Partial<ScheduleRequest> = {}): ScheduleRequest => ({
  movieIds: ['m'], languages: ['es'], complexIds: ['c'], roomTypes: ['traditional'], projections: ['2d'], roomIds: [],
  dates: ['2026-12-10'], times: ['18:00'], ...overrides
})
const plan = (request: ScheduleRequest, extra: Partial<PlanInput> = {}) => planScreenings({
  request, movies: [movie], rooms, existing: [], now: { date: '2026-12-05', time: '12:00' }, cleaningMinutes: 20, maxBatch: 1000,
  names: { roomType: code => code, projection: code => code }, ...extra
})

describe('planeación de funciones', () => {
  it('prefiere la sala con menos proyecciones para dejar libre la que admite 3D', () => {
    expect(plan(base()).rows[0]!.room?.id).toBe('r2')
  })

  it('reserva la limpieza: una función que empieza antes de que termine la limpieza va a otra sala', () => {
    const rows = plan(base({ times: ['18:00', '20:10'] })).rows
    expect(rows.map(r => r.room?.id)).toEqual(['r2', 'r1'])
    // Con 20 min de limpieza, a las 20:20 la primera sala ya está libre.
    expect(plan(base({ times: ['18:00', '20:20'] })).rows.map(r => r.room?.id)).toEqual(['r2', 'r2'])
  })

  it('detecta traslapes que cruzan la medianoche', () => {
    const existing = [{ movieId: 'otra', roomId: 'r2', date: '2026-12-09', startTime: '23:30', projection: '2d', language: 'es', durationMinutes: 120, title: 'Nocturna' }]
    const rows = plan(base({ times: ['00:30'], roomIds: ['r2'] }), { existing }).rows
    expect(rows[0]!.problem).toMatch(/Sala 2 ocupada por Nocturna/)
  })

  it('valida fechas de exhibición, horarios pasados y salas inexistentes', () => {
    expect(plan(base({ dates: ['2026-11-30'] })).rows[0]!.problem).toBe('La fecha es anterior al estreno')
    expect(plan(base({ dates: ['2027-01-02'] })).rows[0]!.problem).toBe('La fecha es posterior al último día de exhibición')
    expect(plan(base(), { now: { date: '2026-12-10', time: '18:30' } }).rows[0]!.problem).toBe('El horario ya pasó')
    expect(plan(base({ roomTypes: ['4dx'] })).rows[0]!.problem).toMatch(/no tiene salas 4dx 2d/)
  })

  it('no duplica una función que ya existe en otra sala', () => {
    const existing = [{ movieId: 'm', roomId: 'r1', date: '2026-12-10', startTime: '18:00', projection: '2d', language: 'es', durationMinutes: 120, title: 'Película' }]
    expect(plan(base(), { existing }).rows[0]!.problem).toBe('Esta función ya está programada')
  })

  it('las desmarcadas no ocupan sala y el lote tiene un tope', () => {
    const first = plan(base({ times: ['18:00', '18:30'] })).rows[0]!
    const rows = plan(base({ times: ['18:00', '18:30'] }), { excluded: new Set([first.key]) }).rows
    expect(rows[1]!.room?.id).toBe('r2')
    expect(plan(base({ times: ['18:00', '18:30'] }), { maxBatch: 1 }).tooMany).toBe(true)
  })

  it('indica si la función termina al día siguiente', () => {
    const row = plan(base({ times: ['23:00'] })).rows[0]!
    expect(row).toMatchObject({ endTime: '01:00', endsNextDay: true })
  })
})
