<script setup lang="ts" generic="T extends string | number">
/** Selección múltiple con casillas, grupos opcionales y "Seleccionar todo". Se cierra con Esc o al salir del foco. */
import { computed, ref, useId } from 'vue'
import { ChevronDown } from '@lucide/vue'

export interface MultiOption<V> { value: V; label: string; group?: string; hint?: string; disabled?: boolean }

const props = defineProps<{
  label: string
  options: MultiOption<T>[]
  placeholder?: string
  error?: string | null
}>()
const model = defineModel<T[]>({ required: true })

const open = ref(false)
const root = ref<HTMLElement>()
const id = useId()
const selected = computed(() => props.options.filter(option => model.value.includes(option.value)))
const choosable = computed(() => props.options.filter(option => !option.disabled))
const allSelected = computed(() => choosable.value.length > 0 && choosable.value.every(option => model.value.includes(option.value)))
const groups = computed(() => {
  const result = new Map<string, MultiOption<T>[]>()
  for (const option of props.options) result.set(option.group ?? '', [...(result.get(option.group ?? '') ?? []), option])
  return [...result]
})
const summary = computed(() => {
  if (!selected.value.length) return props.placeholder ?? 'Seleccionar…'
  if (selected.value.length <= 2) return selected.value.map(option => option.group ? `${option.group}: ${option.label}` : option.label).join(', ')
  return `${selected.value.length} seleccionados`
})

function toggle(values: T[], checked: boolean) {
  const others = model.value.filter(value => !values.includes(value))
  model.value = checked ? [...others, ...values] : others
}
function close() {
  open.value = false
  root.value?.querySelector<HTMLButtonElement>('.trigger')?.focus()
}
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next && !root.value?.contains(next)) open.value = false
}
</script>

<template>
  <div ref="root" class="field multi" @focusout="onFocusOut" @keydown.esc.stop.prevent="close">
    <span :id="id" class="field-label">{{ label }}</span>
    <div class="control">
      <button type="button" class="trigger" :aria-expanded="open" :aria-labelledby="`${id} ${id}-value`" :aria-invalid="error ? 'true' : undefined" @click="open = !open">
        <span :id="`${id}-value`" :class="{ placeholder: !selected.length }">{{ summary }}</span>
        <ChevronDown :size="15" aria-hidden="true" />
      </button>
      <div v-if="open" class="menu">
        <label v-if="choosable.length > 1" class="option all">
          <input type="checkbox" :checked="allSelected" :indeterminate="!allSelected && selected.length > 0"
            @change="toggle(choosable.map(option => option.value), ($event.target as HTMLInputElement).checked)" />
          <span>Seleccionar todo</span>
        </label>
        <div class="list">
          <p v-if="!options.length" class="empty-list">No hay opciones disponibles.</p>
          <div v-for="[group, items] in groups" :key="group">
            <label v-if="group" class="option group">
              <input type="checkbox" :checked="items.every(option => option.disabled || model.includes(option.value))"
                @change="toggle(items.filter(option => !option.disabled).map(option => option.value), ($event.target as HTMLInputElement).checked)" />
              <span>{{ group }}</span>
            </label>
            <label v-for="option in items" :key="option.value" class="option" :class="{ nested: group, off: option.disabled }">
              <input type="checkbox" :checked="model.includes(option.value)" :disabled="option.disabled"
                @change="toggle([option.value], ($event.target as HTMLInputElement).checked)" />
              <span>{{ option.label }}</span>
              <small v-if="option.hint">{{ option.hint }}</small>
            </label>
          </div>
        </div>
        <div v-if="$slots.footer" class="footer"><slot name="footer" /></div>
        <div class="done">
          <span>{{ selected.length }} de {{ choosable.length }}</span>
          <button type="button" class="btn btn-primary btn-small" @click="close">Listo</button>
        </div>
      </div>
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.control { position: relative; }
.trigger { width: 100%; min-height: 40px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--field-border); border-radius: var(--radius-s); background: var(--surface); text-align: left; }
.trigger:focus-visible { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px var(--focus-ring); }
.trigger[aria-invalid='true'] { border-color: var(--danger); }
.trigger > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.placeholder { color: var(--muted); }
.trigger svg { flex: none; color: var(--muted); }
.menu { position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0; min-width: 240px; border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--surface); box-shadow: var(--shadow-float); }
.list { max-height: 260px; overflow-y: auto; padding: 4px; }
.option { padding: 7px 8px; display: flex; align-items: center; gap: 8px; border-radius: var(--radius-s); font-size: var(--text-m); cursor: pointer; }
.option:hover { background: var(--selection); }
.option input { width: 16px; height: 16px; flex: none; accent-color: var(--blue); }
.option > span { flex: 1; }
.option small { color: var(--muted); font-size: var(--text-xs); text-align: right; }
.option.off { opacity: .5; cursor: not-allowed; }
.all { margin: 4px; border-bottom: 1px solid var(--line); border-radius: var(--radius-s) var(--radius-s) 0 0; font-weight: 600; }
.group { background: var(--surface-soft); font-weight: 600; }
.nested { padding-left: 28px; }
.footer { padding: 8px; display: flex; gap: 8px; border-top: 1px solid var(--line); }
.footer :slotted(input) { flex: 1; min-width: 0; }
.done { padding: 8px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); color: var(--muted); font-size: var(--text-s); }
.empty-list { padding: 12px; color: var(--muted); font-size: var(--text-m); }
</style>
