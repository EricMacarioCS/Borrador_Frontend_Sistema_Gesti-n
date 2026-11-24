<script setup lang="ts">
import { useId } from 'vue'
import { useSessionStore } from '@/app/stores/session'
import { formatRange, PERIODS, type PeriodId, type Report } from './report'

defineProps<{ report: Report }>()
const complexId = defineModel<string | null>('complexId', { required: true })
const period = defineModel<PeriodId>('period', { required: true })
const store = useSessionStore()
const id = useId()
</script>

<template>
  <div class="panel filters">
    <div class="field">
      <label :for="`${id}-period`">Periodo</label>
      <select :id="`${id}-period`" v-model="period" class="select">
        <option v-for="option in PERIODS" :key="option.id" :value="option.id">{{ option.label }}</option>
      </select>
    </div>
    <div class="field">
      <label :for="`${id}-complex`">Complejo</label>
      <select :id="`${id}-complex`" v-model="complexId" class="select">
        <option :value="null">{{ store.session.complexIds === null ? 'Todos los complejos' : 'Todos mis complejos' }}</option>
        <option v-for="complex in store.complexes" :key="complex.id" :value="complex.id">{{ complex.name }}</option>
      </select>
    </div>
    <p class="dates" aria-live="polite">
      <strong>{{ formatRange(report.range) }}</strong>
      <span>Comparado con {{ formatRange(report.previousRange) }}</span>
    </p>
  </div>
</template>

<style scoped>
.filters { margin-bottom: 16px; padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 18px; }
.filters .field { min-width: 200px; }
.dates { margin-left: auto; display: grid; text-align: right; font-size: 14px; }
.dates span { color: var(--muted); font-size: 13px; }
@media (max-width: 720px) { .dates { margin-left: 0; text-align: left; } }
</style>
