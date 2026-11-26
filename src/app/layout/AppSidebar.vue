<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, X } from '@lucide/vue'
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from '@/app/navigation'
import { useSessionStore } from '@/app/stores/session'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const route = useRoute()

const groups = computed(() => NAV_GROUPS
  .map(group => ({ group, items: NAV_ITEMS.filter(item => item.group === group && store.can(item.permission)) }))
  .filter(entry => entry.items.length))

const isActive = (item: NavItem) => route.name === item.name || (route.name === 'schedule' && item.name === 'screenings')

/* Grupos colapsados. Solo se recuerdan durante la pestaña; si el almacenamiento falla, el menú funciona igual. */
const STORAGE_KEY = 'cp-admin-nav-groups'
function readCollapsed(): string[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}
const collapsed = ref(readCollapsed())
const holdsActive = (items: NavItem[]) => items.some(isActive)
// El grupo de la página actual siempre se ve abierto.
const isOpen = (group: string, items: NavItem[]) => holdsActive(items) || !collapsed.value.includes(group)

function toggle(group: string, items: NavItem[]) {
  if (holdsActive(items)) return
  collapsed.value = collapsed.value.includes(group) ? collapsed.value.filter(name => name !== group) : [...collapsed.value, group]
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed.value))
  } catch {
    // Sin almacenamiento solo se pierde el recuerdo del estado.
  }
}
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
      <div v-for="(entry, index) in groups" :key="entry.group" class="section">
        <button type="button" class="group" :aria-expanded="isOpen(entry.group, entry.items)" :aria-controls="`nav-grupo-${index}`"
          :aria-disabled="holdsActive(entry.items) ? 'true' : undefined" :title="holdsActive(entry.items) ? 'Contiene la página actual' : undefined"
          @click="toggle(entry.group, entry.items)">
          <span>{{ entry.group }}</span>
          <ChevronDown :size="14" aria-hidden="true" />
        </button>
        <div v-show="isOpen(entry.group, entry.items)" :id="`nav-grupo-${index}`">
          <RouterLink v-for="item in entry.items" :key="item.name" :to="item.path" class="link" :class="{ active: isActive(item) }">
            <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar { position: fixed; inset: 0 auto 0 0; z-index: 60; width: var(--sidebar-width); padding: 0 14px; display: flex; flex-direction: column; background: var(--navy-950); color: var(--on-dark); }
.brand { height: var(--topbar-height); flex: none; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--on-dark-line); }
.brand-link { display: flex; align-items: center; gap: 14px; padding: 4px 8px; color: var(--on-dark); text-decoration: none; }
.mark { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: var(--radius-s); background: var(--blue); font: italic 800 var(--text-2xl)/1 var(--font-title); }
.copy { display: grid; gap: 3px; }
.copy strong { font: 700 var(--text-xl)/1.1 var(--font-title); }
.copy small { color: var(--muted-on-dark); font-size: var(--text-xs); font-weight: 600; line-height: 1.1; letter-spacing: .12em; text-transform: uppercase; }
.close { display: none; margin-left: auto; color: var(--on-dark); }
.close:hover:not(:disabled) { background: var(--on-dark-active); color: var(--on-dark); }
.nav { flex: 1; overflow-y: auto; padding: 8px 0 20px; scrollbar-width: thin; }
.section { margin-top: 10px; }
.group { width: 100%; min-height: 32px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 0; border-radius: var(--radius-s); background: transparent; color: var(--muted-on-dark); font-size: var(--text-xs); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.group:hover { background: var(--on-dark-hover); color: var(--on-dark); }
.group[aria-disabled='true'] { cursor: default; background: transparent; color: var(--muted-on-dark); }
.group[aria-disabled='true'] svg { opacity: .35; }
.group[aria-expanded='false'] svg { transform: rotate(-90deg); }
.link { position: relative; min-height: 40px; margin: 2px 0; padding: 0 12px; display: flex; align-items: center; gap: 12px; border-radius: var(--radius-s); color: var(--muted-on-dark); font-size: var(--text-m); text-decoration: none; }
.link:hover { background: var(--on-dark-hover); color: var(--on-dark); }
.link.active { background: var(--on-dark-active); color: var(--on-dark); font-weight: 600; }
.link.active::before { content: ''; position: absolute; top: 8px; bottom: 8px; left: 0; width: 3px; border-radius: 999px; background: var(--accent); }
@media (max-width: 1080px) {
  .sidebar { transform: translateX(-100%); visibility: hidden; }
  .sidebar.open { transform: none; visibility: visible; }
  .close { display: inline-grid; }
}
</style>
