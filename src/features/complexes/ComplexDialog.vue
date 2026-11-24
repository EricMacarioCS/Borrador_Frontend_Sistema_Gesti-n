<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation } from '@tanstack/vue-query'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Complex } from '@/domain/models'
import { slugify } from '@/domain/rules'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ complex: Complex | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { complexes } = useServices()
const id = useId()
const draft = ref<Complex | null>(null)
let original = ''

watch(() => props.complex, complex => {
  draft.value = complex ? { ...complex } : null
  original = JSON.stringify(draft.value)
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)
const problem = computed(() => {
  const d = draft.value
  if (!d) return null
  if (!d.name.trim() || !d.address.trim()) return 'Completa el nombre y la dirección.'
  if (!/^\d{5}$/.test(d.postalCode)) return 'El código postal tiene 5 dígitos.'
  if (!slugify(d.slug)) return 'Escribe la URL amigable.'
  return null
})

const save = useMutation({
  mutationFn: () => complexes.update({ ...draft.value!, slug: slugify(draft.value!.slug), imageUrl: draft.value!.imageUrl?.trim() || null, vistaId: draft.value!.vistaId?.trim() || null }),
  onSuccess: async complex => {
    // Los complejos son datos de referencia: se recargan para todo el sistema.
    await store.loadReference()
    toast(`${complex.name} se actualizó.`)
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="!!complex" :label="complex ? `Datos de ${complex.name}` : 'Complejo'" eyebrow="Complejos" :dirty="dirty" @close="emit('close')">
    <form v-if="draft" :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="!problem && save.mutate()">
      <div class="field full">
        <label :for="`${id}-name`">Nombre comercial</label>
        <input :id="`${id}-name`" v-model="draft.name" class="input" maxlength="120" />
      </div>
      <div class="field">
        <label :for="`${id}-kind`">Tipo de complejo</label>
        <select :id="`${id}-kind`" v-model="draft.kind" class="select">
          <option value="traditional">Tradicional</option>
          <option value="vip">VIP</option>
        </select>
        <p class="field-hint">La versión VIP de una plaza es un complejo distinto.</p>
      </div>
      <div class="field">
        <label :for="`${id}-city`">Ciudad</label>
        <select :id="`${id}-city`" v-model="draft.cityId" class="select">
          <option v-for="city in store.reference?.cities" :key="city.id" :value="city.id">{{ city.name }}</option>
        </select>
      </div>
      <div class="field full">
        <label :for="`${id}-address`">Dirección</label>
        <input :id="`${id}-address`" v-model="draft.address" class="input" maxlength="200" />
      </div>
      <div class="field">
        <label :for="`${id}-cp`">Código postal</label>
        <input :id="`${id}-cp`" v-model="draft.postalCode" class="input" inputmode="numeric" maxlength="5" />
      </div>
      <div class="field">
        <label :for="`${id}-opened`">Fecha de apertura</label>
        <input :id="`${id}-opened`" v-model="draft.openedOn" class="input" type="date" />
      </div>
      <div class="field">
        <label :for="`${id}-slug`">URL amigable</label>
        <input :id="`${id}-slug`" v-model="draft.slug" class="input" />
      </div>
      <div class="field">
        <label :for="`${id}-vista`">ID en Vista</label>
        <input :id="`${id}-vista`" v-model="draft.vistaId" class="input" />
      </div>
      <div class="field full">
        <label :for="`${id}-image`">URL de la imagen</label>
        <input :id="`${id}-image`" v-model="draft.imageUrl" class="input" placeholder="https://…" />
      </div>
      <p v-if="problem" class="field-error full">{{ problem }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="!!problem || !dirty || save.isPending.value">Guardar</button>
    </template>
  </BaseDialog>
</template>
