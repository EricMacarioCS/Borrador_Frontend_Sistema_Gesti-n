import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import type { ClubLevel } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import { numberValue, useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'

const EMPTY: ClubLevel = { id: '', version: 0, name: '', minVisits: 0, maxVisits: null, pointsPercent: 0, benefits: '' }

export default function ClubLevelDialog({ level, onClose }: { level: ClubLevel | null; onClose: () => void }) {
  const { promotions } = useServices()
  const queryClient = useQueryClient()
  const id = useId()
  const { draft, update, dirty } = useDraft(!!level, () => ({ level: { ...(level ?? EMPTY) }, unlimited: level?.maxVisits === null }))
  const d = draft.level
  const setLevel = (patch: Partial<ClubLevel>) => update({ level: { ...d, ...patch } })

  const problem = !level ? null
    : !d.name.trim() ? 'Escribe el nombre del nivel.'
      : !Number.isInteger(d.minVisits) || d.minVisits < 0 ? 'Las visitas mínimas son un entero de 0 en adelante.'
        : !draft.unlimited && (!Number.isInteger(d.maxVisits) || (d.maxVisits ?? 0) < d.minVisits) ? 'Las visitas máximas no pueden ser menores que las mínimas.'
          : !(d.pointsPercent >= 0 && d.pointsPercent <= 100) ? 'El porcentaje de puntos va de 0 a 100.' : null

  const save = useMutation({
    mutationFn: () => promotions.saveClubLevel({ ...d, maxVisits: draft.unlimited ? null : d.maxVisits }),
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.clubLevels() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`Nivel ${saved.name} actualizado.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!problem) save.mutate()
  }

  return (
    <BaseDialog open={!!level} label={level ? `Nivel ${level.name}` : 'Nivel'} eyebrow="Club Cinépolis" size="small" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={!!problem || !dirty || save.isPending}>Guardar</button>
      </>}>
      {level && (
        <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
          <div className="field full">
            <label htmlFor={`${id}-name`}>Nombre</label>
            <input id={`${id}-name`} value={d.name} onChange={e => setLevel({ name: e.target.value })} className="input" maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-min`}>Visitas mínimas por semestre</label>
            <input id={`${id}-min`} value={numberValue(d.minVisits)} onChange={e => setLevel({ minVisits: e.target.valueAsNumber })} className="input" type="number" min={0} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-max`}>Visitas máximas</label>
            <input id={`${id}-max`} value={numberValue(d.maxVisits ?? NaN)} onChange={e => setLevel({ maxVisits: e.target.valueAsNumber })} className="input" type="number" min={0} disabled={draft.unlimited} />
          </div>
          <label className="check full"><input checked={draft.unlimited} onChange={e => update({ unlimited: e.target.checked })} type="checkbox" /> Sin límite superior</label>
          <div className="field full">
            <label htmlFor={`${id}-points`}>Porcentaje del gasto que se vuelve puntos</label>
            <input id={`${id}-points`} value={numberValue(d.pointsPercent)} onChange={e => setLevel({ pointsPercent: e.target.valueAsNumber })} className="input" type="number" min={0} max={100} step={0.5} />
          </div>
          <div className="field full">
            <label htmlFor={`${id}-benefits`}>Beneficios</label>
            <textarea id={`${id}-benefits`} value={d.benefits} onChange={e => setLevel({ benefits: e.target.value })} className="textarea" maxLength={1000} />
          </div>
          {problem && <p className="field-error full">{problem}</p>}
        </form>
      )}
    </BaseDialog>
  )
}
