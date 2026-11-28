import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useClubLevels } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { PROMOTION_LABELS, WEEKDAYS } from '@/domain/labels'
import type { Promotion, PromotionInput, PromotionKind } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import MultiSelect from '@/shared/ui/MultiSelect'
import { numberValue, useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import { clone } from '@/shared/lib/clone'
import { addDays } from '@/shared/lib/datetime'

const kinds = Object.entries(PROMOTION_LABELS) as [PromotionKind, string][]
const dayOptions = WEEKDAYS.map((label, value) => ({ value, label }))

export default function PromotionDialog({ open, promotion, onClose }: { open: boolean; promotion: Promotion | null; onClose: () => void }) {
  const store = useSession()
  const { promotions } = useServices()
  const levels = useClubLevels()
  const queryClient = useQueryClient()
  const id = useId()

  const blank = (): PromotionInput => ({
    name: '', kind: '2x1', description: '', restrictions: 'No es acumulable.', validFrom: store.today(), validTo: addDays(store.today(), 30),
    appliesToAll: true, complexIds: [], clubLevelId: null, rules: { weekdays: [], roomTypes: [], projections: [], percent: null }
  })
  const { draft, update, dirty, touched, setTouched } = useDraft<PromotionInput>(open, () => {
    const { id: _i, version: _v, ...rest } = promotion ?? { id: '', version: 0, ...blank() }
    return clone(rest)
  })
  const updateRules = (patch: Partial<PromotionInput['rules']>) => update({ rules: { ...draft.rules, ...patch } })

  const d = draft
  const problem = !d.name.trim() || !d.description.trim() || !d.restrictions.trim() ? 'Completa nombre, descripción y restricciones.'
    : d.validTo && d.validTo < d.validFrom ? 'La vigencia termina antes de empezar.'
      : !d.appliesToAll && !d.complexIds.length ? 'Elige los complejos o márcala para toda la cadena.'
        : d.kind === 'percent' && !(Number(d.rules.percent) > 0 && Number(d.rules.percent) <= 100) ? 'El porcentaje va de 1 a 100.' : null

  const save = useMutation({
    mutationFn: () => {
      const input: PromotionInput = { ...d, name: d.name.trim(), complexIds: d.appliesToAll ? [] : d.complexIds, validTo: d.validTo || null,
        rules: { ...d.rules, percent: d.kind === 'percent' ? Number(d.rules.percent) : null } }
      return promotion ? promotions.update(promotion.id, { ...input, version: promotion.version }) : promotions.create(input)
    },
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.promotions() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`${saved.name} se guardó.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!problem) save.mutate()
  }
  const complexOptions = store.complexes.map(c => ({ value: c.id, label: c.name, group: c.cityName }))
  const roomTypeOptions = (store.reference?.roomTypes ?? []).map(t => ({ value: t.code, label: t.name }))
  const projectionOptions = (store.reference?.projections ?? []).map(p => ({ value: p.code, label: p.name }))

  return (
    <BaseDialog open={open} label={promotion ? `Editar ${promotion.name}` : 'Nueva promoción'} eyebrow="Promociones" size="large" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={save.isPending}>Guardar promoción</button>
      </>}>
      <form id={`${id}-form`} className="form-grid promotion-form" noValidate onSubmit={submit}>
        <div className="field full">
          <label htmlFor={`${id}-name`}>Nombre *</label>
          <input id={`${id}-name`} value={d.name} onChange={e => update({ name: e.target.value })} className="input" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-kind`}>Tipo</label>
          <select id={`${id}-kind`} value={d.kind} onChange={e => update({ kind: e.target.value })} className="select">
            {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {d.kind === 'percent' && (
          <div className="field">
            <label htmlFor={`${id}-percent`}>Porcentaje de descuento *</label>
            <input id={`${id}-percent`} value={numberValue(d.rules.percent ?? NaN)} onChange={e => updateRules({ percent: e.target.valueAsNumber })} className="input" type="number" min={1} max={100} />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-level`}>Nivel del Club</label>
          <select id={`${id}-level`} value={d.clubLevelId ?? ''} onChange={e => update({ clubLevelId: e.target.value || null })} className="select">
            <option value="">Para todo el público</option>
            {levels.data?.map(level => <option key={level.id} value={level.id}>Solo {level.name}</option>)}
          </select>
        </div>
        <div className="field full">
          <label htmlFor={`${id}-description`}>Descripción *</label>
          <textarea id={`${id}-description`} value={d.description} onChange={e => update({ description: e.target.value })} className="textarea" maxLength={500} />
        </div>
        <div className="field full">
          <label htmlFor={`${id}-restrictions`}>Restricciones *</label>
          <textarea id={`${id}-restrictions`} value={d.restrictions} onChange={e => update({ restrictions: e.target.value })} className="textarea" maxLength={1000} />
          <p className="field-hint">Se publican tal cual en el sitio web.</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-from`}>Desde *</label>
          <input id={`${id}-from`} value={d.validFrom} onChange={e => update({ validFrom: e.target.value })} className="input" type="date" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-to`}>Hasta</label>
          <input id={`${id}-to`} value={d.validTo ?? ''} onChange={e => update({ validTo: e.target.value })} className="input" type="date" min={d.validFrom} />
          <p className="field-hint">Vacío: sin vencimiento.</p>
        </div>
        <label className="check full"><input checked={d.appliesToAll} onChange={e => update({ appliesToAll: e.target.checked })} type="checkbox" /> Aplica en toda la cadena</label>
        {!d.appliesToAll && <MultiSelect value={d.complexIds} onChange={complexIds => update({ complexIds })} className="full" label="Complejos *" options={complexOptions} placeholder="Elige los complejos" />}

        <h3 className="form-section">Reglas para aplicarla en línea</h3>
        <p className="notice small full">Con estas reglas el servidor decide solo si la promoción aplica a una compra. Requieren columnas nuevas en <code>promocion</code>; mientras tanto se guardan las restricciones como texto.</p>
        <MultiSelect value={d.rules.weekdays} onChange={weekdays => updateRules({ weekdays })} label="Días" options={dayOptions} placeholder="Todos los días" />
        <MultiSelect value={d.rules.roomTypes} onChange={roomTypes => updateRules({ roomTypes })} label="Tipos de sala" options={roomTypeOptions} placeholder="Todos" />
        <MultiSelect value={d.rules.projections} onChange={projections => updateRules({ projections })} label="Proyección" options={projectionOptions} placeholder="Todas" />
        {touched && problem && <p className="notice danger full" role="alert">{problem}</p>}
      </form>
    </BaseDialog>
  )
}
