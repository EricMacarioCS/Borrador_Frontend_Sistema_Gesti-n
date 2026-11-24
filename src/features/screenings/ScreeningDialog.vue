<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys, useRooms } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Screening, ScreeningUpdate } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ screening: Screening | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { screenings } = useServices()
const queryClient = useQueryClient()
const id = useId()
const rooms = useRooms(() => props.screening?.complexId ?? null)
const draft = ref<ScreeningUpdate | null>(null)
let original = ''

watch(() => props.screening, screening => {
  if (!screening) return
  draft.value = {
    version: screening.version, roomId: screening.roomId, date: screening.date, startTime: screening.startTime,
    projection: screening.projection.code, language: screening.language.code, active: screening.active
  }
  original = JSON.stringify(draft.value)
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)
const sold = computed(() => props.screening?.ticketsSold ?? 0)
// Solo salas que proyectan en el formato elegido.
const roomOptions = computed(() => (rooms.data.value ?? []).filter(room => room.projections.some(p => p.code === draft.value?.projection)))

const save = useMutation({
  mutationFn: () => screenings.update(props.screening!.id, draft.value!),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast('La función se actualizó.')
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="!!screening" :label="screening ? `Editar ${screening.movieTitle}` : 'Editar función'" :eyebrow="screening ? store.complexName(screening.complexId) : undefined"
    :dirty="dirty" @close="emit('close')">
    <form v-if="draft && screening" :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="save.mutate()">
      <p v-if="sold" class="notice warning full">Tiene {{ sold }} boletos vendidos: solo puedes cambiar el idioma o la proyección. Para moverla, cancela los boletos en Pedidos.</p>
      <div class="field">
        <label :for="`${id}-date`">Fecha</label>
        <input :id="`${id}-date`" v-model="draft.date" class="input" type="date" :min="store.today()" :disabled="sold > 0" />
      </div>
      <div class="field">
        <label :for="`${id}-time`">Hora de inicio</label>
        <input :id="`${id}-time`" v-model="draft.startTime" class="input" type="time" step="300" :disabled="sold > 0" />
      </div>
      <div class="field">
        <label :for="`${id}-projection`">Proyección</label>
        <select :id="`${id}-projection`" v-model="draft.projection" class="select">
          <option v-for="p in store.reference?.projections" :key="p.code" :value="p.code">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-language`">Idioma</label>
        <select :id="`${id}-language`" v-model="draft.language" class="select">
          <option v-for="l in store.reference?.languages" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
      </div>
      <div class="field full">
        <label :for="`${id}-room`">Sala</label>
        <select :id="`${id}-room`" v-model="draft.roomId" class="select" :disabled="sold > 0 || rooms.isPending.value">
          <option v-for="room in roomOptions" :key="room.id" :value="room.id">Sala {{ room.number }} · {{ room.type.name }} · {{ room.projections.map(p => p.name).join(', ') }}</option>
        </select>
        <p v-if="!roomOptions.some(room => room.id === draft!.roomId)" class="field-error">La sala elegida no proyecta en este formato. Elige otra.</p>
      </div>
      <label class="check full"><input v-model="draft.active" type="checkbox" :disabled="sold > 0" /> Función activa (a la venta)</label>
      <p class="field-hint full">Al guardar, el servidor revisa que la sala esté libre con {{ store.reference?.limits.cleaningMinutes }} minutos de limpieza entre funciones.</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="save.isPending.value || !dirty">{{ save.isPending.value ? 'Guardando…' : 'Guardar cambios' }}</button>
    </template>
  </BaseDialog>
</template>
