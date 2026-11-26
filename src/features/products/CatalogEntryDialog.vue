<script setup lang="ts">
/** Precio, disponibilidad y opciones de un producto en un complejo (`detalle_catalogo`, `disponibilidad_modificador`). */
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { CatalogEntry, Product } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MoneyInput from '@/shared/ui/MoneyInput.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { formatMoney } from '@/shared/lib/money'

const props = defineProps<{ open: boolean; complexId: string; entry: CatalogEntry | null; candidates: Product[] }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { products } = useServices()
const queryClient = useQueryClient()
const id = useId()

const productId = ref('')
const price = ref<number | null>(null)
const available = ref(true)
const settings = ref<{ optionId: string; active: boolean; extraCents: number | null }[]>([])
let original = ''

const product = computed(() => props.entry?.product ?? props.candidates.find(p => p.id === productId.value) ?? null)

function load() {
  const entry = props.entry
  const target = product.value
  price.value = entry?.priceCents ?? null
  available.value = entry?.available ?? true
  settings.value = (target?.rules.flatMap(rule => rule.options) ?? []).map(option => {
    const current = entry?.optionSettings.find(s => s.optionId === option.id)
    return { optionId: option.id, active: current?.active ?? true, extraCents: current?.extraCents ?? option.extraCents }
  })
}

watch(() => props.open, open => {
  if (!open) return
  productId.value = props.entry?.product.id ?? props.candidates[0]?.id ?? ''
  load()
  original = JSON.stringify([productId.value, price.value, available.value, settings.value])
}, { immediate: true })
watch(productId, () => { if (!props.entry) load() })

const dirty = computed(() => JSON.stringify([productId.value, price.value, available.value, settings.value]) !== original)
const setting = (optionId: string) => settings.value.find(s => s.optionId === optionId)!
const ruleProblem = computed(() => product.value?.rules.find(rule =>
  rule.options.filter(option => setting(option.id)?.active).length < Math.max(rule.min, 1))?.title ?? null)
const valid = computed(() => Boolean(product.value) && price.value !== null && price.value > 0 && settings.value.every(s => s.extraCents !== null) && !ruleProblem.value)

const save = useMutation({
  mutationFn: () => products.saveCatalogEntry(props.complexId, product.value!.id, {
    version: props.entry?.version ?? null, priceCents: price.value!, available: available.value,
    optionSettings: settings.value.map(s => ({ optionId: s.optionId, active: s.active, extraCents: s.extraCents ?? 0 }))
  }),
  onSuccess: entry => {
    void queryClient.invalidateQueries({ queryKey: keys.catalog(props.complexId) })
    void queryClient.invalidateQueries({ queryKey: keys.priceHistory(props.complexId) })
    void queryClient.invalidateQueries({ queryKey: keys.products() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(props.entry ? `${entry.product.name} se actualizó en ${store.complexName(props.complexId)}.` : `${entry.product.name} se agregó al catálogo.`)
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="open" :label="entry ? `${entry.product.name} en este complejo` : 'Agregar al catálogo'" :eyebrow="store.complexName(complexId)" size="large" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="valid && save.mutate()">
      <div v-if="!entry" class="field full">
        <label :for="`${id}-product`">Producto de la cadena</label>
        <select :id="`${id}-product`" v-model="productId" class="select">
          <option v-for="candidate in candidates" :key="candidate.id" :value="candidate.id">{{ candidate.name }} · {{ candidate.category.name }}</option>
        </select>
        <p v-if="!candidates.length" class="field-hint">Todos los productos de la cadena ya están en este catálogo.</p>
      </div>
      <div class="field">
        <label :for="`${id}-price`">Precio en este complejo *</label>
        <MoneyInput :id="`${id}-price`" v-model="price" label="Precio en este complejo" :invalid="price !== null && price <= 0" />
        <p v-if="entry" class="field-hint">Actual: {{ formatMoney(entry.priceCents) }}. Cada cambio queda en el historial de precios.</p>
      </div>
      <label class="check"><input v-model="available" type="checkbox" /> Disponible para la venta</label>

      <template v-if="product?.rules.length">
        <div class="form-section">
          <h3 class="form-section-title">Opciones en este complejo</h3>
        <section v-for="rule in product.rules" :key="rule.id" class="full rule" :aria-label="rule.title">
          <h4>{{ rule.title }} <small>{{ !rule.min ? `opcional, hasta ${rule.max}` : rule.min === rule.max ? `obligatorio, elige ${rule.min}` : `obligatorio, elige de ${rule.min} a ${rule.max}` }}</small></h4>
          <table class="data">
            <thead><tr><th>Se vende</th><th>Opción</th><th>Precio adicional aquí</th></tr></thead>
            <tbody>
              <tr v-for="option in rule.options" :key="option.id" :class="{ 'row-off': !setting(option.id).active }">
                <td><input v-model="setting(option.id).active" type="checkbox" :aria-label="`${option.name} se vende`" /></td>
                <td>{{ option.name }}<small v-if="option.isDefault" class="muted"> · predeterminada</small> <span v-if="!setting(option.id).active" class="pill muted">No se vende</span></td>
                <td><MoneyInput v-model="setting(option.id).extraCents" :label="`Precio adicional de ${option.name}`" /></td>
              </tr>
            </tbody>
          </table>
        </section>
        </div>
        <p v-if="ruleProblem" class="notice danger full" role="alert">{{ ruleProblem }}: deja suficientes opciones activas para que el cliente pueda elegir.</p>
      </template>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="!valid || save.isPending.value">{{ save.isPending.value ? 'Guardando…' : 'Guardar' }}</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.rule { min-width: 0; margin-top: 10px; border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--surface); overflow-x: auto; }
.rule h4 { padding: 10px 14px; font: 700 var(--text-m) var(--font-title); }
.rule h4 small { color: var(--muted); font: 400 var(--text-xs) var(--font-body); }
.rule td { padding: 6px 14px; }
.rule input[type='checkbox'] { width: 17px; height: 17px; accent-color: var(--blue); }
</style>
