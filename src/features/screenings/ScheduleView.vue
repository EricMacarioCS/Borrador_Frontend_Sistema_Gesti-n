<script setup lang="ts">
/**
 * Programación por lote en cuatro pasos. El navegador solo arma la solicitud; el servidor planea,
 * asigna salas, detecta traslapes y vuelve a validar todo al crear.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ArrowLeft, ArrowRight, Check, X } from '@lucide/vue'
import { draft, resetDraft, toRequest } from './scheduleDraft'
import { keys, useMovies } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Room } from '@/domain/models'
import { STAGE_LABELS } from '@/domain/labels'
import { endTime, movieStage } from '@/domain/rules'
import MultiSelect from '@/shared/ui/MultiSelect.vue'
import StateView from '@/shared/ui/StateView.vue'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { addDays, formatDate } from '@/shared/lib/datetime'
import { newIdempotencyKey } from '@/shared/lib/ids'

const store = useSessionStore()
const { screenings: port, complexes: complexesPort } = useServices()
const queryClient = useQueryClient()
const route = useRoute()
const router = useRouter()
const movies = useMovies()
const heading = ref<HTMLElement>()
const today = store.today()
const cleaning = computed(() => store.reference?.limits.cleaningMinutes ?? 20)

const STEPS = [
  { title: 'Película e idioma', question: '¿Qué se va a proyectar?', help: 'Puedes marcar varias películas y los dos idiomas.' },
  { title: 'Complejos y salas', question: '¿Dónde y en qué formato?', help: 'Elige complejos, tipos de sala y proyección. Las salas son opcionales: si no eliges, el sistema asigna una libre.' },
  { title: 'Fechas y horarios', question: '¿Cuándo se proyecta?', help: 'Los horarios que marques se repiten en todas las fechas elegidas.' },
  { title: 'Revisar y crear', question: 'Revisa antes de crear', help: 'Cada renglón es una función. Desmarca las que no quieras crear.' }
]

// Película indicada desde el catálogo: empieza el borrador con ella.
if (typeof route.query.pelicula === 'string') {
  resetDraft()
  draft.movieIds = [route.query.pelicula]
  // Se quita de la dirección para que volver a esta página no reinicie el borrador.
  void router.replace({ query: {} })
}

/* Paso 1 */
const activeMovies = computed(() => (movies.data.value ?? []).filter(movie => movieStage(movie, today) !== 'finished'))
const movieOptions = computed(() => activeMovies.value.map(movie => ({ value: movie.id, label: movie.title, hint: `${movie.durationMinutes} min · ${STAGE_LABELS[movieStage(movie, today)]}` })))
const chosenMovies = computed(() => activeMovies.value.filter(movie => draft.movieIds.includes(movie.id)))
const languageOptions = computed(() => (store.reference?.languages ?? []).map(l => ({ value: l.code, label: l.name })))

/* Paso 2: salas de los complejos elegidos */
const complexOptions = computed(() => store.complexes.map(c => ({ value: c.id, label: c.name, hint: c.cityName })))
const roomQueries = useQueries({
  queries: computed(() => draft.complexIds.map(complexId => ({
    queryKey: keys.rooms(complexId),
    queryFn: ({ signal }: { signal: AbortSignal }) => complexesPort.listRooms(complexId, signal),
    staleTime: 5 * 60_000
  })))
})
const rooms = computed<Room[]>(() => roomQueries.value.flatMap(query => query.data ?? []))
const roomsLoading = computed(() => roomQueries.value.some(query => query.isPending))
const roomTypeOptions = computed(() => (store.reference?.roomTypes ?? []).map(type => {
  const count = rooms.value.filter(room => room.type.code === type.code).length
  return { value: type.code, label: type.name, hint: draft.complexIds.length ? (count ? `${count} ${count === 1 ? 'sala' : 'salas'}` : 'Sin salas') : undefined, disabled: draft.complexIds.length > 0 && !roomsLoading.value && !count }
}))
const projectionOptions = computed(() => (store.reference?.projections ?? []).map(p => {
  const count = rooms.value.filter(room => draft.roomTypes.includes(room.type.code) && room.projections.some(x => x.code === p.code)).length
  return { value: p.code, label: p.name, hint: draft.complexIds.length ? (count ? `${count} ${count === 1 ? 'sala' : 'salas'}` : 'Sin salas') : undefined, disabled: draft.complexIds.length > 0 && !roomsLoading.value && !count }
}))
const usableRooms = computed(() => rooms.value.filter(room => draft.roomTypes.includes(room.type.code) && room.projections.some(p => draft.projections.includes(p.code))))

// Al cambiar una selección se retira lo que ya no aplica.
watch([roomTypeOptions, projectionOptions, usableRooms], () => {
  if (roomsLoading.value) return
  const types = draft.roomTypes.filter(code => roomTypeOptions.value.some(o => o.value === code && !o.disabled))
  if (types.length !== draft.roomTypes.length) draft.roomTypes = types
  const projections = draft.projections.filter(code => projectionOptions.value.some(o => o.value === code && !o.disabled))
  if (projections.length !== draft.projections.length) draft.projections = projections
  const picks = draft.roomIds.filter(id => usableRooms.value.some(room => room.id === id))
  if (picks.length !== draft.roomIds.length) draft.roomIds = picks
})

/* Paso 3 */
const halfHours = Array.from({ length: 28 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const customDate = ref('')
const customTime = ref('')
const horizon = computed(() => Array.from({ length: 21 }, (_, i) => addDays(today, i)))
const dateOptions = computed(() => [...new Set([...horizon.value, ...draft.extraDates])].sort().map(date => ({
  value: date, label: formatDate(date), hint: chosenMovies.value.some(m => m.releaseDate && date < m.releaseDate) ? 'Antes del estreno' : date === today ? 'Hoy' : undefined
})))
const timeOptions = computed(() => [...new Set([...halfHours, ...draft.extraTimes])].sort().map(time => ({ value: time, label: time })))
const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))
const presets = [
  { label: 'Hoy', dates: [today] },
  { label: 'Mañana', dates: [week[1]!] },
  { label: 'Fin de semana', dates: week.filter(date => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) },
  { label: 'Próximos 7 días', dates: week }
]
function addDate() {
  if (!customDate.value) return
  if (customDate.value < today) return toast('Elige una fecha a partir de hoy.', 'error')
  draft.extraDates.push(customDate.value)
  draft.dates = [...new Set([...draft.dates, customDate.value])]
  customDate.value = ''
}
function addTime() {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime.value)) return
  draft.extraTimes.push(customTime.value)
  draft.times = [...new Set([...draft.times, customTime.value])]
  customTime.value = ''
}

/* Paso 4: vista previa del servidor */
const request = computed(() => toRequest())
const preview = useQuery({
  queryKey: computed(() => ['schedule-preview', request.value]),
  queryFn: ({ signal }) => port.preview(request.value, signal),
  enabled: computed(() => draft.step === 4),
  staleTime: 0,
  refetchOnWindowFocus: false
})
const rows = computed(() => preview.data.value?.rows ?? [])
const ready = computed(() => rows.value.filter(row => !row.problem && !draft.excluded.includes(row.key)))
const problems = computed(() => rows.value.filter(row => row.problem))
const onlyProblems = ref(false)
const shownRows = computed(() => onlyProblems.value && problems.value.length ? problems.value : rows.value)
function toggleRow(key: string) {
  draft.excluded = draft.excluded.includes(key) ? draft.excluded.filter(k => k !== key) : [...draft.excluded, key]
}

/* Navegación entre pasos */
function problemIn(step: number): string | null {
  if (step === 1) return !draft.movieIds.length ? 'Elige al menos una película.' : !draft.languages.length ? 'Elige al menos un idioma.' : null
  if (step === 2) return !draft.complexIds.length ? 'Elige al menos un complejo.' : !draft.roomTypes.length ? 'Elige al menos un tipo de sala.' : !draft.projections.length ? 'Elige al menos una proyección.' : null
  if (step === 3) {
    if (customDate.value || customTime.value) return 'Pulsa Agregar para incluir la fecha u hora que escribiste.'
    return !draft.dates.length ? 'Elige al menos una fecha.' : !draft.times.length ? 'Elige al menos un horario.' : null
  }
  return null
}
const stepError = ref<string | null>(null)
function goTo(step: number) {
  stepError.value = null
  for (let before = 1; before < step; before++) {
    const problem = problemIn(before)
    if (problem) {
      stepError.value = problem
      step = before
      break
    }
  }
  if (step === 4 && draft.step !== 4) draft.excluded = []
  draft.step = step
  void nextTick(() => heading.value?.focus())
}

const summary = computed(() => [
  { label: 'Películas', values: chosenMovies.value.map(m => m.title) },
  { label: 'Idiomas', values: draft.languages.map(code => store.reference?.languages.find(l => l.code === code)?.name ?? code) },
  { label: 'Complejos', values: draft.complexIds.map(store.complexName) },
  { label: 'Tipos de sala', values: draft.roomTypes.map(code => store.reference?.roomTypes.find(t => t.code === code)?.name ?? code) },
  { label: 'Proyección', values: draft.projections.map(code => store.reference?.projections.find(p => p.code === code)?.name ?? code) },
  { label: 'Salas', values: [draft.roomIds.length ? `${draft.roomIds.length} elegidas` : 'Automáticas'] },
  { label: 'Fechas', values: [...draft.dates].sort().map(date => formatDate(date, 'short')) },
  { label: 'Horarios', values: [...draft.times].sort() }
])
const combos = computed(() => draft.movieIds.length * draft.languages.length * draft.dates.length * draft.times.length * Math.max(1, draft.complexIds.length) * Math.max(1, draft.roomTypes.length) * Math.max(1, draft.projections.length))

/* Crear */
let idempotencyKey = newIdempotencyKey()
const create = useMutation({
  mutationFn: () => port.createBatch(request.value, draft.excluded, idempotencyKey),
  onSuccess: created => {
    idempotencyKey = newIdempotencyKey()
    void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
    void queryClient.invalidateQueries({ queryKey: keys.movies() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    resetDraft()
    const ids = created.map(s => s.id)
    toast(`Se programaron ${created.length} ${created.length === 1 ? 'función' : 'funciones'}.`, 'success', {
      label: 'Deshacer',
      run: () => void port.remove(ids).then(() => {
        void queryClient.invalidateQueries({ queryKey: keys.allScreenings() })
        toast('Se deshizo la programación.', 'info')
      }).catch(toastError)
    })
    void router.push('/funciones')
  },
  onError: error => {
    toastError(error)
    void preview.refetch()
  }
})

async function startOver() {
  if (draft.movieIds.length && !await confirmAction({ title: 'Empezar de nuevo', text: 'Se vaciará la selección de los cuatro pasos.', confirmLabel: 'Vaciar', danger: true })) return
  resetDraft()
  customDate.value = ''
  customTime.value = ''
}
const timeRange = (start: string, duration: number) => {
  const end = endTime(start, duration)
  return `${start}–${end.time}${end.nextDay ? ' (+1)' : ''}`
}
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Programar funciones</h1>
        <p>Completa cuatro pasos. Nada se guarda hasta que pulses Crear.</p>
      </div>
      <RouterLink to="/funciones" class="btn btn-secondary"><ArrowLeft :size="16" /> Ver programación</RouterLink>
    </div>

    <ol class="steps" aria-label="Pasos para programar">
      <li v-for="(step, index) in STEPS" :key="step.title">
        <button type="button" :class="{ current: draft.step === index + 1, done: draft.step > index + 1 }" :aria-current="draft.step === index + 1 ? 'step' : undefined" @click="goTo(index + 1)">
          <span class="n"><Check v-if="draft.step > index + 1" :size="15" /><template v-else>{{ index + 1 }}</template></span>{{ step.title }}
        </button>
      </li>
    </ol>

    <div class="wizard" :class="{ wide: draft.step === 4 }">
      <div class="panel panel-pad main">
        <h2 ref="heading" tabindex="-1">{{ STEPS[draft.step - 1]!.question }}</h2>
        <p class="muted">{{ STEPS[draft.step - 1]!.help }}</p>
        <p v-if="stepError" class="notice danger" role="alert">{{ stepError }}</p>

        <div v-if="draft.step === 1" class="form-grid">
          <MultiSelect v-model="draft.movieIds" class="full" label="Películas *" :options="movieOptions" placeholder="Elige una o varias películas" />
          <MultiSelect v-model="draft.languages" class="full" label="Idiomas *" :options="languageOptions" />
          <ul v-if="chosenMovies.length" class="picked full" role="list">
            <li v-for="movie in chosenMovies" :key="movie.id">
              <span class="stack">
                <strong>{{ movie.title }}</strong>
                <small>{{ movie.durationMinutes }} min + {{ cleaning }} de limpieza · {{ movie.rating }} · Estreno {{ movie.releaseDate ? formatDate(movie.releaseDate, 'short') : 'sin fecha' }}</small>
              </span>
              <button type="button" class="icon-btn" :aria-label="`Quitar ${movie.title}`" @click="draft.movieIds = draft.movieIds.filter(id => id !== movie.id)"><X :size="16" /></button>
            </li>
          </ul>
        </div>

        <div v-else-if="draft.step === 2" class="form-grid">
          <MultiSelect v-model="draft.complexIds" class="full" label="Complejos *" :options="complexOptions" placeholder="Elige uno o varios complejos" />
          <MultiSelect v-model="draft.roomTypes" label="Tipos de sala *" :options="roomTypeOptions" />
          <MultiSelect v-model="draft.projections" label="Proyección *" :options="projectionOptions" />
          <p v-if="!draft.complexIds.length" class="notice full">Al elegir complejos verás cuántas salas admiten cada formato.</p>
          <div v-else class="full rooms">
            <p class="field-label">Salas (opcional)</p>
            <p class="field-hint">Si no marcas ninguna, el servidor asigna la primera sala compatible y libre de cada tipo.</p>
            <StateView :loading="roomsLoading" skeleton="rows">
              <section v-for="complexId in draft.complexIds" :key="complexId" class="room-group" :aria-label="`Salas de ${store.complexName(complexId)}`">
                <h3>{{ store.complexName(complexId) }}</h3>
                <div class="room-list">
                  <label v-for="room in rooms.filter(r => r.complexId === complexId)" :key="room.id" class="room" :class="{ off: !usableRooms.includes(room), on: draft.roomIds.includes(room.id) }">
                    <input v-model="draft.roomIds" type="checkbox" :value="room.id" :disabled="!usableRooms.includes(room)" />
                    <span class="stack"><strong>Sala {{ room.number }}</strong><small>{{ room.type.name }} · {{ room.projections.map(p => p.name).join(', ') }}</small></span>
                  </label>
                </div>
              </section>
            </StateView>
          </div>
        </div>

        <div v-else-if="draft.step === 3" class="form-grid">
          <div class="full presets">
            <span class="field-label">Agregar rápido:</span>
            <button v-for="preset in presets" :key="preset.label" type="button" class="btn btn-secondary btn-small" @click="draft.dates = [...new Set([...draft.dates, ...preset.dates])]">{{ preset.label }}</button>
          </div>
          <MultiSelect v-model="draft.dates" label="Fechas *" :options="dateOptions" placeholder="Elige una o varias fechas">
            <template #footer>
              <input v-model="customDate" class="input" type="date" :min="today" aria-label="Otra fecha" />
              <button type="button" class="btn btn-secondary btn-small" @click="addDate">Agregar</button>
            </template>
          </MultiSelect>
          <MultiSelect v-model="draft.times" label="Horarios de inicio *" :options="timeOptions" placeholder="Elige uno o varios horarios">
            <template #footer>
              <input v-model="customTime" class="input" type="time" aria-label="Otro horario" />
              <button type="button" class="btn btn-secondary btn-small" @click="addTime">Agregar</button>
            </template>
          </MultiSelect>
          <div class="chips">
            <span v-for="date in [...draft.dates].sort()" :key="date" class="chip">{{ formatDate(date, 'short') }}
              <button type="button" :aria-label="`Quitar ${formatDate(date)}`" @click="draft.dates = draft.dates.filter(d => d !== date)"><X :size="13" /></button>
            </span>
          </div>
          <div class="chips">
            <span v-for="time in [...draft.times].sort()" :key="time" class="chip">{{ time }}
              <button type="button" :aria-label="`Quitar ${time}`" @click="draft.times = draft.times.filter(t => t !== time)"><X :size="13" /></button>
            </span>
          </div>
          <div v-if="draft.times.length && chosenMovies.length" class="full durations">
            <h3 class="field-label">Inicio y fin de cada proyección</h3>
            <p v-for="movie in chosenMovies" :key="movie.id"><strong>{{ movie.title }}:</strong> {{ [...draft.times].sort().map(time => timeRange(time, movie.durationMinutes)).join(' · ') }}</p>
          </div>
        </div>

        <template v-else>
          <StateView :loading="preview.isPending.value" :error="preview.error.value" skeleton="rows" @retry="preview.refetch()">
            <p v-if="preview.data.value?.tooMany" class="notice warning" role="alert">La selección supera {{ store.reference?.limits.maxScreeningsPerBatch }} funciones por lote. Reduce alguna de las listas.</p>
            <template v-else>
              <div class="preview-summary" aria-live="polite">
                <span class="pill success">{{ ready.length }} por crear</span>
                <span v-if="problems.length" class="pill warning">{{ problems.length }} con problema: no se crearán</span>
                <span v-if="draft.excluded.length" class="pill muted">{{ draft.excluded.length }} desmarcadas</span>
                <label v-if="problems.length" class="check small"><input v-model="onlyProblems" type="checkbox" /> Ver solo las que tienen problema</label>
              </div>
              <div class="table-wrap preview">
                <table class="data">
                  <thead><tr><th>Crear</th><th>Película</th><th>Fecha y horario</th><th>Complejo y sala</th><th>Formato</th><th>Resultado</th></tr></thead>
                  <tbody>
                    <tr v-for="row in shownRows" :key="row.key" :class="{ 'row-off': draft.excluded.includes(row.key) || row.problem }">
                      <td><input type="checkbox" :checked="!row.problem && !draft.excluded.includes(row.key)" :disabled="!!row.problem"
                        :aria-label="`Crear ${row.movieTitle}, ${row.date}, ${row.startTime}`" @change="toggleRow(row.key)" /></td>
                      <td><span class="stack"><strong>{{ row.movieTitle }}</strong><small>{{ row.language.name }}</small></span></td>
                      <td><span class="stack"><span>{{ formatDate(row.date, 'short') }}</span><small>{{ row.startTime }}–{{ row.endTime }}{{ row.endsNextDay ? ' (+1 día)' : '' }}</small></span></td>
                      <td><span class="stack"><span>{{ store.complexName(row.complexId) }}</span><small>{{ row.roomNumber ? `Sala ${row.roomNumber}` : 'Sin sala' }}</small></span></td>
                      <td><span class="tags"><span class="tag">{{ row.roomType.name }}</span><span class="tag">{{ row.projection.name }}</span></span></td>
                      <td>
                        <span v-if="row.problem" class="problem">{{ row.problem }}</span>
                        <span v-else class="pill" :class="draft.excluded.includes(row.key) ? 'muted' : 'success'">{{ draft.excluded.includes(row.key) ? 'No se creará' : 'Lista' }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="field-hint">Entre funciones de una misma sala se reservan {{ cleaning }} minutos de limpieza. Al crear, el servidor vuelve a revisar todo.</p>
            </template>
          </StateView>
        </template>

        <div class="footer">
          <button v-if="draft.step > 1" type="button" class="btn btn-secondary" @click="goTo(draft.step - 1)"><ArrowLeft :size="16" /> Anterior</button>
          <button type="button" class="btn btn-ghost" @click="startOver">Empezar de nuevo</button>
          <button v-if="draft.step < 4" type="button" class="btn btn-primary next" @click="goTo(draft.step + 1)">Siguiente: {{ STEPS[draft.step]!.title }} <ArrowRight :size="16" /></button>
          <button v-else type="button" class="btn btn-primary next" :disabled="!ready.length || create.isPending.value" @click="create.mutate()">
            <Check :size="16" /> {{ create.isPending.value ? 'Creando…' : `Crear ${ready.length} ${ready.length === 1 ? 'función' : 'funciones'}` }}
          </button>
        </div>
      </div>

      <aside v-if="draft.step < 4" class="panel panel-pad side" aria-label="Resumen de la programación">
        <h2>Resumen</h2>
        <dl>
          <div v-for="item in summary" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd :class="{ pending: !item.values.length }">{{ !item.values.length ? 'Por elegir' : item.values.length > 3 ? `${item.values.slice(0, 3).join(', ')} y ${item.values.length - 3} más` : item.values.join(', ') }}</dd>
          </div>
        </dl>
        <p class="muted small">Hasta {{ combos.toLocaleString('es-MX') }} combinaciones por revisar.</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.steps { margin: 0 0 16px; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; list-style: none; }
.steps button { width: 100%; padding: 10px; display: flex; align-items: center; gap: 8px; border: 0; border-bottom: 3px solid var(--line); background: transparent; color: var(--muted); font-weight: 600; text-align: left; }
.steps .n { width: 26px; height: 26px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--line); color: var(--ink); font-size: 13px; }
.steps .current { border-color: var(--blue); color: var(--blue); }
.steps .current .n { background: var(--blue); color: #fff; }
.steps .done { border-color: var(--success); color: var(--success); }
.steps .done .n { background: var(--success); color: #fff; }
.wizard { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.wizard.wide { grid-template-columns: minmax(0, 1fr); }
.main { display: grid; gap: 14px; }
.main h2 { font: 700 20px var(--font-title); outline: none; }
.picked { display: grid; gap: 8px; }
.picked li { padding: 10px 12px; display: flex; align-items: center; gap: 12px; border: 1px solid var(--line); border-radius: var(--radius-s); }
.picked .stack { flex: 1; }
.rooms { display: grid; gap: 6px; }
.room-group { margin-top: 10px; }
.room-group h3 { margin-bottom: 8px; font: 700 14px var(--font-title); }
.room-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.room { padding: 10px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: var(--radius-s); cursor: pointer; }
.room.on { border-color: var(--blue); background: var(--selection); }
.room.off { opacity: .5; cursor: not-allowed; }
.room input { width: 16px; height: 16px; accent-color: var(--blue); }
.presets { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.durations { display: grid; gap: 4px; font-size: 14px; }
.preview-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.preview { max-height: 520px; overflow: auto; border: 1px solid var(--line); border-radius: var(--radius-s); }
.preview thead th { position: sticky; top: 0; z-index: 1; }
.problem { color: var(--warning); font-size: 13px; font-weight: 600; }
.footer { padding-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; border-top: 1px solid var(--line); }
.next { margin-left: auto; }
.side { position: sticky; top: calc(var(--topbar-height) + 16px); display: grid; gap: 12px; }
.side h2 { font: 700 16px var(--font-title); }
.side dl { display: grid; gap: 10px; }
.side dt { color: var(--muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.side dd { margin: 0; font-size: 14px; }
.side dd.pending { color: var(--muted); font-style: italic; }
td input[type='checkbox'] { width: 16px; height: 16px; accent-color: var(--blue); }
@media (max-width: 1080px) {
  .wizard { grid-template-columns: minmax(0, 1fr); }
  .side { position: static; }
}
@media (max-width: 720px) {
  .steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
