<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import AppSidebar from '@/app/layout/AppSidebar.vue'
import AppTopbar from '@/app/layout/AppTopbar.vue'
import FeedbackHost from '@/app/layout/FeedbackHost.vue'
import { useConfig, useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { useIdleTimer } from '@/shared/composables/idle'

const route = useRoute()
const router = useRouter()
const store = useSessionStore()
const config = useConfig()
const services = useServices()
const queryClient = useQueryClient()
const menuOpen = ref(false)
const shell = computed(() => store.signedIn && !route.meta.public)

watch(() => route.fullPath, () => { menuOpen.value = false })

// Una sesión olvidada abierta en una computadora compartida es un riesgo: se cierra sola.
useIdleTimer(() => config.idleMinutes, () => store.signedIn, async () => {
  await store.signOut('idle')
  queryClient.clear()
  await router.push({ name: 'login' })
})
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <div v-if="shell" class="shell">
    <AppSidebar :open="menuOpen" @close="menuOpen = false" />
    <div v-if="menuOpen" class="scrim" aria-hidden="true" @click="menuOpen = false" />
    <div class="main-area">
      <AppTopbar @menu="menuOpen = true" />
      <p v-if="services.mode === 'mock'" class="demo-bar" role="note">Ambiente de demostración: datos simulados que solo existen en este navegador.</p>
      <main id="contenido" class="page" tabindex="-1">
        <RouterView />
      </main>
      <footer class="footer">
        <span>Proyecto académico, sin relación comercial con Cinépolis.</span>
        <span>Versión {{ config.environmentName }} · {{ services.mode === 'mock' ? 'simulación' : 'API' }}</span>
      </footer>
    </div>
  </div>
  <main v-else id="contenido" tabindex="-1">
    <RouterView />
  </main>
  <FeedbackHost />
</template>

<style scoped>
.shell { min-height: 100dvh; }
.main-area { min-height: 100dvh; margin-left: var(--sidebar-width); display: flex; flex-direction: column; }
.page { flex: 1; width: 100%; max-width: var(--page-max); margin-inline: auto; padding: 24px var(--page-gutter) 48px; outline: none; }
.demo-bar { padding: 6px var(--page-gutter); background: var(--warning-soft); color: var(--warning); font-size: var(--text-s); font-weight: 600; }
.footer { padding: 14px var(--page-gutter); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: var(--text-xs); }
.scrim { display: none; }
@media (max-width: 1080px) {
  .main-area { margin-left: 0; }
  .scrim { position: fixed; inset: 0; z-index: 55; display: block; background: var(--backdrop); }
}
</style>
