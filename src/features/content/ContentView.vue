<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from '@lucide/vue'
import BannerDialog from './BannerDialog.vue'
import { keys, useBanners, useFaq, useHomeContent, useMovies, usePages, usePurchaseRules } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import type { Banner, FaqItem, InfoPage, PurchaseRules } from '@/domain/models'
import { movieStage } from '@/domain/rules'
import StateView from '@/shared/ui/StateView.vue'
import { useDirtyGuard } from '@/shared/composables/dirty'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { formatDate } from '@/shared/lib/datetime'

type Tab = 'home' | 'banners' | 'faq' | 'pages' | 'rules'
const store = useSessionStore()
const { content } = useServices()
const queryClient = useQueryClient()
const tab = ref<Tab>('home')

const home = useHomeContent()
const movies = useMovies()
const banners = useBanners()
const faq = useFaq()
const pages = usePages()
const rules = usePurchaseRules()

/* Portada */
const featured = ref<string[]>([])
const toAdd = ref('')
watch(() => home.data.value, value => { if (value) featured.value = [...value.featuredMovieIds] }, { immediate: true })
const homeDirty = computed(() => JSON.stringify(featured.value) !== JSON.stringify(home.data.value?.featuredMovieIds ?? []))
const candidates = computed(() => (movies.data.value ?? []).filter(m => !featured.value.includes(m.id) && movieStage(m, store.today()) !== 'finished'))
const title = (id: string) => movies.data.value?.find(m => m.id === id)?.title ?? 'Película retirada'
function move(index: number, step: number) {
  const list = [...featured.value]
  const [item] = list.splice(index, 1)
  list.splice(index + step, 0, item!)
  featured.value = list
}
const saveHome = useMutation({
  mutationFn: () => content.saveHome({ version: home.data.value!.version, featuredMovieIds: featured.value }),
  onSuccess: saved => { queryClient.setQueryData(keys.home(), saved); toast('Portada guardada.') },
  onError: toastError
})

/* Banners */
const bannerDialog = ref<{ banner: Banner | null } | null>(null)
const bannerState = (b: Banner) => !b.active ? { label: 'Inactivo', tone: 'muted' }
  : b.endsOn && b.endsOn < store.today() ? { label: 'Vencido', tone: 'muted' }
    : b.startsOn > store.today() ? { label: 'Programado', tone: 'info' } : { label: 'Publicado', tone: 'success' }
const removeBanner = useMutation({
  mutationFn: (b: Banner) => content.removeBanner(b.id, b.version),
  onSuccess: () => { void queryClient.invalidateQueries({ queryKey: keys.banners() }); toast('Banner eliminado.') },
  onError: toastError
})
async function deleteBanner(b: Banner) {
  if (await confirmAction({ title: `Eliminar ${b.title}`, text: 'Se quitará del sitio web.', confirmLabel: 'Eliminar', danger: true })) removeBanner.mutate(b)
}

/* Preguntas frecuentes */
const faqItems = ref<FaqItem[]>([])
watch(() => faq.data.value, value => { if (value) faqItems.value = value.items.map(item => ({ ...item })) }, { immediate: true })
const faqDirty = computed(() => JSON.stringify(faqItems.value) !== JSON.stringify(faq.data.value?.items ?? []))
const faqValid = computed(() => faqItems.value.every(item => item.question.trim() && item.answer.trim()))
const saveFaq = useMutation({
  mutationFn: () => content.saveFaq({ version: faq.data.value!.version, items: faqItems.value.map(i => ({ question: i.question.trim(), answer: i.answer.trim() })) }),
  onSuccess: saved => { queryClient.setQueryData(keys.faq(), saved); toast('Preguntas frecuentes guardadas.') },
  onError: toastError
})

/* Páginas */
const pageSlug = ref('')
const pageDraft = ref<InfoPage | null>(null)
watch([() => pages.data.value, pageSlug], () => {
  const list = pages.data.value ?? []
  if (!pageSlug.value && list[0]) pageSlug.value = list[0].slug
  const page = list.find(p => p.slug === pageSlug.value)
  pageDraft.value = page ? { ...page } : null
}, { immediate: true })
const pageDirty = computed(() => {
  const saved = pages.data.value?.find(p => p.slug === pageSlug.value)
  return Boolean(saved && pageDraft.value && (saved.title !== pageDraft.value.title || saved.body !== pageDraft.value.body))
})
async function changePage(event: Event) {
  const select = event.target as HTMLSelectElement
  if (pageDirty.value && !await confirmAction({ title: 'Descartar cambios', text: 'La página tiene cambios sin guardar.', confirmLabel: 'Descartar', danger: true })) {
    select.value = pageSlug.value
    return
  }
  pageSlug.value = select.value
}
const savePage = useMutation({
  mutationFn: () => content.savePage({ ...pageDraft.value!, title: pageDraft.value!.title.trim(), body: pageDraft.value!.body.trim() }),
  onSuccess: () => { void queryClient.invalidateQueries({ queryKey: keys.pages() }); toast('Página guardada.') },
  onError: toastError
})

/* Reglas de compra */
const rulesDraft = ref<PurchaseRules | null>(null)
watch(() => rules.data.value, value => { if (value) rulesDraft.value = { ...value } }, { immediate: true })
const rulesDirty = computed(() => JSON.stringify(rulesDraft.value) !== JSON.stringify(rules.data.value ?? null))
const LIMITS = [
  { key: 'maxSeatsPerPurchase', label: 'Asientos por compra', min: 1, max: 30 },
  { key: 'holdMinutes', label: 'Minutos de apartado', min: 5, max: 30 },
  { key: 'cancelMinutesBefore', label: 'Minutos límite para cancelar antes de la función', min: 0, max: 1440 },
  { key: 'scheduleDays', label: 'Días de cartelera visibles', min: 1, max: 60 }
] as const
const rulesValid = computed(() => rulesDraft.value !== null && LIMITS.every(l => {
  const value = rulesDraft.value![l.key]
  return Number.isInteger(value) && value >= l.min && value <= l.max
}))
const saveRules = useMutation({
  mutationFn: () => content.savePurchaseRules(rulesDraft.value!),
  onSuccess: saved => { queryClient.setQueryData(keys.purchaseRules(), saved); toast('Reglas de compra guardadas.') },
  onError: toastError
})

useDirtyGuard(() => homeDirty.value || faqDirty.value || pageDirty.value || rulesDirty.value)
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Contenido web</h1>
        <p>Lo que el sitio público muestra: portada, banners, preguntas frecuentes, textos legales y reglas de compra.</p>
      </div>
      <button v-if="tab === 'banners'" type="button" class="btn btn-primary" @click="bannerDialog = { banner: null }"><Plus :size="16" /> Nuevo banner</button>
    </div>

    <div class="tabs" role="tablist" aria-label="Secciones del contenido">
      <button type="button" role="tab" :aria-selected="tab === 'home'" @click="tab = 'home'">Portada<span v-if="homeDirty"> •</span></button>
      <button type="button" role="tab" :aria-selected="tab === 'banners'" @click="tab = 'banners'">Banners</button>
      <button type="button" role="tab" :aria-selected="tab === 'faq'" @click="tab = 'faq'">Preguntas frecuentes<span v-if="faqDirty"> •</span></button>
      <button type="button" role="tab" :aria-selected="tab === 'pages'" @click="tab = 'pages'">Páginas legales<span v-if="pageDirty"> •</span></button>
      <button type="button" role="tab" :aria-selected="tab === 'rules'" @click="tab = 'rules'">Reglas de compra<span v-if="rulesDirty"> •</span></button>
    </div>

    <StateView v-if="tab === 'home'" :loading="home.isPending.value || movies.isPending.value" :error="home.error.value ?? movies.error.value" skeleton="rows" @retry="home.refetch()">
      <div class="panel panel-pad section">
        <h2>Carrusel de la portada</h2>
        <p class="muted small">El orden es el del carrusel. Hasta 8 películas o eventos.</p>
        <ol class="featured" role="list">
          <li v-for="(movieId, index) in featured" :key="movieId">
            <span class="n">{{ index + 1 }}</span>
            <strong>{{ title(movieId) }}</strong>
            <button type="button" class="icon-btn" :disabled="index === 0" :aria-label="`Subir ${title(movieId)}`" @click="move(index, -1)"><ArrowUp :size="16" /></button>
            <button type="button" class="icon-btn" :disabled="index === featured.length - 1" :aria-label="`Bajar ${title(movieId)}`" @click="move(index, 1)"><ArrowDown :size="16" /></button>
            <button type="button" class="icon-btn danger" :aria-label="`Quitar ${title(movieId)} de la portada`" @click="featured.splice(index, 1)"><Trash2 :size="16" /></button>
          </li>
        </ol>
        <div class="add">
          <label for="portada-agregar" class="visually-hidden">Película para agregar</label>
          <select id="portada-agregar" v-model="toAdd" class="select">
            <option value="">Elige una película…</option>
            <option v-for="m in candidates" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
          <button type="button" class="btn btn-secondary" :disabled="!toAdd || featured.length >= 8" @click="featured.push(toAdd); toAdd = ''"><Plus :size="16" /> Agregar</button>
        </div>
        <div class="save"><button type="button" class="btn btn-primary" :disabled="!homeDirty || !featured.length || saveHome.isPending.value" @click="saveHome.mutate()"><Check :size="16" /> Guardar portada</button></div>
      </div>
    </StateView>

    <StateView v-else-if="tab === 'banners'" :loading="banners.isPending.value" :error="banners.error.value" :empty="!banners.data.value?.length" skeleton="rows" empty-title="Sin banners" @retry="banners.refetch()">
      <div class="panel table-wrap">
        <table class="data">
          <thead><tr><th>Banner</th><th>Enlace</th><th>Vigencia</th><th>Dónde</th><th>Estado</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            <tr v-for="b in banners.data.value" :key="b.id">
              <td><span class="stack"><strong>{{ b.title }}</strong><small>{{ b.imageUrl }}</small></span></td>
              <td>{{ b.targetUrl }}</td>
              <td>{{ formatDate(b.startsOn, 'short') }} – {{ b.endsOn ? formatDate(b.endsOn, 'short') : 'sin fin' }}</td>
              <td>{{ b.appliesToAll ? 'Toda la cadena' : b.complexIds.map(store.complexName).join(', ') }}</td>
              <td><span class="pill" :class="bannerState(b).tone">{{ bannerState(b).label }}</span></td>
              <td class="actions-col">
                <div class="row-actions">
                  <button type="button" class="action" :aria-label="`Editar ${b.title}`" @click="bannerDialog = { banner: b }"><Pencil :size="15" /> Editar</button>
                  <button type="button" class="action danger" :aria-label="`Eliminar ${b.title}`" @click="deleteBanner(b)"><Trash2 :size="15" /> Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </StateView>

    <StateView v-else-if="tab === 'faq'" :loading="faq.isPending.value" :error="faq.error.value" skeleton="rows" @retry="faq.refetch()">
      <div class="panel panel-pad section">
        <div v-for="(item, index) in faqItems" :key="index" class="faq">
          <div class="field">
            <label :for="`faq-q-${index}`">Pregunta {{ index + 1 }}</label>
            <input :id="`faq-q-${index}`" v-model="item.question" class="input" maxlength="300" />
          </div>
          <div class="field">
            <label :for="`faq-a-${index}`">Respuesta</label>
            <textarea :id="`faq-a-${index}`" v-model="item.answer" class="textarea" maxlength="2000" />
          </div>
          <button type="button" class="icon-btn danger" :aria-label="`Quitar la pregunta ${index + 1}`" @click="faqItems.splice(index, 1)"><Trash2 :size="16" /></button>
        </div>
        <button type="button" class="btn btn-secondary" @click="faqItems.push({ question: '', answer: '' })"><Plus :size="16" /> Agregar pregunta</button>
        <p v-if="!faqValid" class="field-error">Completa o quita las preguntas vacías.</p>
        <div class="save"><button type="button" class="btn btn-primary" :disabled="!faqDirty || !faqValid || saveFaq.isPending.value" @click="saveFaq.mutate()"><Check :size="16" /> Guardar preguntas</button></div>
      </div>
    </StateView>

    <StateView v-else-if="tab === 'pages'" :loading="pages.isPending.value" :error="pages.error.value" skeleton="rows" @retry="pages.refetch()">
      <div v-if="pageDraft" class="panel panel-pad section">
        <div class="field narrow">
          <label for="pagina">Página</label>
          <select id="pagina" class="select" :value="pageSlug" @change="changePage">
            <option v-for="page in pages.data.value" :key="page.slug" :value="page.slug">{{ page.title }}</option>
          </select>
        </div>
        <div class="field"><label for="pagina-titulo">Título</label><input id="pagina-titulo" v-model="pageDraft.title" class="input" maxlength="120" /></div>
        <div class="field">
          <label for="pagina-texto">Texto</label>
          <textarea id="pagina-texto" v-model="pageDraft.body" class="textarea tall" maxlength="20000" />
          <p class="field-hint">Texto simple: cada salto de línea doble es un párrafo. El texto definitivo lo valida el área jurídica.</p>
        </div>
        <div class="save"><button type="button" class="btn btn-primary" :disabled="!pageDirty || !pageDraft.title.trim() || !pageDraft.body.trim() || savePage.isPending.value" @click="savePage.mutate()"><Check :size="16" /> Guardar página</button></div>
      </div>
    </StateView>

    <StateView v-else :loading="rules.isPending.value" :error="rules.error.value" skeleton="rows" @retry="rules.refetch()">
      <div v-if="rulesDraft" class="panel panel-pad section">
        <div class="form-grid">
          <div v-for="limit in LIMITS" :key="limit.key" class="field">
            <label :for="`regla-${limit.key}`">{{ limit.label }}</label>
            <input :id="`regla-${limit.key}`" v-model.number="rulesDraft[limit.key]" class="input" type="number" :min="limit.min" :max="limit.max" />
            <p class="field-hint">De {{ limit.min }} a {{ limit.max }}.</p>
          </div>
        </div>
        <p class="notice small">Los pedidos de dulcería en línea exigen un folio vigente del mismo complejo. Estas reglas viven hoy en una tabla de configuración que falta en la base de datos.</p>
        <div class="save"><button type="button" class="btn btn-primary" :disabled="!rulesDirty || !rulesValid || saveRules.isPending.value" @click="saveRules.mutate()"><Check :size="16" /> Guardar reglas</button></div>
      </div>
    </StateView>

    <BannerDialog :open="!!bannerDialog" :banner="bannerDialog?.banner ?? null" @close="bannerDialog = null" />
  </section>
</template>

<style scoped>
.section { display: grid; gap: 14px; }
.section h2 { font: 700 17px var(--font-title); }
.featured { display: grid; gap: 6px; }
.featured li { padding: 8px 10px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: var(--radius-s); }
.featured strong { flex: 1; }
.n { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--selection); color: var(--blue); font-weight: 700; font-size: 13px; }
.add { display: flex; gap: 8px; max-width: 520px; }
.save { display: flex; justify-content: flex-end; }
.faq { padding: 12px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto; gap: 12px; align-items: start; border: 1px solid var(--line); border-radius: var(--radius-s); }
.narrow { max-width: 360px; }
.tall { min-height: 260px; }
@media (max-width: 900px) { .faq { grid-template-columns: minmax(0, 1fr); } }
</style>
