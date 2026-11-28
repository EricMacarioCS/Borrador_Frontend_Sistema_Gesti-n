import { useId, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Complex } from '@/domain/models'
import { slugify } from '@/domain/rules'
import BaseDialog from '@/shared/ui/BaseDialog'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'

export default function ComplexDialog({ complex, onClose }: { complex: Complex | null; onClose: () => void }) {
  const store = useSession()
  const { complexes } = useServices()
  const id = useId()
  const { draft, update, dirty } = useDraft<Complex | null>(!!complex, () => (complex ? { ...complex } : null))
  const d = draft

  const problem = !d ? null
    : !d.name.trim() || !d.address.trim() ? 'Completa el nombre y la dirección.'
      : !/^\d{5}$/.test(d.postalCode) ? 'El código postal tiene 5 dígitos.'
        : !slugify(d.slug) ? 'Escribe la URL amigable.' : null

  const save = useMutation({
    mutationFn: () => complexes.update({ ...d!, slug: slugify(d!.slug), imageUrl: d!.imageUrl?.trim() || null, vistaId: d!.vistaId?.trim() || null }),
    onSuccess: async saved => {
      // Los complejos son datos de referencia: se recargan para todo el sistema.
      await store.loadReference()
      toast(`${saved.name} se actualizó.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!problem) save.mutate()
  }
  const set = (patch: Partial<Complex>) => update(patch)

  return (
    <BaseDialog open={!!complex} label={complex ? `Datos de ${complex.name}` : 'Complejo'} eyebrow="Complejos" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={!!problem || !dirty || save.isPending}>Guardar</button>
      </>}>
      {d && (
        <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
          <div className="field full">
            <label htmlFor={`${id}-name`}>Nombre comercial</label>
            <input id={`${id}-name`} value={d.name} onChange={e => set({ name: e.target.value })} className="input" maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-kind`}>Tipo de complejo</label>
            <select id={`${id}-kind`} value={d.kind} onChange={e => set({ kind: e.target.value as Complex['kind'] })} className="select">
              <option value="traditional">Tradicional</option>
              <option value="vip">VIP</option>
            </select>
            <p className="field-hint">La versión VIP de una plaza es un complejo distinto.</p>
          </div>
          <div className="field">
            <label htmlFor={`${id}-city`}>Ciudad</label>
            <select id={`${id}-city`} value={d.cityId} onChange={e => set({ cityId: e.target.value })} className="select">
              {store.reference?.cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </div>
          <div className="field full">
            <label htmlFor={`${id}-address`}>Dirección</label>
            <input id={`${id}-address`} value={d.address} onChange={e => set({ address: e.target.value })} className="input" maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-cp`}>Código postal</label>
            <input id={`${id}-cp`} value={d.postalCode} onChange={e => set({ postalCode: e.target.value })} className="input" inputMode="numeric" maxLength={5} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-opened`}>Fecha de apertura</label>
            <input id={`${id}-opened`} value={d.openedOn} onChange={e => set({ openedOn: e.target.value })} className="input" type="date" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-slug`}>URL amigable</label>
            <input id={`${id}-slug`} value={d.slug} onChange={e => set({ slug: e.target.value })} className="input" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-vista`}>ID en Vista</label>
            <input id={`${id}-vista`} value={d.vistaId ?? ''} onChange={e => set({ vistaId: e.target.value })} className="input" />
          </div>
          <div className="field full">
            <label htmlFor={`${id}-image`}>URL de la imagen</label>
            <input id={`${id}-image`} value={d.imageUrl ?? ''} onChange={e => set({ imageUrl: e.target.value })} className="input" placeholder="https://…" />
          </div>
          {problem && <p className="field-error full">{problem}</p>}
        </form>
      )}
    </BaseDialog>
  )
}
