<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Banner, BannerInput } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MultiSelect from '@/shared/ui/MultiSelect.vue'
import { toast, toastError } from '@/shared/composables/feedback'

const props = defineProps<{ open: boolean; banner: Banner | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { content } = useServices()
const queryClient = useQueryClient()
const id = useId()

const blank = (): BannerInput => ({ title: '', imageUrl: '', targetUrl: '/', startsOn: store.today(), endsOn: null, active: true, appliesToAll: true, complexIds: [] })
const draft = ref<BannerInput>(blank())
let original = ''
watch(() => props.open, open => {
  if (!open) return
  const { id: _i, version: _v, ...rest } = props.banner ?? { id: '', version: 0, ...blank() }
  draft.value = { ...rest, complexIds: [...rest.complexIds] }
  original = JSON.stringify(draft.value)
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original)
const problem = computed(() => {
  const d = draft.value
  if (!d.title.trim() || !d.imageUrl.trim()) return 'Completa el título y la imagen.'
  if (!d.targetUrl.startsWith('/') && !d.targetUrl.startsWith('https://')) return 'El enlace debe empezar con / o https://'
  if (d.endsOn && d.endsOn < d.startsOn) return 'El banner termina antes de empezar.'
  if (!d.appliesToAll && !d.complexIds.length) return 'Elige los complejos o márcalo para toda la cadena.'
  return null
})
const complexOptions = computed(() => store.complexes.map(c => ({ value: c.id, label: c.name, group: c.cityName })))

const save = useMutation({
  mutationFn: () => {
    const input = { ...draft.value, title: draft.value.title.trim(), endsOn: draft.value.endsOn || null, complexIds: draft.value.appliesToAll ? [] : draft.value.complexIds }
    return props.banner ? content.updateBanner(props.banner.id, { ...input, version: props.banner.version }) : content.createBanner(input)
  },
  onSuccess: banner => {
    void queryClient.invalidateQueries({ queryKey: keys.banners() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`Banner ${banner.title} guardado.`)
    emit('close')
  },
  onError: toastError
})
</script>

<template>
  <BaseDialog :open="open" :label="banner ? `Editar ${banner.title}` : 'Nuevo banner'" eyebrow="Contenido web" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="!problem && save.mutate()">
      <div class="field full"><label :for="`${id}-title`">Título *</label><input :id="`${id}-title`" v-model="draft.title" class="input" maxlength="120" /></div>
      <div class="field full"><label :for="`${id}-image`">URL de la imagen *</label><input :id="`${id}-image`" v-model="draft.imageUrl" class="input" placeholder="https://… o /banners/archivo.jpg" /></div>
      <div class="field full">
        <label :for="`${id}-target`">Enlace al pulsarlo *</label>
        <input :id="`${id}-target`" v-model="draft.targetUrl" class="input" placeholder="/promociones" />
        <p class="field-hint">Una ruta del sitio (/promociones) o una dirección https://</p>
      </div>
      <div class="field"><label :for="`${id}-start`">Desde *</label><input :id="`${id}-start`" v-model="draft.startsOn" class="input" type="date" /></div>
      <div class="field"><label :for="`${id}-end`">Hasta</label><input :id="`${id}-end`" v-model="draft.endsOn" class="input" type="date" :min="draft.startsOn" /></div>
      <label class="check full"><input v-model="draft.active" type="checkbox" /> Activo</label>
      <label class="check full"><input v-model="draft.appliesToAll" type="checkbox" /> Se muestra en toda la cadena</label>
      <MultiSelect v-if="!draft.appliesToAll" v-model="draft.complexIds" class="full" label="Complejos *" :options="complexOptions" />
      <p v-if="problem && dirty" class="field-error full">{{ problem }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="!!problem || save.isPending.value">Guardar banner</button>
    </template>
  </BaseDialog>
</template>
