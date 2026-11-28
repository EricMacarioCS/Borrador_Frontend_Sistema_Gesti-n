/** Precio, disponibilidad y opciones de un producto en un complejo (`detalle_catalogo`, `disponibilidad_modificador`). */
import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { CatalogEntry, Product } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import MoneyInput from '@/shared/ui/MoneyInput'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import { formatMoney } from '@/shared/lib/money'
import './CatalogEntryDialog.css'

interface Props { open: boolean; complexId: string; entry: CatalogEntry | null; candidates: Product[]; onClose: () => void }
interface OptionSetting { optionId: string; active: boolean; extraCents: number | null }
interface Draft { productId: string; price: number | null; available: boolean; settings: OptionSetting[] }

export default function CatalogEntryDialog({ open, complexId, entry, candidates, onClose }: Props) {
  const store = useSession()
  const { products } = useServices()
  const queryClient = useQueryClient()
  const id = useId()

  const productFor = (productId: string) => entry?.product ?? candidates.find(p => p.id === productId) ?? null
  const load = (productId: string): Draft => ({
    productId,
    price: entry?.priceCents ?? null,
    available: entry?.available ?? true,
    settings: (productFor(productId)?.rules.flatMap(rule => rule.options) ?? []).map(option => {
      const current = entry?.optionSettings.find(s => s.optionId === option.id)
      return { optionId: option.id, active: current?.active ?? true, extraCents: current?.extraCents ?? option.extraCents }
    })
  })
  const { draft, setDraft, dirty } = useDraft<Draft>(open, () => load(entry?.product.id ?? candidates[0]?.id ?? ''))

  const product = productFor(draft.productId)
  const setting = (optionId: string) => draft.settings.find(s => s.optionId === optionId)
  const updateSetting = (optionId: string, patch: Partial<OptionSetting>) =>
    setDraft(current => ({ ...current, settings: current.settings.map(s => (s.optionId === optionId ? { ...s, ...patch } : s)) }))
  const ruleProblem = product?.rules.find(rule =>
    rule.options.filter(option => setting(option.id)?.active).length < Math.max(rule.min, 1))?.title ?? null
  const valid = Boolean(product) && draft.price !== null && draft.price > 0 && draft.settings.every(s => s.extraCents !== null) && !ruleProblem

  const save = useMutation({
    mutationFn: () => products.saveCatalogEntry(complexId, product!.id, {
      version: entry?.version ?? null, priceCents: draft.price!, available: draft.available,
      optionSettings: draft.settings.map(s => ({ optionId: s.optionId, active: s.active, extraCents: s.extraCents ?? 0 }))
    }),
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.catalog(complexId) })
      void queryClient.invalidateQueries({ queryKey: keys.priceHistory(complexId) })
      void queryClient.invalidateQueries({ queryKey: keys.products() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(entry ? `${saved.product.name} se actualizó en ${store.complexName(complexId)}.` : `${saved.product.name} se agregó al catálogo.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) save.mutate()
  }

  return (
    <BaseDialog open={open} label={entry ? `${entry.product.name} en este complejo` : 'Agregar al catálogo'} eyebrow={store.complexName(complexId)} size="large" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={!valid || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <form id={`${id}-form`} className="form-grid catalog-form" noValidate onSubmit={submit}>
        {!entry && (
          <div className="field full">
            <label htmlFor={`${id}-product`}>Producto de la cadena</label>
            <select id={`${id}-product`} value={draft.productId} onChange={e => setDraft(load(e.target.value))} className="select">
              {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.category.name}</option>)}
            </select>
            {!candidates.length && <p className="field-hint">Todos los productos de la cadena ya están en este catálogo.</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-price`}>Precio en este complejo *</label>
          <MoneyInput id={`${id}-price`} value={draft.price} onChange={price => setDraft(current => ({ ...current, price }))} label="Precio en este complejo" invalid={draft.price !== null && draft.price <= 0} />
          {entry && <p className="field-hint">Actual: {formatMoney(entry.priceCents)}. Cada cambio queda en el historial de precios.</p>}
        </div>
        <label className="check"><input checked={draft.available} onChange={e => setDraft(current => ({ ...current, available: e.target.checked }))} type="checkbox" /> Disponible para la venta</label>

        {!!product?.rules.length && (
          <>
            <h3 className="form-section">Opciones en este complejo</h3>
            {product.rules.map(rule => (
              <section key={rule.id} className="full rule" aria-label={rule.title}>
                <h4>{rule.title} <small>{!rule.min ? `opcional, hasta ${rule.max}` : rule.min === rule.max ? `obligatorio, elige ${rule.min}` : `obligatorio, elige de ${rule.min} a ${rule.max}`}</small></h4>
                <table className="data">
                  <thead><tr><th>Se vende</th><th>Opción</th><th>Precio adicional aquí</th></tr></thead>
                  <tbody>
                    {rule.options.map(option => {
                      const current = setting(option.id)
                      return (
                        <tr key={option.id} className={current?.active ? undefined : 'row-off'}>
                          <td><input checked={current?.active ?? false} onChange={e => updateSetting(option.id, { active: e.target.checked })} type="checkbox" aria-label={`${option.name} se vende`} /></td>
                          <td>{option.name}{option.isDefault && <small className="muted"> · predeterminada</small>}</td>
                          <td><MoneyInput value={current?.extraCents ?? null} onChange={extraCents => updateSetting(option.id, { extraCents })} label={`Precio adicional de ${option.name}`} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ))}
            {ruleProblem && <p className="notice danger full" role="alert">{ruleProblem}: deja suficientes opciones activas para que el cliente pueda elegir.</p>}
          </>
        )}
      </form>
    </BaseDialog>
  )
}
