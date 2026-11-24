<script setup lang="ts">
import { computed } from 'vue'
import { TrendingDown, TrendingUp } from '@lucide/vue'
import { percentChange } from './report'

const props = defineProps<{ current: number; previous: number }>()
const change = computed(() => percentChange(props.current, props.previous))
</script>

<template>
  <span v-if="change === null" class="pill muted">Sin comparación</span>
  <span v-else class="pill" :class="change >= 0 ? 'success' : 'danger'" :aria-label="`${change >= 0 ? 'Aumento' : 'Disminución'} de ${Math.abs(change)} %`">
    <TrendingUp v-if="change >= 0" :size="13" aria-hidden="true" /><TrendingDown v-else :size="13" aria-hidden="true" />
    {{ change >= 0 ? '+' : '' }}{{ change.toFixed(1) }} %
  </span>
</template>
