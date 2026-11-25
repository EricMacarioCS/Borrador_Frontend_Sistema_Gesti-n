<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueries } from '@tanstack/vue-query'
import { ArrowUpRight, Building2, CalendarPlus, Clapperboard, Clock, Sparkles } from '@lucide/vue'
import { keys, useActivity, useMovies, useScreenings } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { STAGE_LABELS } from '@/domain/labels'
import type { Movie } from '@/domain/models'
import { movieStage } from '@/domain/rules'
import StateView from '@/shared/ui/StateView.vue'
import { addDays, formatDate, formatDateTime } from '@/shared/lib/datetime'

/**
 * Panel operativo: lo que pasa hoy y lo que requiere atención. No muestra ventas ni ingresos;
 * esas cifras se consultan en Vista y en los sistemas de la cadena.
 */
const store = useSessionStore()
const { products: productsPort } = useServices()
const today = store.today()
const weekEnd = addDays(today, 6)
const count = (n: number) => n.toLocaleString('es-MX')

const complexId = ref('')
const scopeComplexes = computed(() => complexId.value ? store.complexes.filter(c => c.id === complexId.value) : store.complexes)
const scopeLabel = computed(() => complexId.value ? store.complexName(complexId.value) : store.chainAdmin ? 'Toda la cadena' : store.complexes[0]?.name ?? 'Tu complejo')

const week = useScreenings(computed(() => ({ from: today, to: weekEnd, complexId: complexId.value || undefined })))
const movies = useMovies()
const activity = useActivity(8)

/* Funciones de hoy */
const todays = computed(() => (week.data.value ?? []).filter(s => s.date === today && s.active))
const pending = computed(() => todays.value.filter(s => s.startTime > store.nowTime()))
const nextUp = computed(() => pending.value.slice().sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 8))

/* Cartelera */
const stageOf = (movie: Movie) => movieStage(movie, today)
const showing = computed(() => (movies.data.value ?? []).filter(m => ['premiere', 'now-showing'].includes(stageOf(m))))
const releases = computed(() => (movies.data.value ?? [])
  .filter(m => m.releaseDate && m.releaseDate >= today && m.releaseDate <= weekEnd || stageOf(m) === 'presale')
  .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '')))

/* Atención */
const scheduledMovieIds = computed(() => new Set((week.data.value ?? []).filter(s => s.active).map(s => s.movieId)))
const withoutScreenings = computed(() => showing.value.filter(m => !scheduledMovieIds.value.has(m.id)))
const endingSoon = computed(() => showing.value
  .filter(m => m.lastDay && m.lastDay >= today && m.lastDay <= weekEnd)
  .sort((a, b) => a.lastDay!.localeCompare(b.lastDay!)))

/* Dulcería: productos marcados como no disponibles en los complejos que se ven */
const showProducts = computed(() => store.can('products.manage'))
const catalogs = useQueries({
  queries: computed(() => (showProducts.value ? scopeComplexes.value : []).map(complex => ({
    queryKey: keys.catalog(complex.id),
    queryFn: ({ signal }: { signal: AbortSignal }) => productsPort.catalog(complex.id, signal)
  })))
})
const unavailable = computed(() => catalogs.value
  .flatMap(query => query.data ?? [])
  .filter(entry => !entry.available)
  .map(entry => ({ key: `${entry.complexId}-${entry.product.id}`, name: entry.product.name, complex: store.complexName(entry.complexId) })))
const catalogsLoading = computed(() => catalogs.value.some(query => query.isPending))

const attentionCount = computed(() => withoutScreenings.value.length + endingSoon.value.length)
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Panel principal</h1>
        <p>Operación de {{ store.chainAdmin ? 'la cadena' : store.complexes[0]?.name ?? 'tu complejo' }}: funciones de hoy, cartelera y pendientes.</p>
      </div>
      <div class="page-actions">
        <div v-if="store.complexes.length > 1" class="field scope">
          <label for="d-complejo" class="visually-hidden">Complejo</label>
          <select id="d-complejo" v-model="complexId" class="select">
            <option value="">Toda la cadena</option>
            <option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <RouterLink v-if="store.can('screenings.manage')" to="/funciones/programar" class="btn btn-primary"><CalendarPlus :size="16" /> Programar funciones</RouterLink>
      </div>
    </div>

    <div class="metric-grid">
      <article class="panel metric">
        <div class="metric-top"><span>Funciones hoy</span><span class="metric-icon"><Clock :size="17" /></span></div>
        <strong>{{ week.isPending.value ? '—' : count(todays.length) }}</strong>
        <span class="foot">{{ count(pending.length) }} por empezar · {{ scopeLabel }}</span>
      </article>
      <article class="panel metric">
        <div class="metric-top"><span>Películas en cartelera</span><span class="metric-icon"><Clapperboard :size="17" /></span></div>
        <strong>{{ movies.isPending.value ? '—' : count(showing.length) }}</strong>
        <span class="foot">{{ showing.filter(m => stageOf(m) === 'premiere').length }} en periodo de estreno</span>
      </article>
      <article class="panel metric">
        <div class="metric-top"><span>Estrenos y preventas</span><span class="metric-icon"><Sparkles :size="17" /></span></div>
        <strong>{{ movies.isPending.value ? '—' : count(releases.length) }}</strong>
        <span class="foot">Estrenan esta semana o ya están en preventa</span>
      </article>
      <article class="panel metric">
        <div class="metric-top"><span>Complejos</span><span class="metric-icon"><Building2 :size="17" /></span></div>
        <strong>{{ scopeComplexes.length }}</strong>
        <span class="foot">{{ scopeComplexes.reduce((sum, c) => sum + c.roomCount, 0) }} salas · {{ count(scopeComplexes.reduce((sum, c) => sum + c.seatCount, 0)) }} asientos</span>
      </article>
    </div>

    <div class="grid">
      <article class="panel">
        <div class="panel-head">
          <div><h2>Próximas funciones de hoy</h2><p>{{ scopeLabel }} · {{ formatDate(today) }}</p></div>
          <RouterLink to="/funciones" class="action">Ver programación <ArrowUpRight :size="14" /></RouterLink>
        </div>
        <StateView :loading="week.isPending.value" :error="week.error.value" :empty="!nextUp.length" skeleton="rows"
          empty-title="No quedan funciones hoy" empty-text="Las funciones de hoy ya empezaron o no hay programación." @retry="week.refetch()">
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Hora</th><th>Película</th><th>Complejo</th><th>Sala</th><th>Proyección</th></tr></thead>
              <tbody>
                <tr v-for="s in nextUp" :key="s.id">
                  <td class="time">{{ s.startTime }}</td>
                  <td><span class="stack"><strong>{{ s.movieTitle }}</strong><small>{{ s.language.name }}</small></span></td>
                  <td>{{ store.complexName(s.complexId) }}</td>
                  <td>Sala {{ s.roomNumber }} · {{ s.roomType.name }}</td>
                  <td><span class="tag">{{ s.projection.name }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </StateView>
      </article>

      <article class="panel">
        <div class="panel-head"><div><h2>Estrenos y preventas</h2><p>Estrenos de los próximos 7 días y preventas abiertas</p></div></div>
        <StateView :loading="movies.isPending.value" :error="movies.error.value" :empty="!releases.length" skeleton="rows"
          empty-title="Sin estrenos esta semana" @retry="movies.refetch()">
          <ul class="list" role="list">
            <li v-for="m in releases" :key="m.id">
              <span class="stack"><strong>{{ m.title }}</strong><small>Estreno {{ m.releaseDate ? formatDate(m.releaseDate, 'short') : 'sin fecha' }}</small></span>
              <span class="pill" :class="stageOf(m) === 'presale' ? 'info' : 'muted'">{{ STAGE_LABELS[stageOf(m)] }}</span>
            </li>
          </ul>
        </StateView>
      </article>
    </div>

    <div class="grid">
      <article class="panel">
        <div class="panel-head">
          <div><h2>Requiere atención</h2><p>Cartelera de los próximos 7 días · {{ scopeLabel }}</p></div>
          <span v-if="attentionCount" class="pill warning">{{ attentionCount }}</span>
        </div>
        <StateView :loading="movies.isPending.value || week.isPending.value" :error="movies.error.value ?? week.error.value" :empty="!attentionCount" skeleton="rows"
          empty-title="Todo en orden" empty-text="Las películas en cartelera tienen funciones y ninguna termina esta semana." @retry="movies.refetch(); week.refetch()">
          <ul class="list" role="list">
            <li v-for="m in withoutScreenings" :key="`sin-${m.id}`">
              <span class="stack"><strong>{{ m.title }}</strong><small>En cartelera sin funciones programadas</small></span>
              <RouterLink v-if="store.can('screenings.manage')" to="/funciones/programar" class="action">Programar</RouterLink>
            </li>
            <li v-for="m in endingSoon" :key="`fin-${m.id}`">
              <span class="stack"><strong>{{ m.title }}</strong><small>Último día: {{ formatDate(m.lastDay!, 'short') }}</small></span>
              <span class="pill muted">Termina pronto</span>
            </li>
          </ul>
        </StateView>
      </article>

      <article v-if="showProducts" class="panel">
        <div class="panel-head">
          <div><h2>Productos no disponibles</h2><p>Dulcería · {{ scopeLabel }}</p></div>
          <RouterLink to="/dulceria" class="action">Ver dulcería <ArrowUpRight :size="14" /></RouterLink>
        </div>
        <StateView :loading="catalogsLoading" :empty="!unavailable.length" skeleton="rows"
          empty-title="Todo disponible" empty-text="Ningún producto está marcado como no disponible.">
          <ul class="list" role="list">
            <li v-for="item in unavailable" :key="item.key">
              <span class="stack"><strong>{{ item.name }}</strong><small>{{ item.complex }}</small></span>
              <span class="pill danger">No disponible</span>
            </li>
          </ul>
        </StateView>
      </article>

      <article class="panel">
        <div class="panel-head"><div><h2>Actividad reciente</h2><p>Cambios hechos en el sistema</p></div></div>
        <StateView :loading="activity.isPending.value" :error="activity.error.value" :empty="!activity.data.value?.length" skeleton="rows" empty-title="Sin actividad" @retry="activity.refetch()">
          <ol class="activity" role="list">
            <li v-for="item in activity.data.value" :key="item.id">
              <span class="tag">{{ item.area }}</span>
              <p>{{ item.summary }}</p>
              <small>{{ item.actor }} · {{ formatDateTime(item.at) }}</small>
            </li>
          </ol>
        </StateView>
      </article>
    </div>
  </section>
</template>

<style scoped>
.scope { min-width: 220px; }
.foot { color: var(--muted); font-size: 12px; }
.grid { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }
.grid + .grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.time { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.list { padding: 4px 20px 12px; display: grid; }
.list li { padding: 11px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); }
.list li:last-child { border-bottom: 0; }
.list .stack { min-width: 0; }
.activity { padding: 6px 20px 16px; display: grid; }
.activity li { padding: 12px 0; display: grid; gap: 4px; justify-items: start; border-bottom: 1px solid var(--line); }
.activity li:last-child { border-bottom: 0; }
.activity small { color: var(--muted); }
@media (max-width: 1180px) { .grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) { .scope { min-width: 0; flex: 1 1 100%; } }
</style>
