<script setup lang="ts">
/** Salas de un complejo: tipo estructural, proyecciones que admite y acceso al plano de asientos. */
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Armchair, Check } from '@lucide/vue'
import SeatTemplateDialog from './SeatTemplateDialog.vue'
import { keys, useRooms } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Complex, Room } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import StateView from '@/shared/ui/StateView.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { vTableRoles } from '@/shared/ui/tableRoles'

const props = defineProps<{ complex: Complex | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { complexes } = useServices()
const queryClient = useQueryClient()
const rooms = useRooms(() => props.complex?.id ?? null)
const drafts = ref<Record<string, { name: string; type: string; projections: string[] }>>({})
const seatRoom = ref<Room | null>(null)

watch(() => rooms.data.value, list => {
  drafts.value = Object.fromEntries((list ?? []).map(room => [room.id, { name: room.name, type: room.type.code, projections: room.projections.map(p => p.code) }]))
}, { immediate: true })

const changed = (room: Room) => {
  const d = drafts.value[room.id]
  return Boolean(d) && (d!.name !== room.name || d!.type !== room.type.code || [...d!.projections].sort().join() !== room.projections.map(p => p.code).sort().join())
}
const dirty = computed(() => (rooms.data.value ?? []).some(changed))

const save = useMutation({
  mutationFn: (room: Room) => {
    const d = drafts.value[room.id]!
    return complexes.updateRoom({
      ...room, name: d.name.trim() || `Sala ${room.number}`,
      type: store.reference!.roomTypes.find(t => t.code === d.type)!,
      projections: store.reference!.projections.filter(p => d.projections.includes(p.code))
    })
  },
  onSuccess: room => {
    void queryClient.invalidateQueries({ queryKey: keys.rooms(room.complexId) })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`Sala ${room.number} actualizada.`)
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="!!complex" :label="complex ? `Salas de ${complex.name}` : 'Salas'" eyebrow="Complejos y salas" size="wide" :dirty="dirty" @close="emit('close')">
    <p class="notice small spaced">El tipo de sala es estructural y define su plano. La proyección (2D o 3D) se elige en cada función, entre las que la sala admite.</p>
    <StateView :loading="rooms.isPending.value" :error="rooms.error.value" skeleton="rows" @retry="rooms.refetch()">
      <div class="table-wrap">
        <table v-table-roles class="data cards">
          <thead><tr><th>Sala</th><th>Nombre</th><th>Tipo</th><th>Proyecciones</th><th class="num">Asientos</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="room in rooms.data.value" :key="room.id">
              <td data-label="Sala"><strong>{{ room.number }}</strong></td>
              <td data-label="Nombre"><input v-model="drafts[room.id]!.name" class="input" :aria-label="`Nombre de la sala ${room.number}`" maxlength="60" /></td>
              <td data-label="Tipo">
                <select v-model="drafts[room.id]!.type" class="select" :aria-label="`Tipo de la sala ${room.number}`">
                  <option v-for="t in store.reference?.roomTypes" :key="t.code" :value="t.code">{{ t.name }}</option>
                </select>
              </td>
              <td data-label="Proyecciones">
                <span class="projections">
                  <label v-for="p in store.reference?.projections" :key="p.code" class="check">
                    <input v-model="drafts[room.id]!.projections" type="checkbox" :value="p.code" /> {{ p.name }}
                  </label>
                </span>
              </td>
              <td data-label="Asientos" class="num">{{ room.capacity }}</td>
              <td class="actions-col">
                <div class="row-actions">
                  <button type="button" class="icon-btn" :aria-label="`Plano de la sala ${room.number}`" title="Plano de asientos" @click="seatRoom = room"><Armchair :size="16" aria-hidden="true" /></button>
                  <button type="button" class="icon-btn" :disabled="!changed(room) || !drafts[room.id]!.projections.length || save.isPending.value"
                    :aria-label="`Guardar la sala ${room.number}`" title="Guardar la sala" @click="save.mutate(room)"><Check :size="16" aria-hidden="true" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </StateView>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cerrar</button>
    </template>
    <SeatTemplateDialog :room="seatRoom" @close="seatRoom = null" />
  </BaseDialog>
</template>

<style scoped>
.spaced { margin-bottom: 12px; }
.projections { display: flex; flex-wrap: wrap; gap: 6px 14px; }
</style>
