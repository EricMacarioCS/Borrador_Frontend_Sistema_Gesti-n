/** Producto de la cadena con sus reglas de personalización (`producto_dulceria`, `modificador_regla`, `modificador_opcion`). */
import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { keys, useCategories } from '@/app/queries'
import { useServices } from '@/app/services'
import { MODIFIER_LABELS, STRUCTURE_LABELS } from '@/domain/labels'
import type { ModifierKind, Product, ProductInput, ProductStructure } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import MoneyInput from '@/shared/ui/MoneyInput'
import { numberValue, useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import { clone } from '@/shared/lib/clone'
import './ProductDialog.css'

type RuleInput = ProductInput['rules'][number]
type OptionDraft = Omit<RuleInput['options'][number], 'extraCents'> & { extraCents: number | null }
type RuleDraft = Omit<RuleInput, 'options'> & { options: OptionDraft[] }
type Draft = Omit<ProductInput, 'rules'> & { rules: RuleDraft[] }

const tempId = () => `tmp-${crypto.randomUUID()}`
const blank = (): Draft => ({ apiId: null, name: '', description: '', imageUrl: null, categoryId: '', structure: 'simple', requiresTicketCode: true, rules: [] })
const kinds = Object.entries(MODIFIER_LABELS) as [ModifierKind, string][]
const structures = Object.entries(STRUCTURE_LABELS) as [ProductStructure, string][]

function problemsOf(d: Draft): string[] {
  const list: string[] = []
  if (!d.name.trim()) list.push('Escribe el nombre del producto.')
  if (!d.categoryId) list.push('Elige la categoría.')
  if (d.structure === 'simple' && d.rules.length) list.push('Un producto simple no tiene opciones: cámbialo a configurable o combo.')
  if (d.structure !== 'simple' && !d.rules.length) list.push('Agrega al menos una regla de personalización.')
  d.rules.forEach((rule, i) => {
    const name = rule.title.trim() || `Regla ${i + 1}`
    if (!rule.title.trim()) list.push(`${name}: escribe el título que verá el cliente.`)
    if (!(rule.min >= 0 && rule.max >= 1 && rule.min <= rule.max)) list.push(`${name}: el mínimo debe ser menor o igual al máximo.`)
    if (rule.options.some(o => !o.name.trim())) list.push(`${name}: hay opciones sin nombre.`)
    if (rule.options.some(o => o.extraCents === null)) list.push(`${name}: revisa los precios adicionales.`)
    if (rule.min > rule.options.length) list.push(`${name}: pide más opciones de las que existen.`)
  })
  return list
}

export default function ProductDialog({ open, product, onClose }: { open: boolean; product: Product | null; onClose: () => void }) {
  const { products } = useServices()
  const categories = useCategories()
  const queryClient = useQueryClient()
  const id = useId()
  const { draft, setDraft, update, dirty, touched, setTouched } = useDraft<Draft>(open, () => product
    ? { apiId: product.apiId, name: product.name, description: product.description, imageUrl: product.imageUrl, categoryId: product.category.id,
        structure: product.structure, requiresTicketCode: product.requiresTicketCode, rules: clone(product.rules) }
    : { ...blank(), categoryId: categories.data?.[0]?.id ?? '' })

  const setRules = (change: (rules: RuleDraft[]) => RuleDraft[]) => setDraft(current => ({ ...current, rules: change(current.rules) }))
  const updateRule = (r: number, patch: Partial<RuleDraft>) => setRules(rules => rules.map((rule, i) => (i === r ? { ...rule, ...patch } : rule)))
  const updateOption = (r: number, o: number, patch: Partial<OptionDraft>) =>
    setRules(rules => rules.map((rule, i) => (i === r ? { ...rule, options: rule.options.map((option, j) => (j === o ? { ...option, ...patch } : option)) } : rule)))

  function addRule() {
    setDraft(current => ({
      ...current,
      structure: current.structure === 'simple' ? 'compound' : current.structure,
      rules: [...current.rules, { id: tempId(), title: '', kind: 'choice', min: 1, max: 1, allowSplit: false, options: [{ id: tempId(), apiId: null, name: '', extraCents: 0, isDefault: true }] }]
    }))
  }
  function addOption(r: number) {
    setRules(rules => rules.map((rule, i) => (i === r ? { ...rule, options: [...rule.options, { id: tempId(), apiId: null, name: '', extraCents: 0, isDefault: false }] } : rule)))
  }

  const problems = problemsOf(draft)

  const save = useMutation({
    mutationFn: () => {
      const d = draft
      const input: ProductInput = {
        ...d, name: d.name.trim(), description: d.description.trim(), imageUrl: d.imageUrl?.trim() || null, apiId: d.apiId?.trim() || null,
        rules: d.rules.map(rule => ({ ...rule, title: rule.title.trim(), allowSplit: rule.allowSplit && rule.max > 1, options: rule.options.map(o => ({ ...o, name: o.name.trim(), extraCents: o.extraCents ?? 0 })) }))
      }
      return product ? products.update(product.id, { ...input, version: product.version }) : products.create(input)
    },
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.products() })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(product ? `${saved.name} se actualizó en toda la cadena.` : `${saved.name} se creó. Agrégalo al catálogo de cada complejo.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!problems.length) save.mutate()
  }

  return (
    <BaseDialog open={open} label={product ? `Editar ${product.name}` : 'Nuevo producto'} eyebrow="Productos de la cadena" size="wide" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar producto'}</button>
      </>}>
      <form id={`${id}-form`} className="form-grid product-form" noValidate onSubmit={submit}>
        <p className="notice full small">Nombre, opciones y reglas son iguales en todos los complejos. Precio y disponibilidad se definen en el catálogo de cada complejo.</p>
        <div className="field">
          <label htmlFor={`${id}-name`}>Nombre *</label>
          <input id={`${id}-name`} value={draft.name} onChange={e => update({ name: e.target.value })} className="input" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-category`}>Categoría *</label>
          <select id={`${id}-category`} value={draft.categoryId} onChange={e => update({ categoryId: e.target.value })} className="select">
            {categories.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-structure`}>Estructura</label>
          <select id={`${id}-structure`} value={draft.structure} onChange={e => update({ structure: e.target.value as ProductStructure })} className="select">
            {structures.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="field-hint">Simple: sin opciones. Configurable: tamaño o sabor. Combo: paquete con elecciones.</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-api`}>ID en Vista</label>
          <input id={`${id}-api`} value={draft.apiId ?? ''} onChange={e => update({ apiId: e.target.value })} className="input" />
        </div>
        <div className="field full">
          <label htmlFor={`${id}-description`}>Descripción</label>
          <textarea id={`${id}-description`} value={draft.description} onChange={e => update({ description: e.target.value })} className="textarea" maxLength={400} />
        </div>
        <div className="field full">
          <label htmlFor={`${id}-image`}>URL de la imagen</label>
          <input id={`${id}-image`} value={draft.imageUrl ?? ''} onChange={e => update({ imageUrl: e.target.value })} className="input" placeholder="https://…" />
        </div>
        <label className="check full"><input checked={draft.requiresTicketCode} onChange={e => update({ requiresTicketCode: e.target.checked })} type="checkbox" /> Exige folio de boletos vigente al comprarlo en línea (alimentos y bebidas)</label>

        <h3 className="form-section">Reglas de personalización</h3>
        {draft.rules.map((rule, r) => (
          <div key={rule.id} className="rule full">
            <div className="rule-head">
              <div className="field grow">
                <label htmlFor={`${id}-rule-${r}`}>Título que ve el cliente</label>
                <input id={`${id}-rule-${r}`} value={rule.title} onChange={e => updateRule(r, { title: e.target.value })} className="input" placeholder="Ej. Elige de 1 a 2 sabores" />
              </div>
              <div className="field">
                <label htmlFor={`${id}-kind-${r}`}>Tipo</label>
                <select id={`${id}-kind-${r}`} value={rule.kind} onChange={e => updateRule(r, { kind: e.target.value as ModifierKind })} className="select">
                  {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field small-field">
                <label htmlFor={`${id}-min-${r}`}>Mínimo</label>
                <input id={`${id}-min-${r}`} value={numberValue(rule.min)} onChange={e => updateRule(r, { min: e.target.valueAsNumber })} className="input" type="number" min={0} max={20} />
              </div>
              <div className="field small-field">
                <label htmlFor={`${id}-max-${r}`}>Máximo</label>
                <input id={`${id}-max-${r}`} value={numberValue(rule.max)} onChange={e => updateRule(r, { max: e.target.valueAsNumber })} className="input" type="number" min={1} max={20} />
              </div>
              <button type="button" className="icon-btn danger" aria-label={`Quitar la regla ${rule.title || r + 1}`} onClick={() => setRules(rules => rules.filter((_, i) => i !== r))}><Trash2 size={16} /></button>
            </div>
            {rule.max > 1 && <label className="check small"><input checked={rule.allowSplit} onChange={e => updateRule(r, { allowSplit: e.target.checked })} type="checkbox" /> Permite mitad y mitad (sin cargo extra por mezclar)</label>}
            <table className="data options">
              <thead><tr><th>Opción</th><th>Precio adicional</th><th>Predeterminada</th><th>ID en Vista</th><th className="actions-col"><span className="visually-hidden">Quitar</span></th></tr></thead>
              <tbody>
                {rule.options.map((option, o) => (
                  <tr key={option.id}>
                    <td><input value={option.name} onChange={e => updateOption(r, o, { name: e.target.value })} className="input" aria-label={`Nombre de la opción ${o + 1}`} /></td>
                    <td><MoneyInput value={option.extraCents} onChange={extraCents => updateOption(r, o, { extraCents })} label={`Precio adicional de ${option.name || 'la opción'}`} /></td>
                    <td><input checked={option.isDefault} onChange={e => updateOption(r, o, { isDefault: e.target.checked })} type="checkbox" aria-label={`${option.name} es predeterminada`} /></td>
                    <td><input value={option.apiId ?? ''} onChange={e => updateOption(r, o, { apiId: e.target.value })} className="input" aria-label={`ID en Vista de ${option.name}`} /></td>
                    <td className="actions-col">
                      <button type="button" className="icon-btn danger" disabled={rule.options.length === 1} aria-label={`Quitar ${option.name || 'la opción'}`}
                        onClick={() => updateRule(r, { options: rule.options.filter((_, j) => j !== o) })}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => addOption(r)}><Plus size={15} /> Agregar opción</button>
          </div>
        ))}
        <div className="full">
          <button type="button" className="btn btn-secondary" onClick={addRule}><Plus size={16} /> Agregar regla</button>
        </div>
        {touched && problems.length > 0 && (
          <ul className="notice danger full problems" role="alert">
            {problems.map(problem => <li key={problem}>{problem}</li>)}
          </ul>
        )}
      </form>
    </BaseDialog>
  )
}
