<script setup lang="ts">
/** Campo de importe: se escribe en pesos ("85.50") y el modelo guarda centavos enteros, o `null` si no es válido. */
import { ref, watch } from 'vue'
import { centsToPesos, pesosToCents } from '@/domain/rules'

const props = defineProps<{ id?: string; label?: string; invalid?: boolean; disabled?: boolean; placeholder?: string }>()
const model = defineModel<number | null>({ required: true })
const text = ref(model.value === null ? '' : centsToPesos(model.value))

watch(model, value => {
  if (value !== pesosToCents(text.value)) text.value = value === null ? '' : centsToPesos(value)
})

function input(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  model.value = pesosToCents(text.value)
}
</script>

<template>
  <span class="money-input">
    <input :id="props.id" class="input" inputmode="decimal" autocomplete="off" :value="text" :aria-label="props.id ? undefined : props.label" :placeholder="placeholder ?? '0.00'"
      :aria-invalid="invalid || (text !== '' && model === null) ? 'true' : undefined" :disabled="disabled" @input="input" />
  </span>
</template>
