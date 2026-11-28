/**
 * Plano de asientos de una sala (`asiento_plantilla`). Las columnas sin asiento son pasillos: así el plano
 * irregular se guarda sin columnas nuevas. Solo afecta a las funciones que se creen después.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { keys, useSeatTemplate } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { SEAT_LABELS } from '@/domain/labels'
import type { Room, SeatKind, SeatTemplateRow } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import StateView from '@/shared/ui/StateView'
import { useSyncedState } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import { clone } from '@/shared/lib/clone'
import './SeatTemplateDialog.css'

type Brush = SeatKind | 'aisle'
const SEAT_KINDS = Object.keys(SEAT_LABELS) as SeatKind[]
const BRUSHES: { value: Brush; label: string }[] = [...SEAT_KINDS.map(value => ({ value, label: SEAT_LABELS[value] })), { value: 'aisle', label: 'Pasillo (sin asiento)' }]
const letter = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `A${String.fromCharCode(65 + index - 26)}`
const seatAt = (row: SeatTemplateRow, column: number) => row.seats.find(seat => seat.column === column)

export default function SeatTemplateDialog({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const store = useSession()
  const { complexes } = useServices()
  const queryClient = useQueryClient()
  const template = useSeatTemplate(room?.id ?? null)

  const [brush, setBrush] = useState<Brush>('standard')
  const saved = template.data?.rows
  const [plan, setPlan] = useSyncedState([saved], () => ({
    rows: clone(saved ?? []),
    columns: Math.max(1, ...(saved ?? []).flatMap(row => row.seats.map(seat => seat.column)))
  }))
  const { rows, columns } = plan
  const setRows = (next: SeatTemplateRow[]) => setPlan({ ...plan, rows: next })

  const dirty = JSON.stringify(rows) !== JSON.stringify(saved ?? [])
  const capacity = rows.reduce((sum, row) => sum + row.seats.length, 0)
  const counts = Object.fromEntries(SEAT_KINDS.map(kind => [kind, rows.reduce((sum, row) => sum + row.seats.filter(seat => seat.kind === kind).length, 0)])) as Record<SeatKind, number>

  function paint(index: number, column: number) {
    setRows(rows.map((row, i) => {
      if (i !== index) return row
      if (brush === 'aisle') return { ...row, seats: row.seats.filter(s => s.column !== column) }
      if (seatAt(row, column)) return { ...row, seats: row.seats.map(s => (s.column === column ? { ...s, kind: brush } : s)) }
      return { ...row, seats: [...row.seats, { column, kind: brush }].sort((a, b) => a.column - b.column) }
    }))
  }
  function addRow() {
    const last = rows.at(-1)
    setRows([...rows, { label: letter(rows.length), seats: last ? last.seats.map(seat => ({ column: seat.column, kind: 'standard' as const })) : [{ column: 1, kind: 'standard' }] }])
  }
  function removeRow() {
    if (rows.length > 1) setRows(rows.slice(0, -1))
  }
  function setColumns(value: number) {
    const next = Math.min(40, Math.max(1, value))
    setPlan({ columns: next, rows: rows.map(row => ({ ...row, seats: row.seats.filter(seat => seat.column <= next) })) })
  }

  const save = useMutation({
    mutationFn: () => complexes.saveSeatTemplate({ roomId: room!.id, version: template.data!.version, rows }),
    onSuccess: async result => {
      queryClient.setQueryData(keys.seatTemplate(result.roomId), result)
      void queryClient.invalidateQueries({ queryKey: keys.allRooms() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      await store.loadReference()
      toast(`Plano guardado: ${capacity} asientos.`)
      onClose()
    },
    onError: toastError
  })

  return (
    <BaseDialog open={!!room} label={room ? `Plano de la sala ${room.number}` : 'Plano'} eyebrow={room ? `${store.complexName(room.complexId)} · ${room.type.name}` : undefined}
      size="wide" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={!dirty || !capacity || save.isPending} onClick={() => save.mutate()}>Guardar plano</button>
      </>}>
      <StateView loading={template.isPending} error={template.error} skeleton="block" onRetry={() => void template.refetch()}>
        <div className="seat-template">
          <div className="tools">
            <fieldset className="brushes">
              <legend className="field-label">Al hacer clic en una butaca, marcarla como:</legend>
              {BRUSHES.map(item => (
                <label key={item.value} className={`check k-${item.value}`}>
                  <input checked={brush === item.value} onChange={() => setBrush(item.value)} type="radio" name="brush" value={item.value} /> <i aria-hidden="true" /> {item.label}
                </label>
              ))}
            </fieldset>
            <div className="field">
              <span className="field-label">Columnas</span>
              <div className="stepper">
                <button type="button" className="icon-btn" aria-label="Quitar columna" onClick={() => setColumns(columns - 1)}><Minus size={16} /></button>
                <strong>{columns}</strong>
                <button type="button" className="icon-btn" aria-label="Agregar columna" onClick={() => setColumns(columns + 1)}><Plus size={16} /></button>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Filas</span>
              <div className="stepper">
                <button type="button" className="icon-btn" aria-label="Quitar la última fila" disabled={rows.length <= 1} onClick={removeRow}><Minus size={16} /></button>
                <strong>{rows.length}</strong>
                <button type="button" className="icon-btn" aria-label="Agregar una fila" disabled={rows.length >= 30} onClick={addRow}><Plus size={16} /></button>
              </div>
            </div>
            <dl className="totals">
              <div><dt>Capacidad</dt><dd>{capacity}</dd></div>
              {SEAT_KINDS.map(kind => <div key={kind}><dt>{SEAT_LABELS[kind]}</dt><dd>{counts[kind]}</dd></div>)}
            </dl>
            <p className="field-hint">Los cambios aplican a las funciones que se creen después; las ya programadas conservan su plano.</p>
          </div>
          <div className="map" role="grid" aria-label={`Plano de ${rows.length} filas`}>
            <div className="screen" aria-hidden="true">PANTALLA</div>
            {rows.map((row, index) => (
              <div key={row.label} className="row" role="row">
                <span className="label" role="rowheader">{row.label}</span>
                {Array.from({ length: columns }, (_, i) => i + 1).map(column => {
                  const seat = seatAt(row, column)
                  return (
                    <button key={column} type="button" role="gridcell" className={`seat ${seat ? `k-${seat.kind}` : 'k-aisle'}`}
                      aria-label={`Fila ${row.label}, columna ${column}: ${seat ? SEAT_LABELS[seat.kind] : 'pasillo'}`} onClick={() => paint(index, column)} />
                  )
                })}
                <span className="label" aria-hidden="true">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      </StateView>
    </BaseDialog>
  )
}
