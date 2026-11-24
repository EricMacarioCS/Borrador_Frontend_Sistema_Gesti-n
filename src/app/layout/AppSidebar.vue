<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { NAV_GROUPS, NAV_ITEMS } from '@/app/navigation'
import { useSessionStore } from '@/app/stores/session'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()

const groups = computed(() => NAV_GROUPS
  .map(group => ({ group, items: NAV_ITEMS.filter(item => item.group === group && store.can(item.permission)) }))
  .filter(entry => entry.items.length))
</script>

<template>
  <aside class="sidebar" :class="{ open }" aria-label="Menú principal">
    <div class="brand">
      <RouterLink to="/" class="brand-link">
        <span class="mark" aria-hidden="true">c</span>
        <span class="copy"><strong>cinépolis</strong><small>Administración</small></span>
      </RouterLink>
      <button type="button" class="icon-btn close" aria-label="Cerrar menú" @click="emit('close')"><X :size="18" /></button>
    </div>
    <nav class="nav">
      <template v-for="entry in groups" :key="entry.group">
        <p class="group">{{ entry.group }}</p>
        <RouterLink v-for="item in entry.items" :key="item.name" :to="item.path" class="link"
          :class="{ active: $route.name === item.name || ($route.name === 'schedule' && item.name === 'screenings') }">
          <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar { position: fixed; inset: 0 auto 0 0; z-index: 60; width: var(--sidebar-width); padding: 0 14px; display: flex; flex-direction: column; background: var(--navy-950); color: #fff; }
.brand { height: var(--topbar-height); display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, .09); }
.brand-link { display: flex; align-items: center; gap: 12px; padding: 0 6px; color: #fff; text-decoration: none; }
.mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--blue); font: italic 800 26px/1 var(--font-title); }
.copy { display: grid; }
.copy strong { font: 700 20px var(--font-title); }
.copy small { color: var(--muted-on-dark); font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.close { display: none; margin-left: auto; color: #fff; }
.close:hover { background: rgba(255, 255, 255, .1); color: #fff; }
.nav { flex: 1; overflow-y: auto; padding: 8px 0 20px; scrollbar-width: thin; }
.group { margin: 18px 10px 6px; color: var(--muted-on-dark); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.link { min-height: 40px; margin: 2px 0; padding: 0 12px; display: flex; align-items: center; gap: 12px; border-radius: var(--radius-s); color: var(--muted-on-dark); font-size: 14px; text-decoration: none; }
.link:hover { background: rgba(255, 255, 255, .07); color: #fff; }
.link.active { background: var(--blue); color: #fff; }
@media (max-width: 1080px) {
  .sidebar { transform: translateX(-100%); visibility: hidden; }
  .sidebar.open { transform: none; visibility: visible; }
  .close { display: inline-grid; }
}
</style>
