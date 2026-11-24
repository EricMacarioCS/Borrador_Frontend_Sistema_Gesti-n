<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { CalendarPlus, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import MovieDialog from './MovieDialog.vue'
import { keys, useMovies } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { STAGE_LABELS } from '@/domain/labels'
import type { Movie, MovieStage } from '@/domain/models'
import { movieStage } from '@/domain/rules'
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
      empty-title="No hay películas con estos criterios" @retry="movies.refetch()">
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
              <button type="button" class="action" :aria-label="`Editar ${movie.title}`" @click="open(movie)"><Pencil :size="15" /> Editar</button>
              <button type="button" class="action danger" :aria-label="`Retirar ${movie.title}`" :disabled="movie.upcomingScreenings > 0"
                :title="movie.upcomingScreenings ? 'Tiene funciones programadas' : undefined" @click="retire(movie)"><Trash2 :size="15" /> Retirar</button>
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
.art { position: relative; height: 120px; display: grid; place-items: center; background: linear-gradient(135deg, hsl(var(--hue) 55% 38%), var(--navy-950)); color: rgba(255, 255, 255, .85); }
.initials { font: 800 40px var(--font-title); letter-spacing: .04em; }
.rating { position: absolute; top: 10px; left: 10px; padding: 1px 7px; border-radius: 5px; background: rgba(255, 255, 255, .92); color: var(--ink); font: 700 12px var(--font-body); }
.body { padding: 14px 16px 16px; display: grid; gap: 6px; align-content: start; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
h2 { font: 700 17px var(--font-title); }
.meta { color: var(--muted); font-size: 13px; }
.meta strong { color: var(--ink); }
.actions { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
</style>
