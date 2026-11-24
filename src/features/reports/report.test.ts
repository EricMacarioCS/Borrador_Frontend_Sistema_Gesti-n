import { describe, expect, it } from 'vitest'
import { buildReport, detailRows, fetchRange, percentages, rangesFor, toCsv } from './report'
import type { Complex, DailySales } from '@/domain/models'

const complex = (id: string, name: string): Complex => ({
  id, name, slug: id, kind: 'traditional', cityId: 'c', cityName: 'Xalapa', address: '', postalCode: '91000', openedOn: '2020-01-01',
  imageUrl: null, vistaId: null, timeZone: 'America/Mexico_City', roomCount: 1, seatCount: 100, version: 1
})
const row = (date: string, complexId: string, tickets: number): DailySales => ({
  date, complexId, ticketsCents: tickets, foodCents: Math.round(tickets / 2), otherCents: 100, ticketCount: Math.round(tickets / 100), transactions: 2
})

describe('reportes', () => {
  it('compara contra el periodo inmediato anterior, y el año contra las mismas fechas del año pasado', () => {
    expect(rangesFor('week', '2026-11-24')).toEqual({ current: { start: '2026-11-18', end: '2026-11-24' }, previous: { start: '2026-11-11', end: '2026-11-17' } })
    expect(rangesFor('year', '2028-02-29').previous).toEqual({ start: '2027-01-01', end: '2027-02-28' })
    expect(fetchRange('today', '2026-11-24')).toEqual({ from: '2026-11-23', to: '2026-11-24' })
  })

  it('los porcentajes siempre suman 100 con un decimal', () => {
    const values = percentages([1, 1, 1])
    expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5)
    expect(percentages([0, 0])).toEqual([0, 0])
  })

  it('totales, variación y participación salen de los mismos renglones diarios', () => {
    const complexes = [complex('a', 'A'), complex('b', 'B')]
    const rows = [row('2026-11-24', 'a', 30000), row('2026-11-24', 'b', 10000), row('2026-11-23', 'a', 20000)]
    const report = buildReport(rows, complexes, 'a', 'today', '2026-11-24')
    expect(report.totals.tickets).toBe(30000)
    expect(report.previous.tickets).toBe(20000)
    expect(report.totals.total).toBe(30000 + 15000 + 100)
    // A vende 45 100 y B 15 100 ese día: A tiene el 74.9 % de lo que se ve.
    expect(report.share).toBe(74.9)
    expect(report.points).toHaveLength(1)
  })

  it('el CSV escapa comillas y neutraliza fórmulas', () => {
    const csv = toCsv([['=SUMA(A1)', 'Dijo "hola"', '-12.50']])
    expect(csv).toContain("'=SUMA(A1)")
    expect(csv).toContain('"Dijo ""hola"""')
    expect(csv).toContain('-12.50')
  })

  it('el detalle lleva un renglón por complejo con importes en pesos', () => {
    const report = buildReport([row('2026-11-24', 'a', 12345)], [complex('a', 'A')], null, 'today', '2026-11-24')
    expect(detailRows(report)[1]).toEqual(['A', '123', '123.45', '61.73', '1.00', '186.18', '0.00', '100.0'])
  })
})
