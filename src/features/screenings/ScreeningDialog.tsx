import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useRooms } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Screening, ScreeningUpdate } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'

const fromScreening = (screening: Screening | null): ScreeningUpdate => ({
  version: screening?.version ?? 0, roomId: screening?.roomId ?? '', date: screening?.date ?? '', startTime: screening?.startTime ?? '',
  projection: screening?.projection.code ?? '', language: screening?.language.code ?? '', active: screening?.active ?? true
})

export default function ScreeningDialog({ screening, onClose }: { screening: Screening | null; onClose: () => void }) {
  const store = useSession()
  const { screenings } = useServices()
  const queryClient = useQueryClient()
  const id = useId()
  const rooms = useRooms(screening?.complexId ?? null)
  const { draft, update, dirty } = useDraft(!!screening, () => fromScreening(screening))

  const sold = screening?.hasTicketsSold ?? false
  // Solo salas que proyectan en el formato elegido.
  const roomOptions = (rooms.data ?? []).filter(room => room.projections.some(p => p.code === draft.projection))

  const save = useMutation({
    mutationFn: () => screenings.update(screening!.id, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast('La función se actualizó.')
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <BaseDialog open={!!screening} label={screening ? `Editar ${screening.movieTitle}` : 'Editar función'} eyebrow={screening ? store.complexName(screening.complexId) : undefined}
      dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={save.isPending || !dirty}>{save.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
      </>}>
      {screening && (
        <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
          {sold && <p className="notice warning full">Tiene boletos vendidos: solo puedes cambiar el idioma o la proyección.</p>}
          <div className="field">
            <label htmlFor={`${id}-date`}>Fecha</label>
            <input id={`${id}-date`} value={draft.date} onChange={e => update({ date: e.target.value })} className="input" type="date" min={store.today()} disabled={sold} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-time`}>Hora de inicio</label>
            <input id={`${id}-time`} value={draft.startTime} onChange={e => update({ startTime: e.target.value })} className="input" type="time" step={300} disabled={sold} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-projection`}>Proyección</label>
            <select id={`${id}-projection`} value={draft.projection} onChange={e => update({ projection: e.target.value })} className="select">
              {store.reference?.projections.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-language`}>Idioma</label>
            <select id={`${id}-language`} value={draft.language} onChange={e => update({ language: e.target.value })} className="select">
              {store.reference?.languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div className="field full">
            <label htmlFor={`${id}-room`}>Sala</label>
            <select id={`${id}-room`} value={draft.roomId} onChange={e => update({ roomId: e.target.value })} className="select" disabled={sold || rooms.isPending}>
              {roomOptions.map(room => <option key={room.id} value={room.id}>Sala {room.number} · {room.type.name} · {room.projections.map(p => p.name).join(', ')}</option>)}
            </select>
            {!rooms.isPending && !roomOptions.some(room => room.id === draft.roomId) && <p className="field-error">La sala elegida no proyecta en este formato. Elige otra.</p>}
          </div>
          <label className="check full"><input checked={draft.active} onChange={e => update({ active: e.target.checked })} type="checkbox" disabled={sold} /> Función activa (a la venta)</label>
          <p className="field-hint full">Al guardar, el servidor revisa que la sala esté libre con {store.reference?.limits.cleaningMinutes} minutos de limpieza entre funciones.</p>
        </form>
      )}
    </BaseDialog>
  )
}
