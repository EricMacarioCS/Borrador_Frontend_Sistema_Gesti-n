<script setup lang="ts">
/** Estados de una consulta: cargando, error recuperable o vacío. */
import { computed, type Component } from 'vue'
import { CircleAlert, Inbox, Plus, RefreshCw } from '@lucide/vue'
import { toApiError } from '@/shared/lib/errors'
import { errorMessage, supportReference } from '@/shared/lib/messages'

const props = defineProps<{
  loading?: boolean
  error?: unknown
  empty?: boolean
  emptyTitle?: string
  emptyText?: string
  skeleton?: 'cards' | 'rows' | 'block'
  emptyIcon?: Component
  /** Acción sugerida cuando no hay datos; sin texto no se muestra el botón. */
  actionLabel?: string
}>()
const emit = defineEmits<{ retry: []; action: [] }>()

const apiError = computed(() => props.error ? toApiError(props.error) : null)
</script>

<template>
  <div class="state-view">
  <div v-if="loading" class="state" aria-busy="true">
    <span class="visually-hidden" role="status">Cargando…</span>
    <div v-if="skeleton === 'cards'" class="skeleton-grid">
      <div v-for="n in 8" :key="n" class="skeleton card-skeleton" />
    </div>
    <div v-else-if="skeleton === 'rows'" class="skeleton-rows">
      <div v-for="n in 5" :key="n" class="skeleton row-skeleton" />
    </div>
    <div v-else class="skeleton block-skeleton" />
  </div>
  <div v-else-if="apiError" class="state message" role="alert">
    <CircleAlert :size="34" aria-hidden="true" />
    <h2>No pudimos cargar esta información</h2>
    <p>{{ errorMessage(apiError) }}</p>
    <small v-if="supportReference(apiError)">Referencia: {{ supportReference(apiError) }}</small>
    <button type="button" class="btn btn-secondary" @click="emit('retry')"><RefreshCw :size="16" /> Reintentar</button>
  </div>
  <div v-else-if="empty" class="state message">
    <component :is="emptyIcon ?? Inbox" :size="34" aria-hidden="true" />
    <h2>{{ emptyTitle ?? 'Sin resultados' }}</h2>
    <p v-if="emptyText">{{ emptyText }}</p>
    <button v-if="actionLabel" type="button" class="btn btn-primary" @click="emit('action')"><Plus :size="16" aria-hidden="true" /> {{ actionLabel }}</button>
    <slot name="empty-actions" />
  </div>
  <slot v-else />
  </div>
</template>

<style scoped>
.message {
  padding: 48px 20px;
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-l);
  background: var(--surface-veil);
}
.message svg { color: var(--blue); }
.message h2 { font: 800 var(--text-l) var(--font-title); }
/* Dentro de un panel o ventana no se dibuja un segundo marco. */
:global(.panel .state-view .state.message) { padding: 32px 20px; border: 0; background: transparent; }
.message p { color: var(--muted); max-width: 52ch; }
.message small { color: var(--muted); }
.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
.card-skeleton { aspect-ratio: 2 / 3.4; }
.skeleton-rows { display: grid; gap: 12px; }
.row-skeleton { height: 96px; }
.block-skeleton { height: 320px; }
</style>
