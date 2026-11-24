/**
 * Matriz de precios de un complejo. En la base de datos cada precio es explícito (`precio_boleto`):
 * complejo + tipo de sala + proyección + tipo de boleto. La calculadora solo ayuda a llenarla.
 */
import type { Labeled, Room, TicketPrice, TicketType } from '@/domain/models'

export interface MatrixRow {
  roomType: Labeled
  projection: Labeled
  /** Centavos por tipo de boleto; `null` si está vacío o no es válido. */
  prices: Record<string, number | null>
  /** Cargo por servicio en línea por boleto, igual para todos los tipos de la fila. */
  onlineFeeCents: number | null
  /** La combinación existe en las salas del complejo. Si no, es un precio viejo sin salas. */
  inUse: boolean
}

export function buildMatrix(rooms: Room[], prices: TicketPrice[], ticketTypes: TicketType[], roomTypes: Labeled[], projections: Labeled[]): MatrixRow[] {
  const combos = new Map<string, { roomType: string; projection: string; inUse: boolean }>()
  for (const room of rooms) for (const p of room.projections) combos.set(`${room.type.code}|${p.code}`, { roomType: room.type.code, projection: p.code, inUse: true })
  for (const price of prices) {
    const key = `${price.roomType}|${price.projection}`
    if (!combos.has(key)) combos.set(key, { roomType: price.roomType, projection: price.projection, inUse: false })
  }
  const order = (code: string, list: Labeled[]) => { const i = list.findIndex(item => item.code === code); return i < 0 ? 99 : i }
  return [...combos.values()]
    .sort((a, b) => order(a.roomType, roomTypes) - order(b.roomType, roomTypes) || order(a.projection, projections) - order(b.projection, projections))
    .map(combo => {
      const own = prices.filter(p => p.roomType === combo.roomType && p.projection === combo.projection)
      return {
        roomType: roomTypes.find(t => t.code === combo.roomType) ?? { code: combo.roomType, name: combo.roomType },
        projection: projections.find(p => p.code === combo.projection) ?? { code: combo.projection, name: combo.projection },
        prices: Object.fromEntries(ticketTypes.map(type => [type.id, own.find(p => p.ticketTypeId === type.id)?.priceCents ?? null])),
        onlineFeeCents: own[0]?.onlineFeeCents ?? null,
        inUse: combo.inUse
      }
    })
}

export function toPrices(rows: MatrixRow[]): TicketPrice[] {
  return rows.flatMap(row => Object.entries(row.prices)
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .map(([ticketTypeId, priceCents]) => ({ roomType: row.roomType.code, projection: row.projection.code, ticketTypeId, priceCents, onlineFeeCents: row.onlineFeeCents ?? 0 })))
}

export interface Calculator {
  baseCents: number
  roomSurcharges: Record<string, number>
  projectionSurcharges: Record<string, number>
  /** Porcentaje del precio completo que paga cada tipo de boleto. */
  percents: Record<string, number>
  onlineFeeCents: number
}

/** Precio completo = base + recargo de sala + recargo de proyección; cada tipo paga su porcentaje, redondeado al peso. */
export function calculate(row: MatrixRow, calc: Calculator): MatrixRow {
  const full = calc.baseCents + (calc.roomSurcharges[row.roomType.code] ?? 0) + (calc.projectionSurcharges[row.projection.code] ?? 0)
  return {
    ...row,
    onlineFeeCents: calc.onlineFeeCents,
    prices: Object.fromEntries(Object.keys(row.prices).map(id => [id, Math.round(full * (calc.percents[id] ?? 100) / 100 / 100) * 100]))
  }
}
