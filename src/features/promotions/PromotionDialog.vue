<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys, useClubLevels } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { PROMOTION_LABELS, WEEKDAYS } from '@/domain/labels'
import type { Promotion, PromotionInput, PromotionKind } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MultiSelect from '@/shared/ui/MultiSelect.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { clone } from '@/shared/lib/clone'
import { addDays } from '@/shared/lib/datetime'

const props = defineProps<{ open: boolean; promotion: Promotion | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { promotions } = useServices()
const levels = useClubLevels()
const queryClient = useQueryClient()
const id = useId()

const blank = (): PromotionInput => ({
  name: '', kind: '2x1', description: '', restrictions: 'No es acumulable.', validFrom: store.today(), validTo: addDays(store.today(), 30),
  appliesToAll: true, complexIds: [], clubLevelId: null, rules: { weekdays: [], roomTypes: [], projections: [], percent: null }
})
const draft = ref<PromotionInput>(blank())
let original = ''
const touched = ref(false)

watch(() => props.open, open => {
  if (!open) return
  const { id: _i, version: _v, ...rest } = props.promotion ?? { id: '', version: 0, ...blank() }
  draft.value = clone(rest)
  original = JSON.stringify(draft.value)
  touched.value = false
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)
const problem = computed(() => {
  const d = draft.value
  if (!d.name.trim() || !d.description.trim() || !d.restrictions.trim()) return 'Completa nombre, descripción y restricciones.'
  if (d.validTo && d.validTo < d.validFrom) return 'La vigencia termina antes de empezar.'
  if (!d.appliesToAll && !d.complexIds.length) return 'Elige los complejos o márcala para toda la cadena.'
  if (d.kind === 'percent' && !(Number(d.rules.percent) > 0 && Number(d.rules.percent) <= 100)) return 'El porcentaje va de 1 a 100.'
  return null
})

const save = useMutation({
  mutationFn: () => {
    const d = draft.value
    const input: PromotionInput = { ...d, name: d.name.trim(), complexIds: d.appliesToAll ? [] : d.complexIds, validTo: d.validTo || null,
      rules: { ...d.rules, percent: d.kind === 'percent' ? Number(d.rules.percent) : null } }
    return props.promotion ? promotions.update(props.promotion.id, { ...input, version: props.promotion.version }) : promotions.create(input)
  },
  onSuccess: promotion => {
    void queryClient.invalidateQueries({ queryKey: keys.promotions() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`${promotion.name} se guardó.`)
    emit('close')
  },
  onError: toastError
})

function submit() {
  touched.value = true
  if (!problem.value) save.mutate()
}
const kinds = Object.entries(PROMOTION_LABELS) as [PromotionKind, string][]
const dayOptions = WEEKDAYS.map((label, value) => ({ value, label }))
const complexOptions = computed(() => store.complexes.map(c => ({ value: c.id, label: c.name, group: c.cityName })))
const roomTypeOptions = computed(() => (store.reference?.roomTypes ?? []).map(t => ({ value: t.code, label: t.name })))
const projectionOptions = computed(() => (store.reference?.projections ?? []).map(p => ({ value: p.code, label: p.name })))
</script>

<template>
  <BaseDialog :open="open" :label="promotion ? `Editar ${promotion.name}` : 'Nueva promoción'" eyebrow="Promociones" size="large" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="submit">
      <section class="form-section">
        <h3 class="form-section-title">Datos de la promoción</h3>
        <div class="form-grid">
          <div class="field full">
            <label :for="`${id}-name`">Nombre *</label>
            <input :id="`${id}-name`" v-model="draft.name" class="input" maxlength="120" />
          </div>
          <div class="field">
            <label :for="`${id}-kind`">Tipo</label>
            <select :id="`${id}-kind`" v-model="draft.kind" class="select">
              <option v-for="[value, label] in kinds" :key="value" :value="value">{{ label }}</option>
            </select>
          </div>
          <div v-if="draft.kind === 'percent'" class="field">
            <label :for="`${id}-percent`">Porcentaje de descuento *</label>
            <input :id="`${id}-percent`" v-model.number="draft.rules.percent" class="input" type="number" min="1" max="100" />
          </div>
          <div class="field">
            <label :for="`${id}-level`">Nivel del Club</label>
            <select :id="`${id}-level`" v-model="draft.clubLevelId" class="select">
              <option :value="null">Para todo el público</option>
              <option v-for="level in levels.data.value" :key="level.id" :value="level.id">Solo {{ level.name }}</option>
            </select>
          </div>
          <div class="field full">
            <label :for="`${id}-description`">Descripción *</label>
            <textarea :id="`${id}-description`" v-model="draft.description" class="textarea" maxlength="500" />
          </div>
          <div class="field full">
            <label :for="`${id}-restrictions`">Restricciones *</label>
            <textarea :id="`${id}-restrictions`" v-model="draft.restrictions" class="textarea" maxlength="1000" />
            <p class="field-hint">Se publican tal cual en el sitio web.</p>
          </div>
          <div class="field">
            <label :for="`${id}-from`">Desde *</label>
            <input :id="`${id}-from`" v-model="draft.validFrom" class="input" type="date" />
          </div>
          <div class="field">
            <label :for="`${id}-to`">Hasta</label>
            <input :id="`${id}-to`" v-model="draft.validTo" class="input" type="date" :min="draft.validFrom" />
            <p class="field-hint">Vacío: sin vencimiento.</p>
          </div>
          <label class="check full"><input v-model="draft.appliesToAll" type="checkbox" /> Aplica en toda la cadena</label>
          <MultiSelect v-if="!draft.appliesToAll" v-model="draft.complexIds" class="full" label="Complejos *" :options="complexOptions" placeholder="Elige los complejos" />
        </div>
      </section>

      <section class="form-section">
        <h3 class="form-section-title">Reglas para aplicarla en línea</h3>
        <div class="form-grid">
          <p class="notice small full">Con estas reglas el servidor decide solo si la promoción aplica a una compra. Requieren columnas nuevas en <code>promocion</code>; mientras tanto se guardan las restricciones como texto.</p>
          <MultiSelect v-model="draft.rules.weekdays" label="Días" :options="dayOptions" placeholder="Todos los días" />
          <MultiSelect v-model="draft.rules.roomTypes" label="Tipos de sala" :options="roomTypeOptions" placeholder="Todos" />
          <MultiSelect v-model="draft.rules.projections" label="Proyección" :options="projectionOptions" placeholder="Todas" />
        </div>
      </section>

      <p v-if="touched && problem" class="notice danger full" role="alert">{{ problem }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="save.isPending.value">Guardar promoción</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
code { font-size: var(--text-xs); }
</style>
