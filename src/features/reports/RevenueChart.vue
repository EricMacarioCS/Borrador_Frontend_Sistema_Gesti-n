<script setup lang="ts">
/** Barras apiladas por tipo de venta. Cada barra es un botón con su descripción completa para lectores de pantalla. */
import { computed, ref } from 'vue'
import { formatMoney } from '@/shared/lib/money'
import { CATEGORIES, type ChartPoint } from './report'

const props = defineProps<{ points: ChartPoint[] }>()
const activeKey = ref<string | null>(null)
const activeIndex = computed(() => props.points.findIndex(point => point.key === activeKey.value))
const active = computed(() => props.points[activeIndex.value])

// Escala de cuatro intervalos con números redondos.
const step = computed(() => {
  const raw = Math.max(100, ...props.points.map(point => point.totals.total)) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(n => n * magnitude >= raw)! * magnitude
})

function axis(cents: number) {
  const pesos = cents / 100
  if (pesos >= 1e6) return `$${Number((pesos / 1e6).toFixed(2))}M`
  if (pesos >= 1e3) return `$${Number((pesos / 1e3).toFixed(1))}k`
  return `$${Math.round(pesos)}`
}
const describe = ({ title, totals }: ChartPoint) =>
  `${title}: total ${formatMoney(totals.total)}, ${CATEGORIES.map(c => `${c.label} ${formatMoney(totals[c.id])}`).join(', ')}`
</script>

<template>
  <div class="legend">
    <span v-for="category in CATEGORIES" :key="category.id"><i :class="category.id" aria-hidden="true" /> {{ category.label }}</span>
  </div>
  <div class="chart">
    <div class="y" aria-hidden="true"><span v-for="n in [4, 3, 2, 1, 0]" :key="n">{{ axis(n * step) }}</span></div>
    <div class="plot" @mouseleave="activeKey = null">
      <div class="grid" aria-hidden="true"><i v-for="n in 5" :key="n" /></div>
      <div class="bars">
        <button v-for="point in points" :key="point.key" type="button" class="bar" :class="{ on: point.key === activeKey }" :aria-label="describe(point)"
          @mouseenter="activeKey = point.key" @focus="activeKey = point.key" @blur="activeKey = null">
          <span class="track">
            <span class="stack" :style="{ height: `${point.totals.total / (step * 4) * 100}%` }">
              <i v-for="category in CATEGORIES" :key="category.id" :class="category.id" :style="{ flexGrow: point.totals[category.id] }" />
            </span>
          </span>
          <span class="label">{{ point.label }}</span>
        </button>
      </div>
      <div v-if="active" class="tip" :class="{ right: activeIndex < points.length / 2 }" aria-hidden="true">
        <span>{{ active.title }}</span>
        <strong>{{ formatMoney(active.totals.total) }}</strong>
        <span v-for="category in CATEGORIES" :key="category.id"><i :class="category.id" /> {{ category.label }}: {{ formatMoney(active.totals[category.id]) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 12px; color: var(--muted); font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
i.tickets { background: var(--series-tickets); }
i.food { background: var(--series-food); }
i.other { background: var(--series-other); }
.legend i, .tip i { width: 10px; height: 10px; display: inline-block; border-radius: 3px; }
.chart { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 8px; height: 280px; }
.y { padding-bottom: 24px; display: flex; flex-direction: column; justify-content: space-between; color: var(--muted); font-size: 11px; text-align: right; }
.plot { position: relative; }
.grid { position: absolute; inset: 0 0 24px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
.grid i { border-top: 1px dashed var(--line); }
.bars { position: absolute; inset: 0; display: flex; gap: 4px; }
.bar { flex: 1; min-width: 0; padding: 0; display: flex; flex-direction: column; border: 0; border-radius: 6px; background: transparent; }
.bar:hover .stack, .bar.on .stack { opacity: .85; }
.track { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
.stack { width: min(100%, 34px); display: flex; flex-direction: column-reverse; overflow: hidden; border-radius: 4px 4px 0 0; }
.stack i { display: block; min-height: 0; }
.label { height: 24px; padding-top: 6px; overflow: hidden; color: var(--muted); font-size: 11px; white-space: nowrap; }
.tip { position: absolute; top: 0; left: 8px; z-index: 2; min-width: 200px; padding: 10px 12px; display: grid; gap: 3px; border-radius: var(--radius-s); background: var(--navy-950); color: #fff; font-size: 12px; box-shadow: var(--shadow-float); }
.tip.right { left: auto; right: 8px; }
.tip strong { font-size: 16px; }
.tip span { display: flex; align-items: center; gap: 6px; }
</style>
