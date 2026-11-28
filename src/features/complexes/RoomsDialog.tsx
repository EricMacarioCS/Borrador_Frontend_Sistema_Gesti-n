/** Salas de un complejo: tipo estructural, proyecciones que admite y acceso al plano de asientos. */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Armchair, Check } from 'lucide-react'
import SeatTemplateDialog from './SeatTemplateDialog'
import { keys, useRooms } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Complex, Room } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import StateView from '@/shared/ui/StateView'
import { useSyncedState } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import './RoomsDialog.css'

interface RoomDraft { name: string; type: string; projections: string[] }

export default function RoomsDialog({ complex, onClose }: { complex: Complex | null; onClose: () => void }) {
  const store = useSession()
  const { complexes } = useServices()
  const queryClient = useQueryClient()
  const rooms = useRooms(complex?.id ?? null)
  const [drafts, setDrafts] = useSyncedState<Record<string, RoomDraft>>([rooms.data], () =>
    Object.fromEntries((rooms.data ?? []).map(room => [room.id, { name: room.name, type: room.type.code, projections: room.projections.map(p => p.code) }])))
  const [seatRoom, setSeatRoom] = useState<Room | null>(null)
  const updateDraft = (roomId: string, patch: Partial<RoomDraft>) => setDrafts(current => ({ ...current, [roomId]: { ...current[roomId]!, ...patch } }))

  const changed = (room: Room) => {
    const d = drafts[room.id]
    return Boolean(d) && (d!.name !== room.name || d!.type !== room.type.code || [...d!.projections].sort().join() !== room.projections.map(p => p.code).sort().join())
  }
  const dirty = (rooms.data ?? []).some(changed)

  const save = useMutation({
    mutationFn: (room: Room) => {
      const d = drafts[room.id]!
      return complexes.updateRoom({
        ...room, name: d.name.trim() || `Sala ${room.number}`,
        type: store.reference!.roomTypes.find(t => t.code === d.type)!,
        projections: store.reference!.projections.filter(p => d.projections.includes(p.code))
      })
    },
    onSuccess: room => {
      void queryClient.invalidateQueries({ queryKey: keys.rooms(room.complexId) })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`Sala ${room.number} actualizada.`)
    },
    onError: toastError
  })

  return (
    <BaseDialog open={!!complex} label={complex ? `Salas de ${complex.name}` : 'Salas'} eyebrow="Complejos y salas" size="wide" dirty={dirty} onClose={onClose}
      footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>}>
      <div className="rooms-dialog">
        <p className="notice small spaced">El tipo de sala es estructural y define su plano. La proyección (2D o 3D) se elige en cada función, entre las que la sala admite.</p>
        <StateView loading={rooms.isPending} error={rooms.error} skeleton="rows" onRetry={() => void rooms.refetch()}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Sala</th><th>Nombre</th><th>Tipo</th><th>Proyecciones</th><th className="num">Asientos</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {rooms.data?.map(room => {
                  const d = drafts[room.id]
                  if (!d) return null
                  return (
                    <tr key={room.id}>
                      <td><strong>{room.number}</strong></td>
                      <td><input value={d.name} onChange={e => updateDraft(room.id, { name: e.target.value })} className="input" aria-label={`Nombre de la sala ${room.number}`} maxLength={60} /></td>
                      <td>
                        <select value={d.type} onChange={e => updateDraft(room.id, { type: e.target.value })} className="select" aria-label={`Tipo de la sala ${room.number}`}>
                          {store.reference?.roomTypes.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className="projections">
                          {store.reference?.projections.map(p => (
                            <label key={p.code} className="check">
                              <input type="checkbox" value={p.code} checked={d.projections.includes(p.code)}
                                onChange={e => updateDraft(room.id, { projections: e.target.checked ? [...d.projections, p.code] : d.projections.filter(code => code !== p.code) })} /> {p.name}
                            </label>
                          ))}
                        </span>
                      </td>
                      <td className="num">{room.capacity}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button type="button" className="action" aria-label={`Plano de la sala ${room.number}`} onClick={() => setSeatRoom(room)}><Armchair size={15} /> Plano</button>
                          <button type="button" className="btn btn-primary btn-small" disabled={!changed(room) || !d.projections.length || save.isPending}
                            aria-label={`Guardar la sala ${room.number}`} onClick={() => save.mutate(room)}><Check size={15} /> Guardar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </StateView>
      </div>
      <SeatTemplateDialog room={seatRoom} onClose={() => setSeatRoom(null)} />
    </BaseDialog>
  )
}
