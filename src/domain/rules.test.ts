import { describe, expect, it } from 'vitest'
import { can, canManageComplex, centsToPesos, endTime, movieDatesProblem, movieStage, pesosToCents, slugify } from './rules'
import type { Session } from './models'

describe('reglas del dominio', () => {
  it('etapa de cartelera según la fecha de negocio', () => {
    const movie = { releaseDate: '2026-12-10', presaleFrom: '2026-12-01', lastDay: '2027-01-31' }
    expect(movieStage(movie, '2026-11-30')).toBe('coming-soon')
    expect(movieStage(movie, '2026-12-01')).toBe('presale')
    expect(movieStage(movie, '2026-12-10')).toBe('premiere')
    expect(movieStage(movie, '2026-12-25')).toBe('now-showing')
    expect(movieStage(movie, '2027-02-01')).toBe('finished')
  })

  it('fechas de cartelera coherentes', () => {
    expect(movieDatesProblem({ releaseDate: '2026-12-10', presaleFrom: '2026-12-11', lastDay: null })).toMatch(/preventa/)
    expect(movieDatesProblem({ releaseDate: '2026-12-10', presaleFrom: null, lastDay: '2026-12-09' })).toMatch(/último día/)
    expect(movieDatesProblem({ releaseDate: null, presaleFrom: '2026-12-01', lastDay: null })).toMatch(/estreno/)
    expect(movieDatesProblem({ releaseDate: null, presaleFrom: null, lastDay: null })).toBeNull()
  })

  it('pesos escritos a centavos sin errores de punto flotante', () => {
    expect(pesosToCents('85.5')).toBe(8550)
    expect(pesosToCents('$1,234.07')).toBe(123407)
    expect(pesosToCents('0.1')).toBe(10)
    expect(pesosToCents('1.234')).toBeNull()
    expect(pesosToCents('-5')).toBeNull()
    expect(centsToPesos(8550)).toBe('85.50')
    expect(centsToPesos(9000)).toBe('90')
  })

  it('hora de término y cruce de medianoche', () => {
    expect(endTime('22:30', 125)).toEqual({ time: '00:35', nextDay: true })
    expect(endTime('11:00', 98)).toEqual({ time: '12:38', nextDay: false })
  })

  it('URL amigable sin acentos ni signos', () => {
    expect(slugify('¡El Último Verano: Edición 2!')).toBe('el-ultimo-verano-edicion-2')
  })

  it('permisos y alcance', () => {
    const session: Session = { user: null, permissions: ['screenings.manage'], complexIds: ['a'], csrfToken: null }
    expect(can(session, 'screenings.manage')).toBe(true)
    expect(can(session, 'prices.manage')).toBe(false)
    expect(canManageComplex(session, 'a')).toBe(true)
    expect(canManageComplex(session, 'b')).toBe(false)
    expect(canManageComplex({ ...session, complexIds: null }, 'b')).toBe(true)
  })
})
