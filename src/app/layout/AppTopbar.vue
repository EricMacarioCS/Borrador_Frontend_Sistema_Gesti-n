<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { ChevronDown, LogOut, Menu } from '@lucide/vue'
import { useSessionStore } from '@/app/stores/session'

const emit = defineEmits<{ menu: [] }>()
const route = useRoute()
const router = useRouter()
const store = useSessionStore()
const queryClient = useQueryClient()
const id = useId()

const initials = computed(() => (store.session.user?.name ?? '').split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase())
const scope = computed(() => store.session.complexIds === null
  ? 'Toda la cadena'
  : store.complexes.length === 1 ? store.complexes[0]!.name : `${store.complexes.length} complejos`)

/* Menú de usuario: se cierra con Escape, al hacer clic fuera o al sacar el foco. */
const open = ref(false)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const exit = ref<HTMLButtonElement>()

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  exit.value?.focus()
}
function close() {
  if (!open.value) return
  open.value = false
  trigger.value?.focus()
}
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && !root.value?.contains(next)) open.value = false
}
function onOutside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
watch(() => route.fullPath, () => { open.value = false })

async function signOut() {
  await store.signOut()
  queryClient.clear()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <button type="button" class="icon-btn menu" aria-label="Abrir menú" @click="emit('menu')"><Menu :size="20" /></button>
    <p class="crumb">Administración <span aria-hidden="true">/</span> <span class="current">{{ route.meta.title }}</span></p>
    <div ref="root" class="user" @focusout="onFocusOut" @keydown.esc.stop="close">
      <button ref="trigger" type="button" class="user-btn" aria-haspopup="dialog" :aria-expanded="open" :aria-controls="open ? id : undefined"
        :aria-label="`Menú de usuario de ${store.session.user?.name}`" @click="toggle">
        <span class="avatar" aria-hidden="true">{{ initials }}</span>
        <ChevronDown :size="16" aria-hidden="true" />
      </button>
      <div v-if="open" :id="id" class="user-menu" role="dialog" aria-label="Cuenta de usuario" tabindex="-1">
        <div class="who">
          <strong>{{ store.session.user?.name }}</strong>
          <span>{{ store.session.user?.roleName }}</span>
        </div>
        <dl class="scope">
          <dt>Alcance</dt>
          <dd>{{ scope }}</dd>
        </dl>
        <button ref="exit" type="button" class="btn btn-secondary btn-block" @click="signOut"><LogOut :size="16" aria-hidden="true" /> Cerrar sesión</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar { position: sticky; top: 0; z-index: 40; height: var(--topbar-height); padding: 0 var(--page-gutter); display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); background: var(--surface); }
.menu { display: none; }
.crumb { min-width: 0; color: var(--muted); font-size: var(--text-s); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.crumb span[aria-hidden] { margin: 0 6px; color: var(--field-border); }
.current { color: var(--ink); font-weight: 600; }
.user { position: relative; margin-left: auto; }
.user-btn { padding: 4px 8px 4px 4px; display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--muted); }
.user-btn:hover, .user-btn[aria-expanded='true'] { border-color: var(--line-strong); background: var(--surface-soft); }
.avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: var(--navy-950); font-size: var(--text-s); font-weight: 700; }
.user-menu { position: absolute; top: calc(100% + 6px); right: 0; width: min(270px, calc(100vw - 32px)); padding: 14px; display: grid; gap: 12px; border: 1px solid var(--line); border-radius: var(--radius-l); background: var(--surface); box-shadow: var(--shadow-float); }
.who { display: grid; }
.who span { color: var(--muted); font-size: var(--text-s); }
.scope { padding: 10px 0; display: grid; gap: 2px; border-block: 1px solid var(--line); }
.scope dt { color: var(--muted); font-size: var(--text-xs); font-weight: 600; }
.scope dd { margin: 0; font-size: var(--text-m); }
@media (max-width: 1080px) { .menu { display: inline-grid; } }
</style>
