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
import { addDays, dayParts, formatDate, formatDateTime } from '@/shared/lib/datetime'
import { vTableRoles } from '@/shared/ui/tableRoles'

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
const scopeLabel = computed(() => complexId.value ? store.complexName(complexId.value) : store.session.complexIds === null ? 'Toda la cadena' : 'Tus complejos')

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

/* Color de la etiqueta según el área de la bitácora; las no listadas quedan neutras. */
const AREA_TONES: Record<string, string> = {
  'Películas': 'info', 'Funciones': 'success', 'Dulcería': 'warning', 'Contenido': 'violet',
  'Tarifas': 'danger', 'Promociones': 'danger', 'Club': 'danger', 'Empleados': 'neutral', 'Complejos': 'neutral'
}
const areaTone = (area: string) => AREA_TONES[area] ?? 'neutral'
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Panel principal</h1>
        <p>Operación de {{ store.session.complexIds === null ? 'la cadena' : 'tus complejos' }}: funciones de hoy, cartelera y pendientes.</p>
      </div>
      <div class="page-actions">
        <div v-if="store.complexes.length > 1" class="field scope">
          <label for="d-complejo" class="visually-hidden">Complejo</label>
          <select id="d-complejo" v-model="complexId" class="select">
            <option value="">{{ store.session.complexIds === null ? 'Toda la cadena' : 'Todos mis complejos' }}</option>
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
        <div class="metric-top"><span>Películas en cartelera</span><span class="metric-icon success"><Clapperboard :size="17" /></span></div>
        <strong>{{ movies.isPending.value ? '—' : count(showing.length) }}</strong>
        <span class="foot">{{ showing.filter(m => stageOf(m) === 'premiere').length }} en periodo de estreno</span>
      </article>
      <article class="panel metric" :class="{ highlight: releases.length }">
        <div class="metric-top"><span>Estrenos y preventas</span><span class="metric-icon warning"><Sparkles :size="17" /></span></div>
        <strong>{{ movies.isPending.value ? '—' : count(releases.length) }}</strong>
        <span class="foot">Estrenan esta semana o ya están en preventa</span>
      </article>
      <article class="panel metric">
        <div class="metric-top"><span>Complejos</span><span class="metric-icon violet"><Building2 :size="17" /></span></div>
        <strong>{{ scopeComplexes.length }}</strong>
        <span class="foot">{{ scopeComplexes.reduce((sum, c) => sum + c.roomCount, 0) }} salas · {{ count(scopeComplexes.reduce((sum, c) => sum + c.seatCount, 0)) }} asientos</span>
      </article>
    </div>

    <!-- Primera fila: lo de hoy y lo que necesita una decisión. -->
    <div class="grid">
      <article class="panel">
        <div class="panel-head">
          <div><h2>Próximas funciones de hoy</h2><p>{{ scopeLabel }} · {{ formatDate(today) }}</p></div>
          <RouterLink to="/funciones" class="btn btn-text btn-small">Ver programación <ArrowUpRight :size="14" /></RouterLink>
        </div>
        <StateView :loading="week.isPending.value" :error="week.error.value" :empty="!nextUp.length" skeleton="rows"
          empty-title="No quedan funciones hoy" empty-text="Las funciones de hoy ya empezaron o no hay programación." @retry="week.refetch()">
          <div class="table-wrap">
            <table v-table-roles class="data cards">
              <thead><tr><th>Hora</th><th>Película</th><th>Complejo</th><th>Sala</th><th>Proyección</th></tr></thead>
              <tbody>
                <tr v-for="s in nextUp" :key="s.id">
                  <td data-label="Hora" class="time">{{ s.startTime }}</td>
                  <td><span class="stack"><strong>{{ s.movieTitle }}</strong><small>{{ s.language.name }}</small></span></td>
                  <td data-label="Complejo">{{ store.complexName(s.complexId) }}</td>
                  <td data-label="Sala">Sala {{ s.roomNumber }} · {{ s.roomType.name }}</td>
                  <td data-label="Proyección"><span class="tag">{{ s.projection.name }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </StateView>
      </article>

      <article class="panel attention" :class="{ alert: attentionCount }">
        <div class="panel-head">
          <div><h2>Requiere atención</h2><p>Cartelera de los próximos 7 días · {{ scopeLabel }}</p></div>
          <span v-if="attentionCount" class="pill warning">{{ attentionCount }}</span>
        </div>
        <StateView :loading="movies.isPending.value || week.isPending.value" :error="movies.error.value ?? week.error.value" :empty="!attentionCount" skeleton="rows"
          empty-title="Todo en orden" empty-text="Las películas en cartelera tienen funciones y ninguna termina esta semana." @retry="movies.refetch(); week.refetch()">
          <ul class="list" role="list">
            <li v-for="m in withoutScreenings" :key="`sin-${m.id}`">
              <span class="marker danger" aria-hidden="true" />
              <span class="stack"><strong>{{ m.title }}</strong><small>En cartelera sin funciones programadas</small></span>
              <RouterLink v-if="store.can('screenings.manage')" to="/funciones/programar" class="btn btn-text btn-small">Programar</RouterLink>
            </li>
            <li v-for="m in endingSoon" :key="`fin-${m.id}`">
              <span class="marker warning" aria-hidden="true" />
              <span class="stack"><strong>{{ m.title }}</strong><small>Último día: {{ formatDate(m.lastDay!, 'short') }}</small></span>
              <span class="pill warning">Termina pronto</span>
            </li>
          </ul>
        </StateView>
      </article>
    </div>

    <div class="grid secondary">
      <article class="panel">
        <div class="panel-head"><div><h2>Estrenos y preventas</h2><p>Estrenos de los próximos 7 días y preventas abiertas</p></div></div>
        <StateView :loading="movies.isPending.value" :error="movies.error.value" :empty="!releases.length" skeleton="rows"
          empty-title="Sin estrenos esta semana" @retry="movies.refetch()">
          <ul class="list" role="list">
            <li v-for="m in releases" :key="m.id">
              <span class="date-mark" :class="{ presale: stageOf(m) === 'presale' }" aria-hidden="true">
                <template v-if="m.releaseDate"><strong>{{ dayParts(m.releaseDate).day }}</strong><small>{{ dayParts(m.releaseDate).month }}</small></template>
                <strong v-else>—</strong>
              </span>
              <span class="stack"><strong>{{ m.title }}</strong><small>Estreno {{ m.releaseDate ? formatDate(m.releaseDate, 'short') : 'sin fecha' }}</small></span>
              <span class="pill" :class="stageOf(m) === 'presale' ? 'info' : 'muted'">{{ STAGE_LABELS[stageOf(m)] }}</span>
            </li>
          </ul>
        </StateView>
      </article>

      <article v-if="showProducts" class="panel">
        <div class="panel-head">
          <div><h2>Productos no disponibles</h2><p>Dulcería · {{ scopeLabel }}</p></div>
          <RouterLink to="/dulceria" class="btn btn-text btn-small">Ver dulcería <ArrowUpRight :size="14" /></RouterLink>
        </div>
        <StateView :loading="catalogsLoading" :empty="!unavailable.length" skeleton="rows"
          empty-title="Todo disponible" empty-text="Ningún producto está marcado como no disponible.">
          <ul class="list" role="list">
            <li v-for="item in unavailable" :key="item.key">
              <span class="marker danger" aria-hidden="true" />
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
              <span class="tag area" :class="areaTone(item.area)">{{ item.area }}</span>
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
.foot { color: var(--muted); font-size: var(--text-xs); }
.metric.highlight { border-color: var(--warning); box-shadow: inset 0 3px 0 var(--warning), var(--shadow-card); }
.metric.highlight strong { color: var(--warning); }
.grid { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }
.grid.secondary { grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); }
.attention.alert { border-color: var(--warning); box-shadow: inset 0 3px 0 var(--warning), var(--shadow-card); }
.attention.alert .panel-head { background: var(--warning-soft); border-radius: var(--radius-l) var(--radius-l) 0 0; }
.time { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.list { padding: 4px 20px 12px; display: grid; }
.list li { padding: 11px 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); }
.list li:last-child { border-bottom: 0; }
.list .stack { min-width: 0; flex: 1; }
.marker { align-self: stretch; width: 4px; flex: none; border-radius: 999px; }
.marker.danger { background: var(--danger); }
.marker.warning { background: var(--warning); }
.date-mark { width: 46px; flex: none; padding: 4px 0; display: grid; justify-items: center; border-radius: var(--radius-s); background: var(--info-soft); color: var(--info); line-height: 1.15; }
.date-mark.presale { background: var(--warning-soft); color: var(--warning); }
.date-mark strong { font: 800 var(--text-l)/1.15 var(--font-title); }
.date-mark small { font-size: var(--text-xs); font-weight: 600; }
.activity { padding: 6px 20px 16px; display: grid; }
.activity li { padding: 12px 0; display: grid; gap: 4px; justify-items: start; border-bottom: 1px solid var(--line); }
.activity li:last-child { border-bottom: 0; }
.activity small { color: var(--muted); }
.area { border-color: transparent; }
.area.info { background: var(--info-soft); color: var(--info); }
.area.success { background: var(--success-soft); color: var(--success); }
.area.warning { background: var(--warning-soft); color: var(--warning); }
.area.danger { background: var(--danger-soft); color: var(--danger); }
.area.violet { background: var(--violet-soft); color: var(--violet); }
.area.neutral { background: var(--neutral-soft); color: var(--ink-soft); }
@media (max-width: 1180px) { .grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) { .scope { min-width: 0; flex: 1 1 100%; } }
</style>
