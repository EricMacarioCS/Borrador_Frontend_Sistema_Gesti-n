import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calculator as CalculatorIcon, Check, Pencil, Plus, RotateCcw } from 'lucide-react'
import TicketTypeDialog from './TicketTypeDialog'
import { buildMatrix, calculate, toPrices, type Calculator, type MatrixRow } from './priceMatrix'
import { keys, usePriceSheet, useRooms, useTicketTypes } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { TicketType } from '@/domain/models'
import MoneyInput from '@/shared/ui/MoneyInput'
import StateView from '@/shared/ui/StateView'
import { useDirtyGuard } from '@/shared/hooks/dirty'
import { numberValue, useSyncedState } from '@/shared/hooks/draft'
import { confirmAction, toast, toastError } from '@/shared/hooks/feedback'
import { formatMoney } from '@/shared/lib/money'
import './PricesView.css'

const defaultPercent = (type: TicketType) => type.name === 'General' ? 100 : type.name === 'Niño' ? 75 : type.name.startsWith('Adulto') ? 80 : 100

export default function PricesView() {
  const store = useSession()
  const { prices: port } = useServices()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'prices' | 'types'>('prices')
  const [complexId, setComplexId] = useState(store.complexes[0]?.id ?? '')
  const sheet = usePriceSheet(complexId)
  const rooms = useRooms(complexId)
  const ticketTypes = useTicketTypes()
  const rateTypes = useMemo(() => (ticketTypes.data ?? []).filter(type => type.fixedPriceCents === null), [ticketTypes.data])
  const reference = store.reference

  const built = useMemo<MatrixRow[]>(() => sheet.data && rooms.data && ticketTypes.data && reference
    ? buildMatrix(rooms.data, sheet.data.prices, rateTypes, reference.roomTypes, reference.projections)
    : [], [sheet.data, rooms.data, ticketTypes.data, reference, rateTypes])
  const [rows, setRows] = useSyncedState([built], () => built)
  const updateRow = (index: number, change: (row: MatrixRow) => MatrixRow) => setRows(current => current.map((row, i) => (i === index ? change(row) : row)))

  const dirty = JSON.stringify(rows) !== JSON.stringify(built)
  useDirtyGuard(dirty)
  const invalidCells = rows.some(row => row.onlineFeeCents === null && Object.values(row.prices).some(v => v !== null))
  const empty = rows.filter(row => row.inUse).reduce((n, row) => n + Object.values(row.prices).filter(v => v === null).length, 0)

  async function changeComplex(next: string) {
    if (dirty && !await confirmAction({ title: 'Descartar cambios', text: 'Hay precios sin guardar en este complejo.', confirmLabel: 'Descartar', danger: true })) return
    setComplexId(next)
  }

  /* Calculadora */
  const [calcOpen, setCalcOpen] = useState(false)
  const [calc, setCalc] = useState<{ base: number | null; fee: number | null }>({ base: 8500, fee: 600 })
  const [roomSurcharge, setRoomSurcharge] = useState<Record<string, number | null>>({ 'traditional': 0, 'junior': 1000, 'macro-xe': 3000, 'imax': 4500, '4dx': 6000, 'vip': 7000 })
  const [projectionSurcharge, setProjectionSurcharge] = useState<Record<string, number | null>>({ '2d': 0, '3d': 2500 })
  const [percentEdits, setPercentEdits] = useState<Record<string, number>>({})
  const percents = Object.fromEntries(rateTypes.map(type => [type.id, percentEdits[type.id] ?? defaultPercent(type)]))
  const calcValid = calc.base !== null && calc.base > 0 && calc.fee !== null &&
    Object.values(roomSurcharge).every(v => v !== null) && Object.values(projectionSurcharge).every(v => v !== null) &&
    Object.values(percents).every(v => Number.isFinite(v) && v > 0 && v <= 100)
  function applyCalculator() {
    const settings: Calculator = {
      baseCents: calc.base!, onlineFeeCents: calc.fee!, percents,
      roomSurcharges: Object.fromEntries(Object.entries(roomSurcharge).map(([k, v]) => [k, v ?? 0])),
      projectionSurcharges: Object.fromEntries(Object.entries(projectionSurcharge).map(([k, v]) => [k, v ?? 0]))
    }
    setRows(rows.map(row => row.inUse ? calculate(row, settings) : row))
    setCalcOpen(false)
    toast('Se llenó la tabla. Revisa y guarda.', 'info')
  }

  const save = useMutation({
    mutationFn: () => port.saveSheet(complexId, sheet.data!.version, toPrices(rows)),
    onSuccess: saved => {
      queryClient.setQueryData(keys.priceSheet(saved.complexId), saved)
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`Tarifa de ${store.complexName(saved.complexId)} guardada.`)
    },
    onError: toastError
  })

  const [typeDialog, setTypeDialog] = useState<{ type: TicketType | null } | null>(null)

  return (
    <section className="prices-view">
      <div className="page-head">
        <div>
          <h1>Tarifas</h1>
          <p>Cada precio es explícito por complejo, tipo de sala, proyección y tipo de boleto. Las compras hechas conservan el precio que se cobró.</p>
        </div>
        {tab === 'prices' ? (
          <div className="page-actions">
            {dirty && <span className="pill warning" role="status">Cambios sin guardar</span>}
            <button type="button" className="btn btn-secondary" disabled={!dirty} onClick={() => setRows(built)}><RotateCcw size={16} /> Deshacer</button>
            <button type="button" className="btn btn-primary" disabled={!dirty || invalidCells || save.isPending} onClick={() => save.mutate()}><Check size={16} /> Guardar tarifa</button>
          </div>
        ) : store.chainAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setTypeDialog({ type: null })}><Plus size={16} /> Nuevo tipo de boleto</button>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones de tarifas">
        <button type="button" role="tab" aria-selected={tab === 'prices'} onClick={() => setTab('prices')}>Precios por complejo</button>
        <button type="button" role="tab" aria-selected={tab === 'types'} onClick={() => setTab('types')}>Tipos de boleto</button>
      </div>

      {tab === 'prices' ? (
        <>
          <div className="toolbar">
            <div className="field">
              <label htmlFor="tarifa-complejo">Complejo</label>
              <select id="tarifa-complejo" className="select" value={complexId} onChange={e => void changeComplex(e.target.value)}>
                {store.complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="button" className="btn btn-secondary" aria-expanded={calcOpen} onClick={() => setCalcOpen(!calcOpen)}><CalculatorIcon size={16} /> Calcular desde una tarifa base</button>
          </div>

          {calcOpen && (
            <div className="panel panel-pad calc">
              <p className="muted small">Precio completo = base + recargo del tipo de sala + recargo de la proyección. Cada tipo de boleto paga un porcentaje. Se redondea al peso y solo llena la tabla: nada se guarda hasta que pulses Guardar.</p>
              <div className="calc-grid">
                <div className="field"><label htmlFor="calc-base">Base General</label><MoneyInput id="calc-base" value={calc.base} onChange={base => setCalc({ ...calc, base })} /></div>
                <div className="field"><label htmlFor="calc-fee">Cargo en línea por boleto</label><MoneyInput id="calc-fee" value={calc.fee} onChange={fee => setCalc({ ...calc, fee })} /></div>
                {reference?.roomTypes.map(t => (
                  <div key={t.code} className="field">
                    <label htmlFor={`calc-room-${t.code}`}>Recargo {t.name}</label>
                    <MoneyInput id={`calc-room-${t.code}`} value={roomSurcharge[t.code] ?? null} onChange={v => setRoomSurcharge({ ...roomSurcharge, [t.code]: v })} />
                  </div>
                ))}
                {reference?.projections.map(p => (
                  <div key={p.code} className="field">
                    <label htmlFor={`calc-proj-${p.code}`}>Recargo {p.name}</label>
                    <MoneyInput id={`calc-proj-${p.code}`} value={projectionSurcharge[p.code] ?? null} onChange={v => setProjectionSurcharge({ ...projectionSurcharge, [p.code]: v })} />
                  </div>
                ))}
                {rateTypes.map(type => (
                  <div key={type.id} className="field">
                    <label htmlFor={`calc-pct-${type.id}`}>{type.name} paga (%)</label>
                    <input id={`calc-pct-${type.id}`} value={numberValue(percents[type.id]!)} onChange={e => setPercentEdits({ ...percentEdits, [type.id]: e.target.valueAsNumber })} className="input" type="number" min={1} max={100} />
                  </div>
                ))}
              </div>
              <div className="calc-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setCalcOpen(false)}>Cerrar</button>
                <button type="button" className="btn btn-primary" disabled={!calcValid} onClick={applyCalculator}>Llenar la tabla</button>
              </div>
            </div>
          )}

          <StateView loading={sheet.isPending || rooms.isPending || ticketTypes.isPending} error={sheet.error ?? rooms.error ?? ticketTypes.error}
            skeleton="rows" onRetry={() => { void sheet.refetch(); void rooms.refetch(); void ticketTypes.refetch() }}>
            {empty > 0 && <p className="notice warning small spaced">{empty} precios vacíos: esas combinaciones no se podrán vender en este complejo.</p>}
            <div className="panel table-wrap">
              <table className="data matrix">
                <thead>
                  <tr><th>Sala y proyección</th>{rateTypes.map(type => <th key={type.id}>{type.name}</th>)}<th>Cargo en línea</th></tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.roomType.code}-${row.projection.code}`} className={row.inUse ? undefined : 'row-off'}>
                      <td><span className="stack"><strong>{row.roomType.name} · {row.projection.name}</strong>{!row.inUse && <small>Ninguna sala la ofrece hoy</small>}</span></td>
                      {rateTypes.map(type => (
                        <td key={type.id}>
                          <MoneyInput value={row.prices[type.id] ?? null} onChange={v => updateRow(index, r => ({ ...r, prices: { ...r.prices, [type.id]: v } }))}
                            label={`${type.name}, ${row.roomType.name} ${row.projection.name}`} placeholder="Sin precio" />
                        </td>
                      ))}
                      <td>
                        <MoneyInput value={row.onlineFeeCents} onChange={v => updateRow(index, r => ({ ...r, onlineFeeCents: v }))}
                          label={`Cargo en línea, ${row.roomType.name} ${row.projection.name}`} invalid={row.onlineFeeCents === null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-hint spaced-top">Los tipos de boleto con precio fijo no aparecen aquí. La regla de no vender boleto de niño en B15, C y D la aplica el servidor.</p>
          </StateView>
        </>
      ) : (
        <>
          {!store.chainAdmin && <p className="notice small spaced">Los tipos de boleto son de toda la cadena: solo el administrador los crea o modifica.</p>}
          <StateView loading={ticketTypes.isPending} error={ticketTypes.error} skeleton="rows" onRetry={() => void ticketTypes.refetch()}>
            <div className="panel table-wrap">
              <table className="data">
                <thead><tr><th>Tipo de boleto</th><th>Descripción</th><th>Precio</th><th>Promocional</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {ticketTypes.data?.map(type => (
                    <tr key={type.id}>
                      <td><strong>{type.name}</strong></td>
                      <td>{type.description || '—'}</td>
                      <td>{type.fixedPriceCents === null ? 'Según la tarifa de cada complejo' : `${formatMoney(type.fixedPriceCents)} fijo`}</td>
                      <td>{type.isPromotional ? 'Sí' : 'No'}</td>
                      <td className="actions-col">{store.chainAdmin && <button type="button" className="action" aria-label={`Editar ${type.name}`} onClick={() => setTypeDialog({ type })}><Pencil size={15} /> Editar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StateView>
        </>
      )}

      <TicketTypeDialog open={!!typeDialog} type={typeDialog?.type ?? null} onClose={() => setTypeDialog(null)} />
    </section>
  )
}
