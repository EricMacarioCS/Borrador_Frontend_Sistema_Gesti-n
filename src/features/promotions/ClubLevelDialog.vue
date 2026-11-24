<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import type { ClubLevel } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ level: ClubLevel | null }>()
const emit = defineEmits<{ close: [] }>()
const { promotions } = useServices()
const queryClient = useQueryClient()
const id = useId()
const draft = ref<ClubLevel | null>(null)
const unlimited = ref(false)
let original = ''

watch(() => props.level, level => {
  draft.value = level ? { ...level } : null
  unlimited.value = level?.maxVisits === null
  original = JSON.stringify([draft.value, unlimited.value])
}, { immediate: true })

const dirty = computed(() => JSON.stringify([draft.value, unlimited.value]) !== original)
const problem = computed(() => {
  const d = draft.value
  if (!d) return null
  if (!d.name.trim()) return 'Escribe el nombre del nivel.'
  if (!Number.isInteger(d.minVisits) || d.minVisits < 0) return 'Las visitas mínimas son un entero de 0 en adelante.'
  if (!unlimited.value && (!Number.isInteger(d.maxVisits) || (d.maxVisits ?? 0) < d.minVisits)) return 'Las visitas máximas no pueden ser menores que las mínimas.'
  if (!(d.pointsPercent >= 0 && d.pointsPercent <= 100)) return 'El porcentaje de puntos va de 0 a 100.'
  return null
})

const save = useMutation({
  mutationFn: () => promotions.saveClubLevel({ ...draft.value!, maxVisits: unlimited.value ? null : draft.value!.maxVisits }),
  onSuccess: level => {
    void queryClient.invalidateQueries({ queryKey: keys.clubLevels() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`Nivel ${level.name} actualizado.`)
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="!!level" :label="level ? `Nivel ${level.name}` : 'Nivel'" eyebrow="Club Cinépolis" size="small" :dirty="dirty" @close="emit('close')">
    <form v-if="draft" :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="!problem && save.mutate()">
      <div class="field full">
        <label :for="`${id}-name`">Nombre</label>
        <input :id="`${id}-name`" v-model="draft.name" class="input" maxlength="60" />
      </div>
      <div class="field">
        <label :for="`${id}-min`">Visitas mínimas por semestre</label>
        <input :id="`${id}-min`" v-model.number="draft.minVisits" class="input" type="number" min="0" />
      </div>
      <div class="field">
        <label :for="`${id}-max`">Visitas máximas</label>
        <input :id="`${id}-max`" v-model.number="draft.maxVisits" class="input" type="number" min="0" :disabled="unlimited" />
      </div>
      <label class="check full"><input v-model="unlimited" type="checkbox" /> Sin límite superior</label>
      <div class="field full">
        <label :for="`${id}-points`">Porcentaje del gasto que se vuelve puntos</label>
        <input :id="`${id}-points`" v-model.number="draft.pointsPercent" class="input" type="number" min="0" max="100" step="0.5" />
      </div>
      <div class="field full">
        <label :for="`${id}-benefits`">Beneficios</label>
        <textarea :id="`${id}-benefits`" v-model="draft.benefits" class="textarea" maxlength="1000" />
      </div>
      <p v-if="problem" class="field-error full">{{ problem }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="!!problem || !dirty || save.isPending.value">Guardar</button>
    </template>
  </BaseDialog>
</template>
