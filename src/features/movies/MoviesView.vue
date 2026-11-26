<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { CalendarPlus, Clapperboard, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import MovieDialog from './MovieDialog.vue'
import { keys, useMovies } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { STAGE_LABELS } from '@/domain/labels'
import type { Movie, MovieStage } from '@/domain/models'
import { movieStage } from '@/domain/rules'
import RowMenu from '@/shared/ui/RowMenu.vue'
import StateView from '@/shared/ui/StateView.vue'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { formatDate } from '@/shared/lib/datetime'
import { hashHue, normalizeText } from '@/shared/lib/text'

const store = useSessionStore()
const { movies: port } = useServices()
const queryClient = useQueryClient()
const movies = useMovies()
const search = ref('')
const filter = ref<'all' | MovieStage | 'events'>('all')
const editing = ref<Movie | null>(null)
const dialogOpen = ref(false)

const stageOf = (movie: Movie) => movieStage(movie, store.today())
const shown = computed(() => (movies.data.value ?? [])
  .filter(movie => filter.value === 'all' ? stageOf(movie) !== 'finished'
    : filter.value === 'events' ? movie.isSpecialEvent : stageOf(movie) === filter.value)
  .filter(movie => normalizeText(`${movie.title} ${movie.genres.join(' ')} ${movie.cast.map(p => p.name).join(' ')}`).includes(normalizeText(search.value)))
  .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')))

const STAGE_TONE: Record<MovieStage, string> = { 'coming-soon': 'info', 'presale': 'warning', 'premiere': 'success', 'now-showing': 'success', 'finished': 'muted' }

function open(movie: Movie | null) {
  editing.value = movie
  dialogOpen.value = true
}

const remove = useMutation({
  mutationFn: (movie: Movie) => port.remove(movie.id, movie.version),
  onSuccess: (_, movie) => {
    void queryClient.invalidateQueries({ queryKey: keys.movies() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`${movie.title} se retiró del catálogo.`)
  },
  onError: toastError
})

async function retire(movie: Movie) {
  const ok = await confirmAction({ title: `Retirar ${movie.title}`, text: 'Se quitará del catálogo. Solo es posible si no tiene funciones.', confirmLabel: 'Retirar', danger: true })
  if (ok) remove.mutate(movie)
}
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Películas</h1>
        <p>Catálogo de películas y eventos especiales de toda la cadena. Dónde se exhiben lo deciden sus funciones.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="open(null)"><Plus :size="17" /> Agregar película</button>
    </div>

    <div class="toolbar">
      <div class="field grow search">
        <label for="buscar-pelicula" class="visually-hidden">Buscar película</label>
        <Search :size="17" aria-hidden="true" />
        <input id="buscar-pelicula" v-model="search" class="input" type="search" placeholder="Título, género o reparto" />
      </div>
      <div class="field">
        <label for="filtro-etapa" class="visually-hidden">Etapa</label>
        <select id="filtro-etapa" v-model="filter" class="select">
          <option value="all">Vigentes</option>
          <option value="now-showing">En cartelera</option>
          <option value="premiere">Estreno</option>
          <option value="presale">Preventa</option>
          <option value="coming-soon">Próximamente</option>
          <option value="events">Eventos especiales</option>
          <option value="finished">Finalizadas</option>
        </select>
      </div>
      <span class="count">{{ shown.length }} {{ shown.length === 1 ? 'película' : 'películas' }}</span>
    </div>

    <StateView :loading="movies.isPending.value" :error="movies.error.value" :empty="!shown.length" skeleton="cards"
      empty-title="No hay películas con estos criterios" :empty-icon="Clapperboard"
      :action-label="!movies.data.value?.length ? 'Agregar la primera película' : undefined" @action="open(null)" @retry="movies.refetch()">
      <ul class="grid" role="list">
        <li v-for="movie in shown" :key="movie.id" class="panel card">
          <div class="art" :style="{ '--hue': hashHue(movie.title) }" aria-hidden="true">
            <span class="rating">{{ movie.rating }}</span>
            <span class="initials">{{ movie.title.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() }}</span>
          </div>
          <div class="body">
            <div class="tags">
              <span class="pill" :class="STAGE_TONE[stageOf(movie)]">{{ STAGE_LABELS[stageOf(movie)] }}</span>
              <span v-if="movie.isSpecialEvent" class="pill info">Evento especial</span>
              <span v-if="movie.category === 'Garantía Cinépolis'" class="pill muted">Garantía</span>
            </div>
            <h2>{{ movie.title }}</h2>
            <p class="meta">{{ movie.genres.join(', ') }} · {{ movie.durationMinutes }} min</p>
            <p class="meta">Estreno: {{ movie.releaseDate ? formatDate(movie.releaseDate, 'short') : 'sin fecha' }}<template v-if="movie.lastDay"> · Hasta {{ formatDate(movie.lastDay, 'short') }}</template></p>
            <p class="meta"><strong>{{ movie.upcomingScreenings }}</strong> {{ movie.upcomingScreenings === 1 ? 'función programada' : 'funciones programadas' }}</p>
            <div class="actions">
              <RouterLink v-if="store.can('screenings.manage') && stageOf(movie) !== 'finished'" :to="{ path: '/funciones/programar', query: { pelicula: movie.id } }" class="btn btn-secondary btn-small">
                <CalendarPlus :size="15" /> Programar
              </RouterLink>
              <span class="row-actions end">
                <button type="button" class="icon-btn" :aria-label="`Editar ${movie.title}`" title="Editar" @click="open(movie)"><Pencil :size="16" aria-hidden="true" /></button>
                <RowMenu :label="`Más acciones para ${movie.title}`" :items="[{
                  label: 'Retirar', icon: Trash2, danger: true, disabled: movie.upcomingScreenings > 0, hint: 'Tiene funciones programadas', run: () => retire(movie)
                }]" />
              </span>
            </div>
          </div>
        </li>
      </ul>
    </StateView>

    <MovieDialog :open="dialogOpen" :movie="editing" @close="dialogOpen = false" />
  </section>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.card { overflow: hidden; display: grid; grid-template-rows: auto 1fr; }
.art { position: relative; height: 120px; display: grid; place-items: center; background: hsl(var(--hue) var(--art-tone)); color: var(--on-dark); }
.initials { font: 800 var(--text-2xl) var(--font-title); letter-spacing: .04em; }
.rating { position: absolute; top: 10px; left: 10px; padding: 1px 7px; border-radius: var(--radius-s); background: var(--surface); color: var(--ink); font: 700 var(--text-xs) var(--font-body); }
.body { padding: 14px 16px 16px; display: grid; gap: 6px; align-content: start; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
h2 { font: 700 var(--text-l) var(--font-title); }
.meta { color: var(--muted); font-size: var(--text-s); }
.meta strong { color: var(--ink); }
.actions { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.end { margin-left: auto; }
</style>
