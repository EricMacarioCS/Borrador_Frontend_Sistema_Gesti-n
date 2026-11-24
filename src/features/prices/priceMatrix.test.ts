import { describe, expect, it } from 'vitest'
import { buildMatrix, calculate, toPrices } from './priceMatrix'
import type { Room, TicketType } from '@/domain/models'

const L = (code: string) => ({ code, name: code.toUpperCase() })
const room = (type: string, projections: string[]): Room => ({ id: type, version: 1, complexId: 'c', number: 1, name: 'Sala', type: L(type), projections: projections.map(L), capacity: 100 })
const types: TicketType[] = [
  { id: 'general', version: 1, name: 'General', description: '', isPromotional: false, fixedPriceCents: null },
  { id: 'nino', version: 1, name: 'Niño', description: '', isPromotional: false, fixedPriceCents: null }
]
const roomTypes = [L('traditional'), L('imax')]
const projections = [L('2d'), L('3d')]

describe('matriz de tarifas', () => {
  it('una fila por combinación de sala y proyección que existe en el complejo, más los precios viejos sin sala', () => {
    const rows = buildMatrix([room('traditional', ['2d', '3d'])], [
      { roomType: 'traditional', projection: '2d', ticketTypeId: 'general', priceCents: 8500, onlineFeeCents: 600 },
      { roomType: 'imax', projection: '2d', ticketTypeId: 'general', priceCents: 13000, onlineFeeCents: 600 }
    ], types, roomTypes, projections)
    expect(rows.map(r => `${r.roomType.code}-${r.projection.code}-${r.inUse}`)).toEqual(['traditional-2d-true', 'traditional-3d-true', 'imax-2d-false'])
    expect(rows[0]!.prices).toEqual({ general: 8500, nino: null })
  })

  it('las celdas vacías no se envían', () => {
    const rows = buildMatrix([room('traditional', ['2d'])], [], types, roomTypes, projections)
    rows[0]!.prices.general = 9000
    rows[0]!.onlineFeeCents = 600
    expect(toPrices(rows)).toEqual([{ roomType: 'traditional', projection: '2d', ticketTypeId: 'general', priceCents: 9000, onlineFeeCents: 600 }])
  })

  it('la calculadora suma recargos y redondea cada porcentaje al peso', () => {
    const [row] = buildMatrix([room('imax', ['3d'])], [], types, roomTypes, projections)
    const result = calculate(row!, { baseCents: 8500, roomSurcharges: { imax: 4500 }, projectionSurcharges: { '3d': 2500 }, percents: { general: 100, nino: 75 }, onlineFeeCents: 600 })
    expect(result.prices).toEqual({ general: 15500, nino: 11600 })
    expect(result.onlineFeeCents).toBe(600)
  })
})
