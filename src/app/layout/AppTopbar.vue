<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { LogOut, Menu } from '@lucide/vue'
import { useSessionStore } from '@/app/stores/session'

const emit = defineEmits<{ menu: [] }>()
const route = useRoute()
const router = useRouter()
const store = useSessionStore()
const queryClient = useQueryClient()

const initials = computed(() => (store.session.user?.name ?? '').split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase())
const scope = computed(() => store.session.complexIds === null
  ? 'Toda la cadena'
  : store.complexes.length === 1 ? store.complexes[0]!.name : `${store.complexes.length} complejos`)

async function signOut() {
  await store.signOut()
  queryClient.clear()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <button type="button" class="icon-btn menu" aria-label="Abrir menú" @click="emit('menu')"><Menu :size="20" /></button>
    <p class="crumb">Administración <span aria-hidden="true">/</span> <strong>{{ route.meta.title }}</strong></p>
    <div class="right">
      <span class="scope"><span class="dot" aria-hidden="true" /> {{ scope }}</span>
      <div class="user">
        <span class="avatar" aria-hidden="true">{{ initials }}</span>
        <span class="who"><strong>{{ store.session.user?.name }}</strong><small>{{ store.session.user?.roleName }}</small></span>
      </div>
      <button type="button" class="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" @click="signOut"><LogOut :size="18" /></button>
    </div>
  </header>
</template>

<style scoped>
.topbar { position: sticky; top: 0; z-index: 40; height: var(--topbar-height); padding: 0 var(--page-gutter); display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); background: var(--surface); }
.menu { display: none; }
.crumb { color: var(--muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.crumb span { margin: 0 6px; color: var(--line-strong); }
.crumb strong { color: var(--ink); }
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.scope { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; background: var(--surface-soft); color: var(--muted); font-size: 13px; font-weight: 600; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #22a06b; }
.user { display: flex; align-items: center; gap: 10px; }
.avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: var(--navy-950); font-size: 13px; font-weight: 700; }
.who { display: grid; line-height: 1.25; }
.who strong { font-size: 14px; }
.who small { color: var(--muted); font-size: 12px; }
@media (max-width: 1080px) { .menu { display: inline-grid; } }
@media (max-width: 720px) {
  .scope, .who { display: none; }
  .crumb span, .crumb { font-size: 13px; }
}
</style>
