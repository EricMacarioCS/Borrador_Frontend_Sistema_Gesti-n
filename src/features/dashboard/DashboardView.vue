<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Building2, CalendarPlus, DollarSign, Download, ShoppingBag, Ticket } from '@lucide/vue'
import { useActivity } from '@/app/queries'
import { useSessionStore } from '@/app/stores/session'
import ChangeBadge from '@/features/reports/ChangeBadge.vue'
import ReportFilters from '@/features/reports/ReportFilters.vue'
import RevenueChart from '@/features/reports/RevenueChart.vue'
import { downloadCsv, summaryRows } from '@/features/reports/report'
import { useReport } from '@/features/reports/useReport'
import StateView from '@/shared/ui/StateView.vue'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'

const store = useSessionStore()
const { complexId, period, sales, report } = useReport()
const activity = useActivity(8)
const count = (n: number) => n.toLocaleString('es-MX')

const donut = computed(() => {
  let from = 0
  const stops = report.value.mix.map(({ id, percent }) => {
    const to = from + percent
    const stop = `var(--series-${id}) ${from}% ${Math.max(from, to - 0.4)}%, #fff ${Math.max(from, to - 0.4)}% ${to}%`
    from = to
    return stop
  })
  return stops.length && report.value.totals.total ? `conic-gradient(${stops.join(', ')})` : 'var(--line)'
})

function exportSummary() {
  downloadCsv(`resumen-${report.value.range.start}-${report.value.range.end}.csv`, summaryRows(report.value))
}
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Panel principal</h1>
        <p>Rendimiento de {{ store.session.complexIds === null ? 'la cadena' : 'tus complejos' }} y actividad reciente del sistema.</p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-secondary" :disabled="!sales.data.value" @click="exportSummary"><Download :size="16" /> Exportar resumen</button>
        <RouterLink v-if="store.can('screenings.manage')" to="/funciones/programar" class="btn btn-primary"><CalendarPlus :size="16" /> Programar funciones</RouterLink>
      </div>
    </div>

    <ReportFilters v-model:complex-id="complexId" v-model:period="period" :report="report" />
    <p class="notice small demo">Las ventas de este ambiente son ficticias y no salen de los pedidos registrados.</p>

    <StateView :loading="sales.isPending.value" :error="sales.error.value" skeleton="block" @retry="sales.refetch()">
      <div class="metric-grid">
        <article class="panel metric">
          <div class="metric-top"><span>Ingresos totales</span><span class="metric-icon"><DollarSign :size="17" /></span></div>
          <strong>{{ formatMoney(report.totals.total) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.total" :previous="report.previous.total" /><span>{{ report.comparisonLabel }}</span></div>
        </article>
        <article class="panel metric">
          <div class="metric-top"><span>Boletos vendidos</span><span class="metric-icon"><Ticket :size="17" /></span></div>
          <strong>{{ count(report.totals.ticketCount) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.ticketCount" :previous="report.previous.ticketCount" /><span>{{ report.comparisonLabel }}</span></div>
        </article>
        <article class="panel metric">
          <div class="metric-top"><span>Ventas de alimentos</span><span class="metric-icon"><ShoppingBag :size="17" /></span></div>
          <strong>{{ formatMoney(report.totals.food) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.food" :previous="report.previous.food" /><span>{{ report.comparisonLabel }}</span></div>
        </article>
        <article class="panel metric">
          <div class="metric-top"><span>Complejos</span><span class="metric-icon"><Building2 :size="17" /></span></div>
          <strong>{{ store.complexes.length }}</strong>
          <div class="foot"><span>{{ store.complexes.reduce((sum, c) => sum + c.roomCount, 0) }} salas · {{ count(store.complexes.reduce((sum, c) => sum + c.seatCount, 0)) }} asientos</span></div>
        </article>
      </div>

      <div class="grid">
        <article class="panel">
          <div class="panel-head"><div><h2>Ingresos por tipo de venta</h2><p>{{ report.scopeLabel }} · {{ report.periodLabel }}, {{ report.period === 'year' ? 'por mes' : 'por día' }}</p></div></div>
          <div class="panel-pad"><RevenueChart :points="report.points" /></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><h2>Distribución de ventas</h2><p>Participación por tipo</p></div></div>
          <div class="panel-pad mix">
            <div class="donut" :style="{ background: donut }" aria-hidden="true"><span><strong>{{ formatMoney(report.totals.total) }}</strong>total</span></div>
            <ul role="list">
              <li v-for="item in report.mix" :key="item.id">
                <span><i :class="item.id" aria-hidden="true" /> {{ item.label }}</span>
                <strong>{{ item.percent.toFixed(1) }} %</strong>
                <small>{{ formatMoney(item.amount) }}</small>
              </li>
            </ul>
          </div>
        </article>
      </div>

      <div class="grid bottom">
        <article class="panel">
          <div class="panel-head">
            <div><h2>Rendimiento por complejo</h2><p>{{ report.periodLabel }}, {{ report.comparisonLabel }}</p></div>
            <RouterLink v-if="store.can('reports.view')" to="/reportes" class="action">Ver reportes <ArrowUpRight :size="14" /></RouterLink>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Complejo</th><th>Ciudad</th><th class="num">Ingresos</th><th>Variación</th></tr></thead>
              <tbody>
                <tr v-for="row in report.byComplex" :key="row.complex.id">
                  <td><strong>{{ row.complex.name }}</strong></td>
                  <td>{{ row.complex.cityName }}</td>
                  <td class="num">{{ formatMoney(row.totals.total) }}</td>
                  <td><ChangeBadge :current="row.totals.total" :previous="row.previous.total" /></td>
                </tr>
              </tbody>
            </table>
          </div>
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
    </StateView>
  </section>
</template>

<style scoped>
.demo { margin-bottom: 16px; }
.foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.grid { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 16px; }
.bottom { grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr); }
.mix { display: grid; justify-items: center; gap: 18px; }
.donut { width: 170px; height: 170px; display: grid; place-items: center; border-radius: 50%; }
.donut span { width: 112px; height: 112px; display: grid; place-content: center; border-radius: 50%; background: var(--surface); color: var(--muted); font-size: 12px; text-align: center; }
.donut strong { color: var(--ink); font-size: 15px; }
.mix ul { width: 100%; display: grid; gap: 10px; }
.mix li { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; }
.mix li span { display: inline-flex; align-items: center; gap: 8px; }
.mix li small { grid-column: 1; color: var(--muted); }
.mix i { width: 10px; height: 10px; border-radius: 3px; }
i.tickets { background: var(--series-tickets); }
i.food { background: var(--series-food); }
i.other { background: var(--series-other); }
.activity { padding: 6px 20px 16px; display: grid; }
.activity li { padding: 12px 0; display: grid; gap: 4px; justify-items: start; border-bottom: 1px solid var(--line); }
.activity li:last-child { border-bottom: 0; }
.activity small { color: var(--muted); }
@media (max-width: 1180px) { .grid, .bottom { grid-template-columns: minmax(0, 1fr); } }
</style>
