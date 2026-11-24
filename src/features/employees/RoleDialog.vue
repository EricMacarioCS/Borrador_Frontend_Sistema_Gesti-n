<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import type { Role } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ open: boolean; role: Role | null }>()
const emit = defineEmits<{ close: [] }>()
const { employees } = useServices()
const queryClient = useQueryClient()
const id = useId()
const draft = ref({ name: '', isManager: false, responsibilities: '', area: '' })
let original = ''

watch(() => props.open, open => {
  if (!open) return
  const r = props.role
  draft.value = { name: r?.name ?? '', isManager: r?.isManager ?? false, responsibilities: r?.responsibilities ?? '', area: r?.area ?? '' }
  original = JSON.stringify(draft.value)
}, { immediate: true })
const dirty = computed(() => JSON.stringify(draft.value) !== original)

const save = useMutation({
  mutationFn: () => employees.saveRole({ id: props.role?.id ?? null, version: props.role?.version ?? 0, ...draft.value, name: draft.value.name.trim() }),
  onSuccess: role => {
    void queryClient.invalidateQueries({ queryKey: keys.roles() })
    toast(`Puesto ${role.name} guardado.`)
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="open" :label="role ? `Editar ${role.name}` : 'Nuevo puesto'" eyebrow="Puestos" size="small" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="draft.name.trim() && save.mutate()">
      <div class="field full"><label :for="`${id}-name`">Nombre del puesto *</label><input :id="`${id}-name`" v-model="draft.name" class="input" maxlength="80" /></div>
      <div class="field full"><label :for="`${id}-area`">Área</label><input :id="`${id}-area`" v-model="draft.area" class="input" maxlength="80" placeholder="Ej. Dulcería" /></div>
      <div class="field full"><label :for="`${id}-resp`">Responsabilidades</label><textarea :id="`${id}-resp`" v-model="draft.responsibilities" class="textarea" maxlength="1000" /></div>
      <label class="check full"><input v-model="draft.isManager" type="checkbox" /> Es un puesto de mando (gerencia o supervisión)</label>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="!draft.name.trim() || save.isPending.value">Guardar</button>
    </template>
  </BaseDialog>
</template>
