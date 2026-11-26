<script setup lang="ts">
/**
 * Plano de asientos de una sala (`asiento_plantilla`). Las columnas sin asiento son pasillos: así el plano
 * irregular se guarda sin columnas nuevas. Solo afecta a las funciones que se creen después.
 */
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Minus, Plus } from '@lucide/vue'
import { keys, useSeatTemplate } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { SEAT_LABELS } from '@/domain/labels'
import type { Room, SeatKind, SeatTemplateRow } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import StateView from '@/shared/ui/StateView.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { clone } from '@/shared/lib/clone'

const props = defineProps<{ room: Room | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { complexes } = useServices()
const queryClient = useQueryClient()
const template = useSeatTemplate(() => props.room?.id ?? null)

type Brush = SeatKind | 'aisle'
const brush = ref<Brush>('standard')
const rows = ref<SeatTemplateRow[]>([])
const columns = ref(1)
let original = ''

watch(() => template.data.value, value => {
  if (!value) return
  rows.value = clone(value.rows)
  columns.value = Math.max(1, ...value.rows.flatMap(row => row.seats.map(seat => seat.column)))
  original = JSON.stringify(rows.value)
}, { immediate: true })

const dirty = computed(() => JSON.stringify(rows.value) !== original)
const capacity = computed(() => rows.value.reduce((sum, row) => sum + row.seats.length, 0))
const counts = computed(() => Object.fromEntries((Object.keys(SEAT_LABELS) as SeatKind[]).map(kind =>
  [kind, rows.value.reduce((sum, row) => sum + row.seats.filter(seat => seat.kind === kind).length, 0)])) as Record<SeatKind, number>)
const seatAt = (row: SeatTemplateRow, column: number) => row.seats.find(seat => seat.column === column)

function paint(row: SeatTemplateRow, column: number) {
  const seat = seatAt(row, column)
  if (brush.value === 'aisle') row.seats = row.seats.filter(s => s.column !== column)
  else if (seat) seat.kind = brush.value
  else row.seats = [...row.seats, { column, kind: brush.value }].sort((a, b) => a.column - b.column)
}
const letter = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `A${String.fromCharCode(65 + index - 26)}`
function addRow() {
  const last = rows.value.at(-1)
  rows.value.push({ label: letter(rows.value.length), seats: last ? last.seats.map(seat => ({ column: seat.column, kind: 'standard' })) : [{ column: 1, kind: 'standard' }] })
}
function removeRow() {
  if (rows.value.length > 1) rows.value.pop()
}
function setColumns(value: number) {
  columns.value = Math.min(40, Math.max(1, value))
  for (const row of rows.value) row.seats = row.seats.filter(seat => seat.column <= columns.value)
}

const save = useMutation({
  mutationFn: () => complexes.saveSeatTemplate({ roomId: props.room!.id, version: template.data.value!.version, rows: rows.value }),
  onSuccess: async saved => {
    queryClient.setQueryData(keys.seatTemplate(saved.roomId), saved)
    void queryClient.invalidateQueries({ queryKey: keys.allRooms() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    await store.loadReference()
    toast(`Plano guardado: ${capacity.value} asientos.`)
    emit('close')
  },
  onError: toastError
})
const BRUSHES: { value: Brush; label: string }[] = [...(Object.entries(SEAT_LABELS) as [SeatKind, string][]).map(([value, label]) => ({ value, label })), { value: 'aisle', label: 'Pasillo (sin asiento)' }]
</script>

<template>
  <BaseDialog :open="!!room" :label="room ? `Plano de la sala ${room.number}` : 'Plano'" :eyebrow="room ? `${store.complexName(room.complexId)} · ${room.type.name}` : undefined"
    size="wide" :dirty="dirty" @close="emit('close')">
    <StateView :loading="template.isPending.value" :error="template.error.value" skeleton="block" @retry="template.refetch()">
      <div class="layout">
        <div class="tools">
          <fieldset class="brushes">
            <legend class="field-label">Al hacer clic en una butaca, marcarla como:</legend>
            <label v-for="item in BRUSHES" :key="item.value" class="check" :class="`k-${item.value}`">
              <input v-model="brush" type="radio" name="brush" :value="item.value" /> <i aria-hidden="true" /> {{ item.label }}
            </label>
          </fieldset>
          <div class="field">
            <span class="field-label">Columnas</span>
            <div class="stepper">
              <button type="button" class="icon-btn" aria-label="Quitar columna" @click="setColumns(columns - 1)"><Minus :size="16" /></button>
              <strong>{{ columns }}</strong>
              <button type="button" class="icon-btn" aria-label="Agregar columna" @click="setColumns(columns + 1)"><Plus :size="16" /></button>
            </div>
          </div>
          <div class="field">
            <span class="field-label">Filas</span>
            <div class="stepper">
              <button type="button" class="icon-btn" aria-label="Quitar la última fila" :disabled="rows.length <= 1" @click="removeRow"><Minus :size="16" /></button>
              <strong>{{ rows.length }}</strong>
              <button type="button" class="icon-btn" aria-label="Agregar una fila" :disabled="rows.length >= 30" @click="addRow"><Plus :size="16" /></button>
            </div>
          </div>
          <dl class="totals">
            <div><dt>Capacidad</dt><dd>{{ capacity }}</dd></div>
            <div v-for="(label, kind) in SEAT_LABELS" :key="kind"><dt>{{ label }}</dt><dd>{{ counts[kind] }}</dd></div>
          </dl>
          <p class="field-hint">Los cambios aplican a las funciones que se creen después; las ya programadas conservan su plano.</p>
        </div>
        <div class="map" role="grid" :aria-label="`Plano de ${rows.length} filas`">
          <div class="screen" aria-hidden="true">PANTALLA</div>
          <div v-for="row in rows" :key="row.label" class="row" role="row">
            <span class="label" role="rowheader">{{ row.label }}</span>
            <button v-for="column in columns" :key="column" type="button" role="gridcell" class="seat" :class="seatAt(row, column) ? `k-${seatAt(row, column)!.kind}` : 'k-aisle'"
              :aria-label="`Fila ${row.label}, columna ${column}: ${seatAt(row, column) ? SEAT_LABELS[seatAt(row, column)!.kind] : 'pasillo'}`" @click="paint(row, column)" />
            <span class="label" aria-hidden="true">{{ row.label }}</span>
          </div>
        </div>
      </div>
    </StateView>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="button" class="btn btn-primary" :disabled="!dirty || !capacity || save.isPending.value" @click="save.mutate()">Guardar plano</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 20px; align-items: start; }
.tools { display: grid; gap: 14px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--surface-soft); }
.brushes { margin: 0; padding: 0; border: 0; display: grid; gap: 6px; }
.brushes legend { margin-bottom: 6px; }
.brushes i, .seat { width: 18px; height: 18px; border-radius: var(--radius-s) var(--radius-s) 4px 4px; border: 1px solid transparent; }
.brushes i { display: inline-block; }
.k-standard i, .seat.k-standard { background: var(--seat-standard); }
.k-premium i, .seat.k-premium { background: var(--seat-premium); }
.k-accessible i, .seat.k-accessible { background: var(--seat-accessible); }
.k-companion i, .seat.k-companion { background: var(--seat-companion); }
.k-aisle i, .seat.k-aisle { background: transparent; border: 1px dashed var(--line-strong); }
.stepper { display: flex; align-items: center; gap: 6px; }
.stepper strong { min-width: 32px; text-align: center; }
.totals { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font-size: var(--text-s); }
.totals div { display: contents; }
.totals dt { color: var(--muted); }
.totals dd { margin: 0; font-weight: 700; text-align: right; }
.map { overflow: auto; padding: 16px; border-radius: var(--radius-l); background: var(--navy-950); }
.screen { margin: 0 auto 18px; width: 70%; padding: 4px; border-radius: 0 0 50% 50% / 0 0 100% 100%; background: var(--seat-screen); color: var(--navy-950); font: 700 var(--text-xs) var(--font-title); letter-spacing: .3em; text-align: center; }
.row { width: max-content; margin: 0 auto 4px; display: flex; align-items: center; gap: 4px; }
.label { width: 22px; color: var(--seat-label); font: 700 var(--text-xs) var(--font-title); text-align: center; }
.seat { padding: 0; cursor: pointer; }
.seat:hover { outline: 2px solid var(--accent); }
@media (max-width: 900px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
