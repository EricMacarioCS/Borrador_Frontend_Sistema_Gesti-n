<script setup lang="ts">
/**
 * Menú "⋯" para las acciones secundarias o destructivas de una fila. Usa posición fija para que la tabla,
 * que tiene desplazamiento propio, no lo recorte. Funciona con flechas, Inicio, Fin y Escape.
 */
import { nextTick, onBeforeUnmount, ref, useId, type Component } from 'vue'
import { Ellipsis } from '@lucide/vue'

export interface RowMenuItem {
  label: string
  icon?: Component
  danger?: boolean
  disabled?: boolean
  /** Explica por qué una acción no está disponible. */
  hint?: string
  run: () => void
}

defineProps<{ label: string; items: RowMenuItem[] }>()

const id = useId()
const open = ref(false)
const trigger = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const position = ref<Record<string, string>>({})

const entries = () => [...(menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]

function onOutside(event: Event) {
  const target = event.target as Node
  if (!menu.value?.contains(target) && !trigger.value?.contains(target)) close(false)
}
// Al desplazar o cambiar el tamaño, la posición calculada deja de servir.
const dismiss = () => close(false)

function listen(active: boolean) {
  const method = active ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onOutside)
  window[method]('scroll', dismiss, true)
  window[method]('resize', dismiss)
}

async function show() {
  const box = trigger.value!.getBoundingClientRect()
  position.value = { top: `${box.bottom + 4}px`, right: `${Math.max(8, document.documentElement.clientWidth - box.right)}px` }
  open.value = true
  await nextTick()
  const height = menu.value?.offsetHeight ?? 0
  if (box.bottom + 4 + height > window.innerHeight) position.value = { ...position.value, top: `${Math.max(8, box.top - 4 - height)}px` }
  await nextTick()
  entries()[0]?.focus({ preventScroll: true })
  listen(true)
}
function close(restoreFocus = true) {
  if (!open.value) return
  open.value = false
  listen(false)
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
function choose(item: RowMenuItem) {
  if (item.disabled) return
  close()
  item.run()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    return close()
  }
  // El foco vuelve al botón antes de que Tab avance al siguiente control.
  if (event.key === 'Tab') return close()
  const list = entries()
  const current = list.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowDown' ? (current + 1) % list.length
    : event.key === 'ArrowUp' ? (current - 1 + list.length) % list.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : null
  if (next === null) return
  event.preventDefault()
  list[next]?.focus()
}
onBeforeUnmount(() => listen(false))
</script>

<template>
  <span class="row-menu">
    <button ref="trigger" type="button" class="icon-btn" aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? id : undefined"
      :aria-label="label" :title="label" @click="open ? close() : show()">
      <Ellipsis :size="18" aria-hidden="true" />
    </button>
    <div v-if="open" :id="id" ref="menu" class="menu" role="menu" :aria-label="label" :style="position" @keydown="onKeydown">
      <button v-for="item in items" :key="item.label" type="button" role="menuitem" tabindex="-1" class="item"
        :class="{ danger: item.danger }" :aria-disabled="item.disabled ? 'true' : undefined" @click="choose(item)">
        <component :is="item.icon" v-if="item.icon" :size="16" aria-hidden="true" />
        <span class="stack"><span>{{ item.label }}</span><small v-if="item.disabled && item.hint">{{ item.hint }}</small></span>
      </button>
    </div>
  </span>
</template>

<style scoped>
.row-menu { display: inline-flex; }
.menu { position: fixed; z-index: 100; min-width: 200px; max-width: min(280px, calc(100vw - 16px)); padding: 4px; display: grid; gap: 2px; border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--surface); box-shadow: var(--shadow-float); text-align: left; white-space: normal; }
.item { min-height: 36px; padding: 6px 10px; display: flex; align-items: center; gap: 10px; border: 0; border-radius: var(--radius-s); background: transparent; color: var(--ink); font-size: var(--text-m); font-weight: 600; text-align: left; }
.item:hover, .item:focus-visible { background: var(--selection); }
.item.danger { color: var(--danger); }
.item.danger:hover, .item.danger:focus-visible { background: var(--danger-soft); }
.item[aria-disabled='true'] { background: transparent; color: var(--disabled-ink); cursor: not-allowed; }
.item .stack small { color: inherit; font-size: var(--text-xs); font-weight: 400; }
</style>
