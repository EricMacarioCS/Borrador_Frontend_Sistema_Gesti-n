import { computed, ref } from 'vue'
import { useDailySales } from '@/app/queries'
import { useSessionStore } from '@/app/stores/session'
import { buildReport, fetchRange, type PeriodId } from './report'

/** Filtros compartidos por el panel principal y Reportes: se conservan al cambiar de módulo. */
const complexId = ref<string | null>(null)
const period = ref<PeriodId>('week')

export function useReport() {
  const store = useSessionStore()
  const range = computed(() => fetchRange(period.value, store.today()))
  const sales = useDailySales(range)
  // Si el usuario solo ve algunos complejos, un filtro viejo fuera de su alcance se ignora.
  const scopeId = computed(() => complexId.value && store.complexes.some(c => c.id === complexId.value) ? complexId.value : null)
  const report = computed(() => buildReport(sales.data.value ?? [], store.complexes, scopeId.value, period.value, store.today()))
  return { complexId, period, sales, report }
}
