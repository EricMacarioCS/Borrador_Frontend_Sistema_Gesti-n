<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { CalendarPlus, Pencil, Search, Trash2 } from '@lucide/vue'
import ScreeningDialog from './ScreeningDialog.vue'
import { keys, useScreenings } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Screening } from '@/domain/models'
import StateView from '@/shared/ui/StateView.vue'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { addDays, formatDate } from '@/shared/lib/datetime'
import { normalizeText } from '@/shared/lib/text'

const store = useSessionStore()
const { screenings: port } = useServices()
const queryClient = useQueryClient()
const today = store.today()

const from = ref(today)
const to = ref(addDays(today, 6))
const complexId = ref('')
const projection = ref('')
const search = ref('')
const selected = ref<string[]>([])
const editing = ref<Screening | null>(null)

const query = computed(() => ({ from: from.value, to: to.value < from.value ? from.value : to.value, complexId: complexId.value || undefined }))
const screenings = useScreenings(query)

const shown = computed(() => (screenings.data.value ?? []).filter(s =>
  (!projection.value || s.projection.code === projection.value) &&
  (!search.value || normalizeText(s.movieTitle).includes(normalizeText(search.value)))))
const days = computed(() => {
  const groups = new Map<string, Screening[]>()
  for (const s of shown.value) groups.set(s.date, [...(groups.get(s.date) ?? []), s])
  return [...groups]
})
/** Una función que ya empezó es historia: no se edita ni se retira. */
const started = (s: Screening) => s.date < today || (s.date === today && s.startTime <= store.nowTime())
const removable = computed(() => shown.value.filter(s => s.ticketsSold === 0 && !started(s)))
const allChecked = computed(() => removable.value.length > 0 && removable.value.every(s => selected.value.includes(s.id)))

function toggleAll(checked: boolean) {
  selected.value = checked ? removable.value.map(s => s.id) : []
}
function setRange(days: number) {
  from.value = today
  to.value = addDays(today, days - 1)
}

const remove = useMutation({
  mutationFn: (ids: string[]) => port.remove(ids),
  onSuccess: (_, ids) => {
    selected.value = selected.value.filter(id => !ids.includes(id))
    void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
    void queryClient.invalidateQueries({ queryKey: keys.movies() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(ids.length === 1 ? 'Se retiró la función.' : `Se retiraron ${ids.length} funciones.`)
  },
  onError: toastError
})

async function retire(ids: string[]) {
  const ok = await confirmAction({
    title: ids.length === 1 ? 'Retirar la función' : `Retirar ${ids.length} funciones`,
    text: 'Dejarán de estar a la venta y se borrarán de la programación. Las que tienen boletos vendidos no se pueden retirar.',
    confirmLabel: 'Retirar', danger: true
  })
  if (ok) remove.mutate(ids)
}
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Funciones y horarios</h1>
        <p>Consulta la programación o crea funciones en varios complejos, salas y horarios a la vez.</p>
      </div>
      <RouterLink to="/funciones/programar" class="btn btn-primary"><CalendarPlus :size="17" /> Programar funciones</RouterLink>
    </div>

    <div class="panel filters">
      <div class="field search grow">
        <label for="f-pelicula">Película</label>
        <Search :size="17" aria-hidden="true" />
        <input id="f-pelicula" v-model="search" class="input" type="search" placeholder="Buscar por título" />
      </div>
      <div class="field">
        <label for="f-complejo">Complejo</label>
        <select id="f-complejo" v-model="complexId" class="select">
          <option value="">Todos</option>
          <option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="field">
        <label for="f-proyeccion">Proyección</label>
        <select id="f-proyeccion" v-model="projection" class="select">
          <option value="">Todas</option>
          <option v-for="p in store.reference?.projections" :key="p.code" :value="p.code">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <label for="f-desde">Desde</label>
        <input id="f-desde" v-model="from" class="input" type="date" />
      </div>
      <div class="field">
        <label for="f-hasta">Hasta</label>
        <input id="f-hasta" v-model="to" class="input" type="date" :min="from" />
      </div>
      <div class="presets">
        <button type="button" class="btn btn-ghost btn-small" @click="setRange(1)">Hoy</button>
        <button type="button" class="btn btn-ghost btn-small" @click="setRange(7)">7 días</button>
        <button type="button" class="btn btn-ghost btn-small" @click="setRange(14)">14 días</button>
      </div>
    </div>

    <div class="summary">
      <p><strong>{{ shown.length }}</strong> {{ shown.length === 1 ? 'función' : 'funciones' }}</p>
      <button v-if="selected.length" type="button" class="btn btn-danger btn-small" :disabled="remove.isPending.value" @click="retire(selected)">
        <Trash2 :size="15" /> Retirar {{ selected.length }} seleccionadas
      </button>
    </div>

    <StateView :loading="screenings.isPending.value" :error="screenings.error.value" :empty="!shown.length" skeleton="rows"
      empty-title="No hay funciones con estos criterios" empty-text="Cambia los filtros o programa funciones nuevas." @retry="screenings.refetch()">
      <div class="panel table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th><input type="checkbox" :checked="allChecked" aria-label="Seleccionar todas las que se pueden retirar" @change="toggleAll(($event.target as HTMLInputElement).checked)" /></th>
              <th>Horario</th><th>Película</th><th>Complejo</th><th>Sala</th><th>Proyección</th><th class="num">Vendidos</th><th>Estado</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody v-for="[date, items] in days" :key="date">
            <tr class="day"><th colspan="9" scope="colgroup">{{ formatDate(date) }}<span v-if="date === today"> · Hoy</span></th></tr>
            <tr v-for="s in items" :key="s.id" :class="{ 'row-off': !s.active }">
              <td><input type="checkbox" :value="s.id" :checked="selected.includes(s.id)" :disabled="s.ticketsSold > 0 || started(s)" :aria-label="`Seleccionar ${s.movieTitle} ${s.startTime}`"
                @change="selected = ($event.target as HTMLInputElement).checked ? [...selected, s.id] : selected.filter(id => id !== s.id)" /></td>
              <td class="time">{{ s.startTime }} – {{ s.endTime }}<small v-if="s.endsNextDay"> (+1 día)</small></td>
              <td><span class="stack"><strong>{{ s.movieTitle }}</strong><small>{{ s.language.name }}</small></span></td>
              <td>{{ store.complexName(s.complexId) }}</td>
              <td>Sala {{ s.roomNumber }} · {{ s.roomType.name }}</td>
              <td><span class="tag">{{ s.projection.name }}</span></td>
              <td class="num">{{ s.ticketsSold }}</td>
              <td><span class="pill" :class="started(s) ? 'muted' : s.active ? 'success' : 'warning'">{{ started(s) ? 'Ya empezó' : s.active ? 'A la venta' : 'Inactiva' }}</span></td>
              <td class="actions-col">
                <div class="row-actions">
                  <button type="button" class="action" :disabled="started(s)" :aria-label="`Editar ${s.movieTitle}, ${s.startTime}`" @click="editing = s"><Pencil :size="15" /> Editar</button>
                  <button type="button" class="action danger" :disabled="s.ticketsSold > 0 || started(s)" :title="s.ticketsSold ? 'Tiene boletos vendidos' : undefined"
                    :aria-label="`Retirar ${s.movieTitle}, ${s.startTime}`" @click="retire([s.id])"><Trash2 :size="15" /> Retirar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </StateView>

    <ScreeningDialog :screening="editing" @close="editing = null" />
  </section>
</template>

<style scoped>
.filters { margin-bottom: 12px; padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 14px; }
.filters .field { min-width: 150px; }
.filters .grow { flex: 1 1 220px; }
.filters .search svg { top: auto; bottom: 11px; transform: none; }
.presets { display: flex; gap: 4px; }
.summary { margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; }
.day th { padding: 10px 14px; background: var(--selection); color: var(--blue); font: 700 13px var(--font-title); text-transform: none; letter-spacing: 0; }
.time { font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; }
.time small { color: var(--muted); font-weight: 400; }
td input[type='checkbox'], th input[type='checkbox'] { width: 16px; height: 16px; accent-color: var(--blue); }
</style>
