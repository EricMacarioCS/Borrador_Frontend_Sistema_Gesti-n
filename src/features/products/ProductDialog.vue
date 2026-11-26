<script setup lang="ts">
/** Producto de la cadena con sus reglas de personalización (`producto_dulceria`, `modificador_regla`, `modificador_opcion`). */
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Plus, Trash2 } from '@lucide/vue'
import { keys, useCategories } from '@/app/queries'
import { useServices } from '@/app/services'
import { MODIFIER_LABELS, STRUCTURE_LABELS } from '@/domain/labels'
import type { ModifierKind, Product, ProductInput, ProductStructure } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MoneyInput from '@/shared/ui/MoneyInput.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { clone } from '@/shared/lib/clone'

const props = defineProps<{ open: boolean; product: Product | null }>()
const emit = defineEmits<{ close: [] }>()
const { products } = useServices()
const categories = useCategories()
const queryClient = useQueryClient()
const id = useId()

type Draft = Omit<ProductInput, 'rules'> & { rules: (Omit<ProductInput['rules'][number], 'options'> & { options: (Omit<ProductInput['rules'][number]['options'][number], 'extraCents'> & { extraCents: number | null })[] })[] }
const draft = ref<Draft>(blank())
let original = ''
const touched = ref(false)
const tempId = () => `tmp-${crypto.randomUUID()}`

function blank(): Draft {
  return { apiId: null, name: '', description: '', imageUrl: null, categoryId: '', structure: 'simple', requiresTicketCode: true, rules: [] }
}

watch(() => props.open, open => {
  if (!open) return
  const product = props.product
  draft.value = product
    ? { apiId: product.apiId, name: product.name, description: product.description, imageUrl: product.imageUrl, categoryId: product.category.id,
        structure: product.structure, requiresTicketCode: product.requiresTicketCode, rules: clone(product.rules) }
    : { ...blank(), categoryId: categories.data.value?.[0]?.id ?? '' }
  original = JSON.stringify(draft.value)
  touched.value = false
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)

function addRule() {
  draft.value.rules.push({ id: tempId(), title: '', kind: 'choice', min: 1, max: 1, allowSplit: false, options: [{ id: tempId(), apiId: null, name: '', extraCents: 0, isDefault: true }] })
  if (draft.value.structure === 'simple') draft.value.structure = 'compound'
}
function addOption(ruleIndex: number) {
  draft.value.rules[ruleIndex]!.options.push({ id: tempId(), apiId: null, name: '', extraCents: 0, isDefault: false })
}

const problems = computed(() => {
  const list: string[] = []
  const d = draft.value
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
})

const save = useMutation({
  mutationFn: () => {
    const d = draft.value
    const input: ProductInput = {
      ...d, name: d.name.trim(), description: d.description.trim(), imageUrl: d.imageUrl?.trim() || null, apiId: d.apiId?.trim() || null,
      rules: d.rules.map(rule => ({ ...rule, title: rule.title.trim(), allowSplit: rule.allowSplit && rule.max > 1, options: rule.options.map(o => ({ ...o, name: o.name.trim(), extraCents: o.extraCents ?? 0 })) }))
    }
    return props.product ? products.update(props.product.id, { ...input, version: props.product.version }) : products.create(input)
  },
  onSuccess: product => {
    void queryClient.invalidateQueries({ queryKey: keys.products() })
    void queryClient.invalidateQueries({ queryKey: ['catalog'] })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(props.product ? `${product.name} se actualizó en toda la cadena.` : `${product.name} se creó. Agrégalo al catálogo de cada complejo.`)
    emit('close')
  },
  onError: toastError
})

function submit() {
  touched.value = true
  if (!problems.value.length) save.mutate()
}
const kinds = Object.entries(MODIFIER_LABELS) as [ModifierKind, string][]
const structures = Object.entries(STRUCTURE_LABELS) as [ProductStructure, string][]
</script>

<template>
  <BaseDialog :open="open" :label="product ? `Editar ${product.name}` : 'Nuevo producto'" eyebrow="Productos de la cadena" size="wide" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="submit">
      <p class="notice full small">Nombre, opciones y reglas son iguales en todos los complejos. Precio y disponibilidad se definen en el catálogo de cada complejo.</p>
      <section class="form-section">
        <h3 class="form-section-title">Datos del producto</h3>
        <div class="form-grid">
          <div class="field">
            <label :for="`${id}-name`">Nombre *</label>
            <input :id="`${id}-name`" v-model="draft.name" class="input" maxlength="120" />
          </div>
          <div class="field">
            <label :for="`${id}-category`">Categoría *</label>
            <select :id="`${id}-category`" v-model="draft.categoryId" class="select">
              <option v-for="c in categories.data.value" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="field">
            <label :for="`${id}-structure`">Estructura</label>
            <select :id="`${id}-structure`" v-model="draft.structure" class="select">
              <option v-for="[value, label] in structures" :key="value" :value="value">{{ label }}</option>
            </select>
            <p class="field-hint">Simple: sin opciones. Configurable: tamaño o sabor. Combo: paquete con elecciones.</p>
          </div>
          <div class="field">
            <label :for="`${id}-api`">ID en Vista</label>
            <input :id="`${id}-api`" v-model="draft.apiId" class="input" />
          </div>
          <div class="field full">
            <label :for="`${id}-description`">Descripción</label>
            <textarea :id="`${id}-description`" v-model="draft.description" class="textarea" maxlength="400" />
          </div>
          <div class="field full">
            <label :for="`${id}-image`">URL de la imagen</label>
            <input :id="`${id}-image`" v-model="draft.imageUrl" class="input" placeholder="https://…" />
          </div>
          <label class="check full"><input v-model="draft.requiresTicketCode" type="checkbox" /> Exige folio de boletos vigente al comprarlo en línea (alimentos y bebidas)</label>
        </div>
      </section>

      <section class="form-section">
        <h3 class="form-section-title">Reglas de personalización</h3>
        <div class="form-grid">
          <div v-for="(rule, r) in draft.rules" :key="rule.id" class="rule full">
            <div class="rule-head">
              <div class="field grow">
                <label :for="`${id}-rule-${r}`">Título que ve el cliente</label>
                <input :id="`${id}-rule-${r}`" v-model="rule.title" class="input" placeholder="Ej. Elige de 1 a 2 sabores" />
              </div>
              <div class="field">
                <label :for="`${id}-kind-${r}`">Tipo</label>
                <select :id="`${id}-kind-${r}`" v-model="rule.kind" class="select">
                  <option v-for="[value, label] in kinds" :key="value" :value="value">{{ label }}</option>
                </select>
              </div>
              <div class="field small-field">
                <label :for="`${id}-min-${r}`">Mínimo</label>
                <input :id="`${id}-min-${r}`" v-model.number="rule.min" class="input" type="number" min="0" max="20" />
              </div>
              <div class="field small-field">
                <label :for="`${id}-max-${r}`">Máximo</label>
                <input :id="`${id}-max-${r}`" v-model.number="rule.max" class="input" type="number" min="1" max="20" />
              </div>
              <button type="button" class="icon-btn danger" :aria-label="`Quitar la regla ${rule.title || r + 1}`" @click="draft.rules.splice(r, 1)"><Trash2 :size="16" /></button>
            </div>
            <label v-if="rule.max > 1" class="check small"><input v-model="rule.allowSplit" type="checkbox" /> Permite mitad y mitad (sin cargo extra por mezclar)</label>
            <div class="table-wrap">
              <table class="data options">
                <thead><tr><th>Opción</th><th>Precio adicional</th><th>Predeterminada</th><th>ID en Vista</th><th class="actions-col"><span class="visually-hidden">Quitar</span></th></tr></thead>
                <tbody>
                  <tr v-for="(option, o) in rule.options" :key="option.id">
                    <td><input v-model="option.name" class="input" :aria-label="`Nombre de la opción ${o + 1}`" /></td>
                    <td><MoneyInput v-model="option.extraCents" :label="`Precio adicional de ${option.name || 'la opción'}`" /></td>
                    <td><input v-model="option.isDefault" type="checkbox" :aria-label="`${option.name} es predeterminada`" /></td>
                    <td><input v-model="option.apiId" class="input" :aria-label="`ID en Vista de ${option.name}`" /></td>
                    <td class="actions-col"><button type="button" class="icon-btn danger" :disabled="rule.options.length === 1" :aria-label="`Quitar ${option.name || 'la opción'}`" @click="rule.options.splice(o, 1)"><Trash2 :size="15" /></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" class="btn btn-text btn-small" @click="addOption(r)"><Plus :size="15" /> Agregar opción</button>
          </div>
          <div class="full">
            <button type="button" class="btn btn-secondary" @click="addRule"><Plus :size="16" /> Agregar regla</button>
          </div>
        </div>
      </section>

      <ul v-if="touched && problems.length" class="notice danger full problems" role="alert">
        <li v-for="problem in problems" :key="problem">{{ problem }}</li>
      </ul>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="save.isPending.value">{{ save.isPending.value ? 'Guardando…' : 'Guardar producto' }}</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.rule { min-width: 0; padding: 14px; display: grid; gap: 10px; border: 1px solid var(--line-strong); border-radius: var(--radius-l); background: var(--surface); }
.rule-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.rule-head .grow { flex: 1 1 240px; }
.small-field { width: 90px; }
.table-wrap { border: 1px solid var(--line); border-radius: var(--radius-s); }
.options { min-width: 520px; background: var(--surface); }
.options td { padding: 6px 8px; }
.options td input[type='checkbox'] { width: 17px; height: 17px; accent-color: var(--blue); }
.problems { padding-left: 30px; }
</style>
