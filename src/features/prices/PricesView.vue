<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Calculator as CalculatorIcon, Check, Pencil, Plus, RotateCcw } from '@lucide/vue'
import TicketTypeDialog from './TicketTypeDialog.vue'
import { buildMatrix, calculate, toPrices, type Calculator, type MatrixRow } from './priceMatrix'
import { keys, usePriceSheet, useRooms, useTicketTypes } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { TicketType } from '@/domain/models'
import MoneyInput from '@/shared/ui/MoneyInput.vue'
import StateView from '@/shared/ui/StateView.vue'
import { useDirtyGuard } from '@/shared/composables/dirty'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { formatMoney } from '@/shared/lib/money'
import { vTableRoles } from '@/shared/ui/tableRoles'

const store = useSessionStore()
const { prices: port } = useServices()
const queryClient = useQueryClient()
const tab = ref<'prices' | 'types'>('prices')
const complexId = ref(store.complexes[0]?.id ?? '')
const sheet = usePriceSheet(complexId)
const rooms = useRooms(complexId)
const ticketTypes = useTicketTypes()
const rateTypes = computed(() => (ticketTypes.data.value ?? []).filter(type => type.fixedPriceCents === null))
const rows = ref<MatrixRow[]>([])
let original = ''

function reset() {
  if (!sheet.data.value || !rooms.data.value || !ticketTypes.data.value || !store.reference) return
  rows.value = buildMatrix(rooms.data.value, sheet.data.value.prices, rateTypes.value, store.reference.roomTypes, store.reference.projections)
  original = JSON.stringify(rows.value)
}
watch([() => sheet.data.value, () => rooms.data.value, () => ticketTypes.data.value], reset, { immediate: true })

const dirty = computed(() => JSON.stringify(rows.value) !== original)
useDirtyGuard(() => dirty.value)
const invalidCells = computed(() => rows.value.some(row => row.onlineFeeCents === null && Object.values(row.prices).some(v => v !== null)))
const empty = computed(() => rows.value.filter(row => row.inUse).reduce((n, row) => n + Object.values(row.prices).filter(v => v === null).length, 0))

async function changeComplex(event: Event) {
  const select = event.target as HTMLSelectElement
  if (dirty.value && !await confirmAction({ title: 'Descartar cambios', text: 'Hay precios sin guardar en este complejo.', confirmLabel: 'Descartar', danger: true })) {
    select.value = complexId.value
    return
  }
  complexId.value = select.value
}

/* Calculadora */
const calcOpen = ref(false)
const calc = ref<{ base: number | null; fee: number | null }>({ base: 8500, fee: 600 })
const roomSurcharge = ref<Record<string, number | null>>({ 'traditional': 0, 'junior': 1000, 'macro-xe': 3000, 'imax': 4500, '4dx': 6000, 'vip': 7000 })
const projectionSurcharge = ref<Record<string, number | null>>({ '2d': 0, '3d': 2500 })
const percents = ref<Record<string, number>>({})
watch(rateTypes, types => {
  for (const type of types) percents.value[type.id] ??= type.name === 'General' ? 100 : type.name === 'Niño' ? 75 : type.name.startsWith('Adulto') ? 80 : 100
}, { immediate: true })
const calcValid = computed(() => calc.value.base !== null && calc.value.base > 0 && calc.value.fee !== null &&
  Object.values(roomSurcharge.value).every(v => v !== null) && Object.values(projectionSurcharge.value).every(v => v !== null) &&
  Object.values(percents.value).every(v => Number.isFinite(v) && v > 0 && v <= 100))
function applyCalculator() {
  const settings: Calculator = {
    baseCents: calc.value.base!, onlineFeeCents: calc.value.fee!, percents: percents.value,
    roomSurcharges: Object.fromEntries(Object.entries(roomSurcharge.value).map(([k, v]) => [k, v ?? 0])),
    projectionSurcharges: Object.fromEntries(Object.entries(projectionSurcharge.value).map(([k, v]) => [k, v ?? 0]))
  }
  rows.value = rows.value.map(row => row.inUse ? calculate(row, settings) : row)
  calcOpen.value = false
  toast('Se llenó la tabla. Revisa y guarda.', 'info')
}

const save = useMutation({
  mutationFn: () => port.saveSheet(complexId.value, sheet.data.value!.version, toPrices(rows.value)),
  onSuccess: saved => {
    queryClient.setQueryData(keys.priceSheet(saved.complexId), saved)
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`Tarifa de ${store.complexName(saved.complexId)} guardada.`)
  },
  onError: toastError
})

const typeDialog = ref<{ type: TicketType | null } | null>(null)
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Tarifas</h1>
        <p>Cada precio es explícito por complejo, tipo de sala, proyección y tipo de boleto. Las compras hechas conservan el precio que se cobró.</p>
      </div>
      <div v-if="tab === 'prices'" class="page-actions">
        <span v-if="dirty" class="pill warning" role="status">Cambios sin guardar</span>
        <button type="button" class="btn btn-secondary" :disabled="!dirty" @click="reset"><RotateCcw :size="16" /> Deshacer</button>
        <button type="button" class="btn btn-primary" :disabled="!dirty || invalidCells || save.isPending.value" @click="save.mutate()"><Check :size="16" /> Guardar tarifa</button>
      </div>
      <button v-else type="button" class="btn btn-primary" @click="typeDialog = { type: null }"><Plus :size="16" /> Nuevo tipo de boleto</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Secciones de tarifas">
      <button type="button" role="tab" :aria-selected="tab === 'prices'" @click="tab = 'prices'">Precios por complejo</button>
      <button type="button" role="tab" :aria-selected="tab === 'types'" @click="tab = 'types'">Tipos de boleto</button>
    </div>

    <template v-if="tab === 'prices'">
      <div class="toolbar">
        <div class="field">
          <label for="tarifa-complejo">Complejo</label>
          <select id="tarifa-complejo" class="select" :value="complexId" @change="changeComplex">
            <option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary" :aria-expanded="calcOpen" @click="calcOpen = !calcOpen"><CalculatorIcon :size="16" /> Calcular desde una tarifa base</button>
      </div>

      <div v-if="calcOpen" class="panel panel-pad calc">
        <p class="muted small">Precio completo = base + recargo del tipo de sala + recargo de la proyección. Cada tipo de boleto paga un porcentaje. Se redondea al peso y solo llena la tabla: nada se guarda hasta que pulses Guardar.</p>
        <div class="calc-grid">
          <div class="field"><label for="calc-base">Base General</label><MoneyInput id="calc-base" v-model="calc.base" /></div>
          <div class="field"><label for="calc-fee">Cargo en línea por boleto</label><MoneyInput id="calc-fee" v-model="calc.fee" /></div>
          <div v-for="t in store.reference?.roomTypes" :key="t.code" class="field">
            <label :for="`calc-room-${t.code}`">Recargo {{ t.name }}</label><MoneyInput :id="`calc-room-${t.code}`" v-model="roomSurcharge[t.code]!" />
          </div>
          <div v-for="p in store.reference?.projections" :key="p.code" class="field">
            <label :for="`calc-proj-${p.code}`">Recargo {{ p.name }}</label><MoneyInput :id="`calc-proj-${p.code}`" v-model="projectionSurcharge[p.code]!" />
          </div>
          <div v-for="type in rateTypes" :key="type.id" class="field">
            <label :for="`calc-pct-${type.id}`">{{ type.name }} paga (%)</label>
            <input :id="`calc-pct-${type.id}`" v-model.number="percents[type.id]" class="input" type="number" min="1" max="100" />
          </div>
        </div>
        <div class="calc-actions">
          <button type="button" class="btn btn-secondary" @click="calcOpen = false">Cerrar</button>
          <button type="button" class="btn btn-primary" :disabled="!calcValid" @click="applyCalculator">Llenar la tabla</button>
        </div>
      </div>

      <StateView :loading="sheet.isPending.value || rooms.isPending.value || ticketTypes.isPending.value" :error="sheet.error.value ?? rooms.error.value ?? ticketTypes.error.value"
        skeleton="rows" @retry="() => { sheet.refetch(); rooms.refetch(); ticketTypes.refetch() }">
        <p v-if="empty" class="notice warning small spaced">{{ empty }} precios vacíos: esas combinaciones no se podrán vender en este complejo.</p>
        <div class="panel table-wrap">
          <table v-table-roles class="data cards matrix">
            <thead>
              <tr><th>Sala y proyección</th><th v-for="type in rateTypes" :key="type.id">{{ type.name }}</th><th>Cargo en línea</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="`${row.roomType.code}-${row.projection.code}`" :class="{ 'row-off': !row.inUse }">
                <td><span class="stack"><strong>{{ row.roomType.name }} · {{ row.projection.name }}</strong><span v-if="!row.inUse" class="pill muted off">Ninguna sala la ofrece hoy</span></span></td>
                <td v-for="type in rateTypes" :key="type.id" :data-label="type.name">
                  <MoneyInput v-model="row.prices[type.id]!" :label="`${type.name}, ${row.roomType.name} ${row.projection.name}`" placeholder="Sin precio" />
                </td>
                <td data-label="Cargo en línea"><MoneyInput v-model="row.onlineFeeCents" :label="`Cargo en línea, ${row.roomType.name} ${row.projection.name}`" :invalid="row.onlineFeeCents === null" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="field-hint spaced-top">Los tipos de boleto con precio fijo no aparecen aquí. La regla de no vender boleto de niño en B15, C y D la aplica el servidor.</p>
      </StateView>
    </template>

    <StateView v-else :loading="ticketTypes.isPending.value" :error="ticketTypes.error.value" skeleton="rows" @retry="ticketTypes.refetch()">
      <div class="panel table-wrap">
        <table v-table-roles class="data cards">
          <thead><tr><th>Tipo de boleto</th><th>Descripción</th><th>Precio</th><th>Promocional</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="type in ticketTypes.data.value" :key="type.id">
              <td><strong>{{ type.name }}</strong></td>
              <td data-label="Descripción">{{ type.description || '—' }}</td>
              <td data-label="Precio">{{ type.fixedPriceCents === null ? 'Según la tarifa de cada complejo' : `${formatMoney(type.fixedPriceCents)} fijo` }}</td>
              <td data-label="Promocional">{{ type.isPromotional ? 'Sí' : 'No' }}</td>
              <td class="actions-col"><div class="row-actions"><button type="button" class="icon-btn" :aria-label="`Editar ${type.name}`" title="Editar" @click="typeDialog = { type }"><Pencil :size="16" aria-hidden="true" /></button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </StateView>

    <TicketTypeDialog :open="!!typeDialog" :type="typeDialog?.type ?? null" @close="typeDialog = null" />
  </section>
</template>

<style scoped>
.calc { margin-bottom: 16px; display: grid; gap: 14px; }
.calc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.calc-actions { display: flex; justify-content: flex-end; gap: 10px; }
.matrix td { min-width: 130px; }
.matrix td:first-child { min-width: 190px; }
.off { justify-self: start; }
@media (max-width: 640px) { .matrix td, .matrix td:first-child { min-width: 0; } }
.spaced { margin-bottom: 12px; }
.spaced-top { margin-top: 10px; }
</style>
