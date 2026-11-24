<script setup lang="ts">
import { computed } from 'vue'
import { ConfigError } from './config'
import { toApiError } from '@/shared/lib/errors'
import { supportReference } from '@/shared/lib/messages'

const props = defineProps<{ error: unknown }>()
const apiError = computed(() => toApiError(props.error))
const message = computed(() => {
  if (props.error instanceof ConfigError) return 'La configuración de este ambiente no es válida. Avisa al equipo de infraestructura.'
  return apiError.value.code === 'NETWORK' || apiError.value.code === 'TIMEOUT'
    ? 'Revisa tu conexión e intenta de nuevo.'
    : 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.'
})
const reference = computed(() => supportReference(apiError.value))
const reload = () => window.location.reload()
</script>

<template>
  <main class="boot-error">
    <div class="panel card">
      <p class="eyebrow">Administración Cinépolis</p>
      <h1>No pudimos abrir el sistema</h1>
      <p>{{ message }}</p>
      <small v-if="reference">Referencia: {{ reference }}</small>
      <button type="button" class="btn btn-primary" @click="reload">Intentar de nuevo</button>
    </div>
  </main>
</template>

<style scoped>
.boot-error { min-height: 100dvh; display: grid; place-items: center; padding: 20px; background: var(--navy-950); }
.card { max-width: 460px; padding: 32px; display: grid; gap: 12px; text-align: center; justify-items: center; }
h1 { font: 800 24px var(--font-title); }
p, small { color: var(--muted); }
</style>
