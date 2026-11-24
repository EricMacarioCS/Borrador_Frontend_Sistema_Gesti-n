import { describe, expect, it, vi } from 'vitest'
import { ScreeningDto, SessionDto, StockMovementDto } from './schemas'
import { parse, toScreening, toSession } from './mappers'
import { ApiError } from '@/shared/lib/errors'

const screening = {
  id: 's-1', version: 1, movieId: 'm-1', movieTitle: 'Película', complexId: 'c-1',
  room: { id: 'r-1', number: 5, type: { code: 'traditional', name: 'Tradicional' } },
  projection: { code: '2d', name: '2D' }, language: { code: 'es', name: 'Español' },
  date: '2026-11-24', startTime: '19:30', endTime: '21:40', endsNextDay: false, isPresale: false, active: true, ticketsSold: 0
}

function malformed(run: () => unknown) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('MALFORMED_RESPONSE')
    return
  }
  throw new Error('Se esperaba MALFORMED_RESPONSE')
}

describe('conversión de respuestas', () => {
  it('convierte una función válida al modelo', () => {
    expect(toScreening(parse(ScreeningDto, screening, 'screening'))).toMatchObject({ roomId: 'r-1', roomNumber: 5, startTime: '19:30' })
  })

  it('rechaza horas y fechas con otro formato', () => {
    malformed(() => parse(ScreeningDto, { ...screening, startTime: '7:30 PM' }, 'screening'))
    malformed(() => parse(ScreeningDto, { ...screening, date: '24/11/2026' }, 'screening'))
  })

  it('un instante sin zona se rechaza', () => {
    malformed(() => parse(StockMovementDto, { id: '1', productName: 'P', before: 1, after: 2, reason: 'other', note: '', author: 'A', at: '2026-11-24T10:00:00' }, 'movement'))
  })

  it('un permiso desconocido nunca concede acceso', () => {
    const session = toSession(parse(SessionDto, { user: null, permissions: ['orders.view', 'superusuario'], complexIds: null, csrfToken: 't' }, 'session'))
    expect(session.permissions).toEqual(['orders.view'])
  })
})
