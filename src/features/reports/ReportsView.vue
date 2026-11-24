<script setup lang="ts">
import { DollarSign, Download, ShoppingBag, Ticket, TrendingUp } from '@lucide/vue'
import ChangeBadge from './ChangeBadge.vue'
import ReportFilters from './ReportFilters.vue'
import RevenueChart from './RevenueChart.vue'
import { detailRows, downloadCsv } from './report'
import { useReport } from './useReport'
import StateView from '@/shared/ui/StateView.vue'
import { formatMoney } from '@/shared/lib/money'

const { complexId, period, sales, report } = useReport()
const count = (n: number) => n.toLocaleString('es-MX')

function exportDetail() {
  downloadCsv(`ingresos-por-complejo-${report.value.range.start}-${report.value.range.end}.csv`, detailRows(report.value))
}
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Reportes e ingresos</h1>
        <p>Desempeño comercial por periodo y complejo, comparado con el periodo anterior.</p>
      </div>
      <button type="button" class="btn btn-secondary" :disabled="!sales.data.value" @click="exportDetail"><Download :size="16" /> Exportar CSV</button>
    </div>

    <ReportFilters v-model:complex-id="complexId" v-model:period="period" :report="report" />

    <StateView :loading="sales.isPending.value" :error="sales.error.value" skeleton="block" @retry="sales.refetch()">
      <div class="metric-grid">
        <article class="panel metric">
          <div class="metric-top"><span>Ingresos totales</span><span class="metric-icon"><DollarSign :size="17" /></span></div>
          <strong>{{ formatMoney(report.totals.total) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.total" :previous="report.previous.total" /><span>Anterior: {{ formatMoney(report.previous.total) }}</span></div>
        </article>
        <article class="panel metric">
          <div class="metric-top"><span>Boletos vendidos</span><span class="metric-icon"><Ticket :size="17" /></span></div>
          <strong>{{ count(report.totals.ticketCount) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.ticketCount" :previous="report.previous.ticketCount" /><span>Anterior: {{ count(report.previous.ticketCount) }}</span></div>
        </article>
        <article class="panel metric">
          <div class="metric-top"><span>Alimentos</span><span class="metric-icon"><ShoppingBag :size="17" /></span></div>
          <strong>{{ formatMoney(report.totals.food) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.food" :previous="report.previous.food" /><span>Anterior: {{ formatMoney(report.previous.food) }}</span></div>
        </article>
        <article class="panel metric">
          <div class="metric-top"><span>Ticket promedio</span><span class="metric-icon"><TrendingUp :size="17" /></span></div>
          <strong>{{ formatMoney(report.totals.average) }}</strong>
          <div class="foot"><ChangeBadge :current="report.totals.average" :previous="report.previous.average" /><span>{{ count(report.totals.transactions) }} transacciones</span></div>
        </article>
      </div>

      <article class="panel section">
        <div class="panel-head"><div><h2>Ingresos por tipo de venta</h2><p>{{ report.scopeLabel }} · {{ report.periodLabel }}</p></div></div>
        <div class="panel-pad"><RevenueChart :points="report.points" /></div>
      </article>

      <article class="panel section">
        <div class="panel-head"><div><h2>Ingresos por complejo</h2><p>{{ report.periodLabel }}, {{ report.comparisonLabel }}. Participación respecto a todos tus complejos.</p></div></div>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>Complejo</th><th class="num">Boletos</th><th class="num">Ingreso boletos</th><th class="num">Alimentos</th><th class="num">Otros</th><th class="num">Total</th><th class="num">Anterior</th><th>Variación</th><th>Participación</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in report.byComplex" :key="row.complex.id">
                <td><strong>{{ row.complex.name }}</strong></td>
                <td class="num">{{ count(row.totals.ticketCount) }}</td>
                <td class="num">{{ formatMoney(row.totals.tickets) }}</td>
                <td class="num">{{ formatMoney(row.totals.food) }}</td>
                <td class="num">{{ formatMoney(row.totals.other) }}</td>
                <td class="num"><strong>{{ formatMoney(row.totals.total) }}</strong></td>
                <td class="num">{{ formatMoney(row.previous.total) }}</td>
                <td><ChangeBadge :current="row.totals.total" :previous="row.previous.total" /></td>
                <td><span class="share"><span class="bar"><span :style="{ width: `${row.share}%` }" /></span>{{ row.share.toFixed(1) }} %</span></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">{{ count(report.totals.ticketCount) }}</td>
                <td class="num">{{ formatMoney(report.totals.tickets) }}</td>
                <td class="num">{{ formatMoney(report.totals.food) }}</td>
                <td class="num">{{ formatMoney(report.totals.other) }}</td>
                <td class="num">{{ formatMoney(report.totals.total) }}</td>
                <td class="num">{{ formatMoney(report.previous.total) }}</td>
                <td><ChangeBadge :current="report.totals.total" :previous="report.previous.total" /></td>
                <td>{{ report.share.toFixed(1) }} %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
    </StateView>
  </section>
</template>

<style scoped>
.foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.section { margin-top: 16px; }
.share { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.bar { width: 80px; height: 6px; overflow: hidden; border-radius: 3px; background: var(--line); }
.bar span { display: block; height: 100%; background: var(--blue); }
</style>
