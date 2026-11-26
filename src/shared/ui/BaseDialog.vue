<script setup lang="ts">
/**
 * Ventana basada en <dialog>: el navegador da foco atrapado, Esc y fondo inerte.
 * Con `dirty`, cerrar sin guardar pide confirmación para no perder lo capturado por accidente.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { confirmAction } from '@/shared/composables/feedback'

const props = withDefaults(defineProps<{
  open: boolean
  label: string
  size?: 'small' | 'medium' | 'large' | 'wide'
  dirty?: boolean
  eyebrow?: string
}>(), { size: 'medium', dirty: false, eyebrow: undefined })

const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
let opener: HTMLElement | null = null

function sync(open: boolean) {
  const element = dialog.value
  if (!element) return
  if (open && !element.open) {
    opener = document.activeElement as HTMLElement | null
    element.showModal()
    document.documentElement.style.overflow = 'hidden'
    void nextTick(() => element.querySelector<HTMLElement>('[autofocus], .dialog-body :is(input, select, textarea, button):not(:disabled)')?.focus())
  } else if (!open && element.open) {
    element.close()
  }
}

function onClosed() {
  if (!document.querySelector('dialog[open]')) document.documentElement.style.overflow = ''
  if (opener?.isConnected) opener.focus()
  if (props.open) emit('close')
}

async function requestClose() {
  if (props.dirty) {
    const discard = await confirmAction({ title: '¿Descartar los cambios?', text: 'Lo que capturaste en esta ventana no se ha guardado.', confirmLabel: 'Descartar', danger: true })
    if (!discard) return
  }
  emit('close')
}

function onCancel(event: Event) {
  event.preventDefault()
  void requestClose()
}

function onPointerDown(event: MouseEvent) {
  // Solo un clic que empieza y termina en el fondo cierra; seleccionar texto y soltar fuera no.
  pressedBackdrop = event.target === dialog.value
}
let pressedBackdrop = false
function onClick(event: MouseEvent) {
  if (pressedBackdrop && event.target === dialog.value) void requestClose()
  pressedBackdrop = false
}

onMounted(() => sync(props.open))
watch(() => props.open, sync)
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
    if (!document.querySelector('dialog[open]')) document.documentElement.style.overflow = ''
  }
})
</script>

<template>
  <dialog ref="dialog" class="dialog" :class="`dialog-${size}`" :aria-label="label"
    @cancel="onCancel" @close="onClosed" @mousedown="onPointerDown" @click="onClick">
    <div v-if="open" class="dialog-panel">
      <header class="dialog-header">
        <div class="titles">
          <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
          <slot name="header"><h2>{{ label }}</h2></slot>
        </div>
        <button type="button" class="icon-btn" aria-label="Cerrar" @click="requestClose"><X :size="20" /></button>
      </header>
      <div class="dialog-body"><slot /></div>
      <footer v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.dialog { max-width: none; max-height: none; padding: 0; border: 0; background: transparent; color: var(--ink); }
.dialog::backdrop { background: var(--backdrop); }
.dialog-panel { display: flex; flex-direction: column; max-height: min(92dvh, 900px); overflow: hidden; border-radius: var(--radius-l); background: var(--surface); box-shadow: var(--shadow-float); }
.dialog-small { width: min(calc(100vw - 24px), 440px); margin: auto; }
.dialog-medium { width: min(calc(100vw - 24px), 640px); margin: auto; }
.dialog-large { width: min(calc(100vw - 24px), 880px); margin: auto; }
.dialog-wide { width: min(calc(100vw - 24px), 1120px); margin: auto; }
/* Encabezado y pie quedan fijos: solo el cuerpo se desplaza. */
.dialog-header { flex: none; padding: 16px 20px; display: flex; align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--line); }
.titles { flex: 1; min-width: 0; display: grid; gap: 2px; }
.titles :slotted(h2), .titles h2 { font: 700 var(--text-xl) var(--font-title); }
.dialog-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 20px; }
.dialog-footer { flex: none; padding: 14px 20px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--line); background: var(--surface-soft); }
@media (max-width: 640px) {
  .dialog-header, .dialog-body, .dialog-footer { padding-inline: 14px; }
  .dialog-panel { max-height: 94dvh; }
}
</style>
