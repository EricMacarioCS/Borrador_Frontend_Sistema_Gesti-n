<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { Plus, X } from '@lucide/vue'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Movie, MovieInput } from '@/domain/models'
import { movieDatesProblem, slugify } from '@/domain/rules'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import MultiSelect from '@/shared/ui/MultiSelect.vue'
import { toast, toastError } from '@/shared/composables/feedback'
import { clone } from '@/shared/lib/clone'

const props = defineProps<{ open: boolean; movie: Movie | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useSessionStore()
const { movies } = useServices()
const queryClient = useQueryClient()
const id = useId()

const blank = (): MovieInput => ({
  title: '', slug: '', rating: 'B', genres: [], durationMinutes: 120, synopsis: '', category: 'Normal', isSpecialEvent: false,
  posterUrl: null, bannerUrl: null, trailerUrl: null, vistaId: null, cast: [], releaseDate: store.today(), presaleFrom: null, lastDay: null
})
const draft = ref<MovieInput>(blank())
const original = ref('')
const touched = ref(false)
const person = ref<{ name: string; role: 'actor' | 'director' }>({ name: '', role: 'actor' })

watch(() => props.open, open => {
  if (!open) return
  const { id: _i, version: _v, upcomingScreenings: _u, ...rest } = props.movie ?? { id: '', version: 0, upcomingScreenings: 0, ...blank() }
  draft.value = clone(rest)
  original.value = JSON.stringify(draft.value)
  touched.value = false
}, { immediate: true })

const dirty = computed(() => JSON.stringify(draft.value) !== original.value)
const errors = computed(() => ({
  title: draft.value.title.trim() ? null : 'Escribe el título.',
  genres: draft.value.genres.length ? null : 'Elige al menos un género.',
  duration: Number.isInteger(draft.value.durationMinutes) && draft.value.durationMinutes > 0 && draft.value.durationMinutes <= 600 ? null : 'De 1 a 600 minutos.',
  synopsis: draft.value.synopsis.trim() ? null : 'Escribe la sinopsis.',
  dates: movieDatesProblem(draft.value)
}))
const valid = computed(() => Object.values(errors.value).every(error => !error))
const scheduled = computed(() => props.movie?.upcomingScreenings ?? 0)
const genreOptions = computed(() => (store.reference?.genres ?? []).map(value => ({ value, label: value })))

const save = useMutation({
  mutationFn: () => {
    const input: MovieInput = {
      ...draft.value, title: draft.value.title.trim(), slug: slugify(draft.value.slug || draft.value.title),
      posterUrl: draft.value.posterUrl?.trim() || null, bannerUrl: draft.value.bannerUrl?.trim() || null,
      trailerUrl: draft.value.trailerUrl?.trim() || null, vistaId: draft.value.vistaId?.trim() || null,
      releaseDate: draft.value.releaseDate || null, presaleFrom: draft.value.presaleFrom || null, lastDay: draft.value.lastDay || null
    }
    return props.movie ? movies.update(props.movie.id, { ...input, version: props.movie.version }) : movies.create(input)
  },
  onSuccess: movie => {
    void queryClient.invalidateQueries({ queryKey: keys.movies() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(props.movie ? `${movie.title} se actualizó.` : `${movie.title} se registró.`)
    emit('close')
  },
  onError: toastError
})

function submit() {
  touched.value = true
  if (valid.value) save.mutate()
}
function addPerson() {
  const name = person.value.name.trim()
  if (!name) return
  draft.value.cast.push({ name, role: person.value.role })
  person.value.name = ''
}
const show = (key: keyof typeof errors.value) => touched.value ? errors.value[key] : null
</script>

<template>
  <BaseDialog :open="open" :label="movie ? `Editar ${movie.title}` : 'Agregar película'" eyebrow="Catálogo de películas" size="large" :dirty="dirty" @close="emit('close')">
    <form :id="`${id}-form`" class="form-grid" novalidate @submit.prevent="submit">
      <section class="form-section">
        <h3 class="form-section-title">Información general</h3>
        <div class="form-grid">
          <div class="field full">
            <label :for="`${id}-title`">Título *</label>
            <input :id="`${id}-title`" v-model="draft.title" class="input" maxlength="150" :aria-invalid="show('title') ? 'true' : undefined" />
            <p class="field-error">{{ show('title') }}</p>
          </div>
          <div class="field">
            <label :for="`${id}-slug`">URL amigable</label>
            <input :id="`${id}-slug`" v-model="draft.slug" class="input" :placeholder="slugify(draft.title) || 'se genera del título'" />
            <p class="field-hint">Se usa en la dirección del sitio web.</p>
          </div>
          <div class="field">
            <label :for="`${id}-rating`">Clasificación</label>
            <select :id="`${id}-rating`" v-model="draft.rating" class="select">
              <option v-for="rating in store.reference?.ratings" :key="rating.code" :value="rating.code">{{ rating.code }} · {{ rating.description }}</option>
            </select>
          </div>
          <MultiSelect v-model="draft.genres" label="Géneros *" :options="genreOptions" placeholder="Elige uno o varios" :error="show('genres')" />
          <div class="field">
            <label :for="`${id}-duration`">Duración (minutos) *</label>
            <input :id="`${id}-duration`" v-model.number="draft.durationMinutes" class="input" type="number" min="1" max="600" :disabled="scheduled > 0" :aria-invalid="show('duration') ? 'true' : undefined" />
            <p v-if="scheduled" class="field-hint">Tiene {{ scheduled }} funciones programadas: retíralas para cambiar la duración.</p>
            <p class="field-error">{{ show('duration') }}</p>
          </div>
          <div class="field">
            <label :for="`${id}-category`">Categoría</label>
            <select :id="`${id}-category`" v-model="draft.category" class="select">
              <option>Normal</option>
              <option>Garantía Cinépolis</option>
            </select>
            <p class="field-hint">Garantía Cinépolis habilita la reclamación de satisfacción.</p>
          </div>
          <label class="check full"><input v-model="draft.isSpecialEvent" type="checkbox" /> Evento especial (concierto, ópera, deporte o anime)</label>
          <div class="field full">
            <label :for="`${id}-synopsis`">Sinopsis *</label>
            <textarea :id="`${id}-synopsis`" v-model="draft.synopsis" class="textarea" maxlength="2000" :aria-invalid="show('synopsis') ? 'true' : undefined" />
            <p class="field-error">{{ show('synopsis') }}</p>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h3 class="form-section-title">Fechas de cartelera</h3>
        <div class="form-grid">
          <div class="field">
            <label :for="`${id}-release`">Estreno</label>
            <input :id="`${id}-release`" v-model="draft.releaseDate" class="input" type="date" />
          </div>
          <div class="field">
            <label :for="`${id}-presale`">Inicio de preventa (opcional)</label>
            <input :id="`${id}-presale`" v-model="draft.presaleFrom" class="input" type="date" />
          </div>
          <div class="field">
            <label :for="`${id}-last`">Último día (opcional)</label>
            <input :id="`${id}-last`" v-model="draft.lastDay" class="input" type="date" />
          </div>
          <p class="field-error full">{{ show('dates') }}</p>
          <p class="notice full small">Estas fechas calculan Próximamente, Preventa y Estreno. Requieren columnas nuevas en la tabla <code>pelicula</code>.</p>
        </div>
      </section>

      <section class="form-section">
        <h3 class="form-section-title">Reparto</h3>
        <div class="form-grid">
          <div class="full chips">
            <span v-for="(item, index) in draft.cast" :key="`${item.name}-${index}`" class="chip">
              {{ item.name }} · {{ item.role === 'director' ? 'Dirección' : 'Actuación' }}
              <button type="button" :aria-label="`Quitar a ${item.name}`" @click="draft.cast.splice(index, 1)"><X :size="13" /></button>
            </span>
            <span v-if="!draft.cast.length" class="muted small">Sin personas registradas.</span>
          </div>
          <div class="full add-person">
            <input v-model="person.name" class="input" placeholder="Nombre" aria-label="Nombre de la persona" @keydown.enter.prevent="addPerson" />
            <select v-model="person.role" class="select" aria-label="Rol">
              <option value="actor">Actuación</option>
              <option value="director">Dirección</option>
            </select>
            <button type="button" class="btn btn-secondary" @click="addPerson"><Plus :size="16" /> Agregar</button>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h3 class="form-section-title">Medios e integración</h3>
        <div class="form-grid">
          <div class="field full">
            <label :for="`${id}-poster`">URL del póster vertical (2:3)</label>
            <input :id="`${id}-poster`" v-model="draft.posterUrl" class="input" placeholder="https://…" />
          </div>
          <div class="field full">
            <label :for="`${id}-banner`">URL de la imagen horizontal</label>
            <input :id="`${id}-banner`" v-model="draft.bannerUrl" class="input" placeholder="https://…" />
          </div>
          <div class="field">
            <label :for="`${id}-trailer`">URL del tráiler</label>
            <input :id="`${id}-trailer`" v-model="draft.trailerUrl" class="input" placeholder="https://…" />
          </div>
          <div class="field">
            <label :for="`${id}-vista`">ID en Vista</label>
            <input :id="`${id}-vista`" v-model="draft.vistaId" class="input" />
            <p class="field-hint">Opcional. Lo llena la integración con Vista.</p>
          </div>
        </div>
      </section>

    </form>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancelar</button>
      <button type="submit" :form="`${id}-form`" class="btn btn-primary" :disabled="save.isPending.value">{{ save.isPending.value ? 'Guardando…' : 'Guardar película' }}</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.add-person { display: grid; grid-template-columns: minmax(0, 1fr) 160px auto; gap: 8px; }
code { font-size: var(--text-xs); }
@media (max-width: 720px) { .add-person { grid-template-columns: minmax(0, 1fr); } }
</style>
