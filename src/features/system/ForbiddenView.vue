<script setup lang="ts">
import { computed } from 'vue'
import { ShieldAlert } from '@lucide/vue'
import { firstAllowed } from '@/app/navigation'
import { useSessionStore } from '@/app/stores/session'

const store = useSessionStore()
const home = computed(() => firstAllowed(store.can))
</script>

<template>
  <div class="panel empty">
    <ShieldAlert :size="36" aria-hidden="true" />
    <h1>No tienes acceso a este módulo</h1>
    <p>Si lo necesitas, pídelo al administrador general.</p>
    <RouterLink v-if="home" :to="home.path" class="btn btn-primary">Ir a {{ home.label }}</RouterLink>
  </div>
</template>

<style scoped>
h1 { font: 700 var(--text-xl) var(--font-title); color: var(--ink); }
svg { color: var(--blue); }
</style>
