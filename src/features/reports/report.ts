/**
 * Cálculos del panel principal y de Reportes. Todas las cifras salen de los mismos renglones diarios
 * que entrega el servidor (`GET /reports/daily-sales`). Importes en centavos.
 */
import type { Complex, DailySales } from '@/domain/models'
import { addDays } from '@/shared/lib/datetime'

export const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Últimos 7 días' },
  { id: 'month', label: 'Últimos 30 días' },
  { id: 'year', label: 'Este año' }
] as const
export type PeriodId = typeof PERIODS[number]['id']

export const CATEGORIES = [
  { id: 'tickets', label: 'Boletos' },
  { id: 'food', label: 'Alimentos' },
  { id: 'other', label: 'Otros' }
] as const
export type CategoryId = typeof CATEGORIES[number]['id']

export interface Totals {
  tickets: number
  food: number
  other: number
  total: number
  ticketCount: number
  transactions: number
  /** Ticket promedio por transacción, en centavos. */
  average: number
}
export interface DateRange { start: string; end: string }
export interface ChartPoint { key: string; label: string; title: string; totals: Totals }

/** El año se compara contra las mismas fechas del año anterior; lo demás, contra los días inmediatos anteriores. */
export function rangesFor(period: PeriodId, today: string): { current: DateRange; previous: DateRange } {
  if (period === 'year') {
    const year = Number(today.slice(0, 4))
    const monthDay = today.slice(5) === '02-29' ? '02-28' : today.slice(5)
    return { current: { start: `${year}-01-01`, end: today }, previous: { start: `${year - 1}-01-01`, end: `${year - 1}-${monthDay}` } }
  }
  const days = { today: 1, week: 7, month: 30 }[period]
  const start = addDays(today, 1 - days)
  return { current: { start, end: today }, previous: { start: addDays(start, -days), end: addDays(start, -1) } }
}

/** Un solo rango que cubre el periodo actual y el anterior, para pedirlo al servidor en una consulta. */
export function fetchRange(period: PeriodId, today: string) {
  const { current, previous } = rangesFor(period, today)
  return { from: previous.start, to: current.end }
}

export function sumSales(rows: DailySales[]): Totals {
  const sum = { tickets: 0, food: 0, other: 0, ticketCount: 0, transactions: 0 }
  for (const row of rows) {
    sum.tickets += row.ticketsCents
    sum.food += row.foodCents
    sum.other += row.otherCents
    sum.ticketCount += row.ticketCount
    sum.transactions += row.transactions
  }
  const total = sum.tickets + sum.food + sum.other
  return { ...sum, total, average: sum.transactions ? Math.round(total / sum.transactions) : 0 }
}

export function percentChange(current: number, previous: number): number | null {
  return previous ? Math.round((current - previous) / previous * 1000) / 10 : null
}

/** Porcentajes con un decimal que siempre suman 100 (método del resto mayor). */
export function percentages(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0)
  if (!total) return values.map(() => 0)
  const exact = values.map(value => value / total * 1000)
  const result = exact.map(Math.floor)
  const missing = 1000 - result.reduce((a, b) => a + b, 0)
  exact.map((value, i) => ({ i, rest: value - result[i]! }))
    .sort((a, b) => b.rest - a.rest)
    .slice(0, missing)
    .forEach(({ i }) => { result[i]!++ })
  return result.map(value => value / 10)
}

const inRange = (row: DailySales, range: DateRange) => row.date >= range.start && row.date <= range.end

function dateText(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', { ...options, timeZone: 'UTC' }).replace('.', '')
}

export function formatRange({ start, end }: DateRange) {
  const full: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (start === end) return dateText(end, full)
  const from = dateText(start, start.slice(0, 4) === end.slice(0, 4) ? { day: 'numeric', month: 'short' } : full)
  return `${from} – ${dateText(end, full)}`
}

function datesIn({ start, end }: DateRange) {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
  return Array.from({ length: days }, (_, i) => addDays(start, i))
}

// Un punto por día; en el año, uno por mes.
function chartPoints(rows: DailySales[], period: PeriodId, range: DateRange): ChartPoint[] {
  const monthly = period === 'year'
  const dates = datesIn(range)
  const keys = monthly ? [...new Set(dates.map(date => date.slice(0, 7)))] : dates
  return keys.map((key, i) => {
    const date = monthly ? `${key}-01` : key
    // En 30 días se rotula uno de cada siete, terminando siempre en el último.
    const label = monthly ? dateText(date, { month: 'short' }).slice(0, 3)
      : period !== 'month' ? `${dateText(date, { weekday: 'short' })} ${Number(date.slice(8))}`
        : (keys.length - 1 - i) % 7 === 0 ? `${date.slice(8)}/${date.slice(5, 7)}` : ''
    const title = dateText(date, monthly ? { month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })
    return { key, label, title, totals: sumSales(rows.filter(row => row.date.startsWith(key))) }
  })
}

export function buildReport(rows: DailySales[], complexes: Complex[], complexId: string | null, period: PeriodId, today: string) {
  const ranges = rangesFor(period, today)
  const scope = complexId === null ? complexes : complexes.filter(c => c.id === complexId)
  const inScope = new Set(scope.map(c => c.id))
  const visible = new Set(complexes.map(c => c.id))
  const chain = rows.filter(row => visible.has(row.complexId) && inRange(row, ranges.current))
  const chainBefore = rows.filter(row => visible.has(row.complexId) && inRange(row, ranges.previous))

  // La participación es respecto a todos los complejos visibles, aunque se consulte uno solo.
  const shares = percentages(complexes.map(c => sumSales(chain.filter(row => row.complexId === c.id)).total))
  const byComplex = scope.map(complex => ({
    complex,
    totals: sumSales(chain.filter(row => row.complexId === complex.id)),
    previous: sumSales(chainBefore.filter(row => row.complexId === complex.id)),
    share: shares[complexes.indexOf(complex)] ?? 0
  }))
  const daily = chain.filter(row => inScope.has(row.complexId))
  const totals = sumSales(daily)
  const mix = percentages(CATEGORIES.map(category => totals[category.id]))

  return {
    period,
    periodLabel: PERIODS.find(p => p.id === period)!.label,
    comparisonLabel: period === 'today' ? 'vs. día anterior' : period === 'year' ? 'vs. año anterior' : 'vs. periodo anterior',
    scopeLabel: complexId === null ? 'Todos los complejos' : scope[0]?.name ?? '',
    range: ranges.current,
    previousRange: ranges.previous,
    totals,
    previous: sumSales(chainBefore.filter(row => inScope.has(row.complexId))),
    share: complexId === null ? 100 : byComplex[0]?.share ?? 0,
    byComplex,
    mix: CATEGORIES.map((category, i) => ({ ...category, amount: totals[category.id], percent: mix[i]! })),
    points: chartPoints(daily, period, ranges.current)
  }
}

export type Report = ReturnType<typeof buildReport>

/* Exportación CSV */

const money = (cents: number) => (cents / 100).toFixed(2)

export function summaryRows(report: Report): string[][] {
  return [
    ['Concepto', 'Periodo actual', 'Periodo anterior'],
    ['Ingresos totales', money(report.totals.total), money(report.previous.total)],
    ['Boletos', money(report.totals.tickets), money(report.previous.tickets)],
    ['Alimentos', money(report.totals.food), money(report.previous.food)],
    ['Otros', money(report.totals.other), money(report.previous.other)],
    ['Boletos vendidos', String(report.totals.ticketCount), String(report.previous.ticketCount)],
    ['Ticket promedio', money(report.totals.average), money(report.previous.average)]
  ]
}

export function detailRows(report: Report): string[][] {
  return [
    ['Complejo', 'Boletos vendidos', 'Boletos (MXN)', 'Alimentos (MXN)', 'Otros (MXN)', 'Total (MXN)', 'Periodo anterior (MXN)', 'Participación (%)'],
    ...report.byComplex.map(row => [
      row.complex.name, String(row.totals.ticketCount), money(row.totals.tickets), money(row.totals.food), money(row.totals.other),
      money(row.totals.total), money(row.previous.total), row.share.toFixed(1)
    ])
  ]
}

/** CSV con BOM para que Excel respete los acentos; las celdas que empiezan con = + - @ se neutralizan. */
export function toCsv(rows: string[][]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value
    return /[",\n;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
  }
  return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, rows: string[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
