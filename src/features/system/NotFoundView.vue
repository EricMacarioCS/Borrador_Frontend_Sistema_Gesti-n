<script setup lang="ts">
import { SearchX } from '@lucide/vue'
import { useSessionStore } from '@/app/stores/session'

const store = useSessionStore()
</script>

<template>
  <div class="wrap" :class="{ alone: !store.signedIn }">
    <div class="panel empty">
      <SearchX :size="36" aria-hidden="true" />
      <h1>Esta página no existe</h1>
      <p>Revisa la dirección o vuelve al inicio.</p>
      <RouterLink to="/" class="btn btn-primary">Ir al inicio</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.alone { min-height: 100dvh; padding: 24px; display: grid; place-items: center; }
.alone .panel { width: min(100%, 480px); }
h1 { font: 700 20px var(--font-title); color: var(--ink); }
svg { color: var(--blue); }
</style>
