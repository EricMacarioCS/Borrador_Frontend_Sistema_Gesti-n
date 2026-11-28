import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import type { TicketType } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import MoneyInput from '@/shared/ui/MoneyInput'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'

export default function TicketTypeDialog({ open, type, onClose }: { open: boolean; type: TicketType | null; onClose: () => void }) {
  const { prices } = useServices()
  const queryClient = useQueryClient()
  const id = useId()
  const { draft, update, dirty } = useDraft(open, () => ({
    name: type?.name ?? '', description: type?.description ?? '', isPromotional: type?.isPromotional ?? false,
    fixed: type?.fixedPriceCents != null, fixedPriceCents: type?.fixedPriceCents ?? null
  }))
  const valid = Boolean(draft.name.trim()) && (!draft.fixed || (draft.fixedPriceCents ?? 0) > 0)

  const save = useMutation({
    mutationFn: () => prices.saveTicketType({
      id: type?.id ?? null, version: type?.version ?? 0, name: draft.name.trim(), description: draft.description.trim(),
      isPromotional: draft.isPromotional, fixedPriceCents: draft.fixed ? draft.fixedPriceCents : null
    }),
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.ticketTypes() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`Tipo de boleto ${saved.name} guardado.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) save.mutate()
  }

  return (
    <BaseDialog open={open} label={type ? `Editar ${type.name}` : 'Nuevo tipo de boleto'} eyebrow="Tarifas" size="small" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={!valid || save.isPending}>Guardar</button>
      </>}>
      <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
        <div className="field full">
          <label htmlFor={`${id}-name`}>Nombre *</label>
          <input id={`${id}-name`} value={draft.name} onChange={e => update({ name: e.target.value })} className="input" maxLength={60} />
        </div>
        <div className="field full">
          <label htmlFor={`${id}-description`}>Descripción</label>
          <input id={`${id}-description`} value={draft.description} onChange={e => update({ description: e.target.value })} className="input" maxLength={200} placeholder="Ej. De 3 a 11 años" />
        </div>
        <label className="check full"><input checked={draft.isPromotional} onChange={e => update({ isPromotional: e.target.checked })} type="checkbox" /> Es promocional</label>
        <label className="check full"><input checked={draft.fixed} onChange={e => update({ fixed: e.target.checked })} type="checkbox" /> Precio fijo en todos los complejos (no usa la tarifa)</label>
        {draft.fixed && (
          <div className="field full">
            <label htmlFor={`${id}-fixed`}>Precio fijo *</label>
            <MoneyInput id={`${id}-fixed`} value={draft.fixedPriceCents} onChange={fixedPriceCents => update({ fixedPriceCents })} />
          </div>
        )}
      </form>
    </BaseDialog>
  )
}
