<script setup lang="ts">
/**
 * Ajuste excepcional de existencias. El inventario lo registra el personal del complejo; el ajuste solo corrige
 * y queda en el historial con motivo y autor. Requiere tablas nuevas en la base de datos.
 */
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { ADJUSTMENT_LABELS } from '@/domain/labels'
import { ADJUSTMENT_REASONS, type AdjustmentReason, type CatalogEntry } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ entry: CatalogEntry | null; complexId: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { products } = useServices()
const queryClient = useQueryClient()
const id = useId()
const quantity = ref(0)
const reason = ref<AdjustmentReason | ''>('')
const note = ref('')
const touched = ref(false)

watch(() => props.entry, entry => {
  quantity.value = entry?.stock ?? 0
  reason.value = ''
  note.value = ''
  touched.value = false
}, { immediate: true })

const problem = computed(() => {
  if (!Number.isInteger(quantity.value) || quantity.value < 0) return 'La cantidad debe ser un entero de 0 en adelante.'
  if (quantity.value === props.entry?.stock) return 'La cantidad es igual a la actual.'
  if (!reason.value) return 'Elige el motivo del ajuste.'
  if (reason.value === 'other' && !note.value.trim()) return 'Describe el motivo en las observaciones.'
  return null
})

const save = useMutation({
  mutationFn: () => products.adjustStock(props.complexId, props.entry!.product.id, {
    version: props.entry!.version, quantity: quantity.value, reason: reason.value as AdjustmentReason, note: note.value.trim()
  }),
  onSuccess: entry => {
    void queryClient.invalidateQueries({ queryKey: keys.catalog(props.complexId) })
    void queryClient.invalidateQueries({ queryKey: keys.movements(props.complexId) })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`Existencias de ${entry.product.name}: ${entry.stock}.`)
    emit('close')
  },
  onError: toastError
})

function submit() {
  touched.value = true
  if (!problem.value) save.mutate()
}
</script>

<template>
  <BaseDialog :open="!!entry" label="Ajuste excepcional de existencias" :eyebrow="store.complexName(complexId)" size="small"
    :dirty="!!entry && (quantity !== entry.stock || !!reason || !!note)" @close="emit('close')">
    <form v-if="entry" :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="submit">
      <p class="notice full small">El personal del complejo registra entradas, mermas y ventas. Usa este ajuste solo para correcciones: quedará en el historial con tu nombre.</p>
      <div class="field"><span>Producto</span><strong>{{ entry.product.name }}</strong></div>
      <div class="field"><span>Existencias actuales</span><strong>{{ entry.stock }}</strong></div>
      <div class="field">
        <label :for="`${id}-quantity`">Nueva cantidad *</label>
        <input :id="`${id}-quantity`" v-model.number="quantity" class="input" type="number" min="0" step="1" />
      </div>
      <div class="field">
        <label :for="`${id}-reason`">Motivo *</label>
        <select :id="`${id}-reason`" v-model="reason" class="select">
          <option value="" disabled>Elegir…</option>
          <option v-for="value in ADJUSTMENT_REASONS" :key="value" :value="value">{{ ADJUSTMENT_LABELS[value] }}</option>
        </select>
      </div>
      <div class="field full">
        <label :for="`${id}-note`">Observaciones{{ reason === 'other' ? ' *' : '' }}</label>
        <textarea :id="`${id}-note`" v-model="note" class="textarea" maxlength="300" />
      </div>
      <p v-if="touched && problem" class="notice danger full" role="alert">{{ problem }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="save.isPending.value">Registrar ajuste</button>
    </template>
  </BaseDialog>
</template>
