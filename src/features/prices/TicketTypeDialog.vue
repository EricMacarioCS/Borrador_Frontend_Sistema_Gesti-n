<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import type { TicketType } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MoneyInput from '@/shared/ui/MoneyInput.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ open: boolean; type: TicketType | null }>()
const emit = defineEmits<{ close: [] }>()
const { prices } = useServices()
const queryClient = useQueryClient()
const id = useId()
const draft = ref({ name: '', description: '', isPromotional: false, fixed: false, fixedPriceCents: null as number | null })
let original = ''

watch(() => props.open, open => {
  if (!open) return
  const t = props.type
  draft.value = { name: t?.name ?? '', description: t?.description ?? '', isPromotional: t?.isPromotional ?? false, fixed: t?.fixedPriceCents != null, fixedPriceCents: t?.fixedPriceCents ?? null }
  original = JSON.stringify(draft.value)
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)
const valid = computed(() => draft.value.name.trim() && (!draft.value.fixed || (draft.value.fixedPriceCents ?? 0) > 0))

const save = useMutation({
  mutationFn: () => prices.saveTicketType({
    id: props.type?.id ?? null, version: props.type?.version ?? 0, name: draft.value.name.trim(), description: draft.value.description.trim(),
    isPromotional: draft.value.isPromotional, fixedPriceCents: draft.value.fixed ? draft.value.fixedPriceCents : null
  }),
  onSuccess: type => {
    void queryClient.invalidateQueries({ queryKey: keys.ticketTypes() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`Tipo de boleto ${type.name} guardado.`)
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="open" :label="type ? `Editar ${type.name}` : 'Nuevo tipo de boleto'" eyebrow="Tarifas" size="small" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="valid && save.mutate()">
      <div class="field full">
        <label :for="`${id}-name`">Nombre *</label>
        <input :id="`${id}-name`" v-model="draft.name" class="input" maxlength="60" />
      </div>
      <div class="field full">
        <label :for="`${id}-description`">Descripción</label>
        <input :id="`${id}-description`" v-model="draft.description" class="input" maxlength="200" placeholder="Ej. De 3 a 11 años" />
      </div>
      <label class="check full"><input v-model="draft.isPromotional" type="checkbox" /> Es promocional</label>
      <label class="check full"><input v-model="draft.fixed" type="checkbox" /> Precio fijo en todos los complejos (no usa la tarifa)</label>
      <div v-if="draft.fixed" class="field full">
        <label :for="`${id}-fixed`">Precio fijo *</label>
        <MoneyInput :id="`${id}-fixed`" v-model="draft.fixedPriceCents" />
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="!valid || save.isPending.value">Guardar</button>
    </template>
  </BaseDialog>
</template>
