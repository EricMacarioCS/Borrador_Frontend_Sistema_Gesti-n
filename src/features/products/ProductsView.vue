<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { FolderPlus, PackageMinus, Pencil, Plus, Search } from '@lucide/vue'
import CatalogEntryDialog from './CatalogEntryDialog.vue'
import ProductDialog from './ProductDialog.vue'
import { keys, useCatalog, useCategories, usePriceHistory, useProducts } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSessionStore } from '@/app/stores/session'
import { STRUCTURE_LABELS } from '@/domain/labels'
import type { CatalogEntry, Product } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import StateView from '@/shared/ui/StateView.vue'
import { confirmAction, toast, toastError } from '@/shared/composables/feedback'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { normalizeText } from '@/shared/lib/text'

type Tab = 'catalog' | 'products' | 'history'

const store = useSessionStore()
const { products: port } = useServices()
const queryClient = useQueryClient()
const tab = ref<Tab>('catalog')
const complexId = ref(store.complexes[0]?.id ?? '')
const search = ref('')
const category = ref('')

// Solo el administrador define productos de la cadena; cada complejo decide su catálogo.
const chainAdmin = computed(() => store.chainAdmin)
const catalog = useCatalog(complexId)
const productsQuery = useProducts()
const categories = useCategories()
const history = usePriceHistory(complexId, () => tab.value === 'history')
watch(complexId, () => { search.value = '' })

const matches = (text: string) => normalizeText(text).includes(normalizeText(search.value))
const entries = computed(() => (catalog.data.value ?? [])
  .filter(entry => (!category.value || entry.product.category.id === category.value) && matches(`${entry.product.name} ${entry.product.category.name}`))
  .sort((a, b) => a.product.category.name.localeCompare(b.product.category.name) || a.product.name.localeCompare(b.product.name)))
const chainProducts = computed(() => (productsQuery.data.value ?? [])
  .filter(product => (!category.value || product.category.id === category.value) && matches(`${product.name} ${product.category.name}`)))
const candidates = computed(() => (productsQuery.data.value ?? []).filter(product => !catalog.data.value?.some(entry => entry.product.id === product.id)))

const activeOptions = (entry: CatalogEntry) => {
  const total = entry.product.rules.reduce((sum, rule) => sum + rule.options.length, 0)
  return total ? `${entry.optionSettings.filter(s => s.active).length} de ${total}` : '—'
}

/* Sin inventario: el personal marca a mano si el producto está disponible en el complejo. */
const toggling = ref<string | null>(null)
const setAvailability = useMutation({
  mutationFn: (entry: CatalogEntry) => port.setAvailability(complexId.value, entry.product.id, entry.version, !entry.available),
  onMutate: entry => { toggling.value = entry.product.id },
  onSuccess: updated => {
    void queryClient.invalidateQueries({ queryKey: keys.catalog(updated.complexId) })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`${updated.product.name} quedó ${updated.available ? 'disponible' : 'no disponible'} en ${store.complexName(updated.complexId)}.`)
  },
  onError: error => {
    void queryClient.invalidateQueries({ queryKey: keys.catalog(complexId.value) })
    toastError(error)
  },
  onSettled: () => { toggling.value = null }
})

/* Ventanas */
const entryDialog = ref<{ entry: CatalogEntry | null } | null>(null)
const productDialog = ref<{ product: Product | null } | null>(null)
const categoryOpen = ref(false)
const categoryName = ref('')

const removeEntry = useMutation({
  mutationFn: (entry: CatalogEntry) => port.removeCatalogEntry(complexId.value, entry.product.id, entry.version),
  onSuccess: (_, entry) => {
    void queryClient.invalidateQueries({ queryKey: keys.catalog(complexId.value) })
    void queryClient.invalidateQueries({ queryKey: keys.products() })
    void queryClient.invalidateQueries({ queryKey: keys.activity() })
    toast(`${entry.product.name} se quitó del catálogo de ${store.complexName(complexId.value)}.`)
  },
  onError: toastError
})
async function remove(entry: CatalogEntry) {
  const ok = await confirmAction({
    title: `Quitar ${entry.product.name}`, text: `Dejará de venderse en ${store.complexName(complexId.value)}. El producto sigue existiendo en la cadena y se puede volver a agregar.`,
    confirmLabel: 'Quitar del catálogo', danger: true
  })
  if (ok) removeEntry.mutate(entry)
}

const createCategory = useMutation({
  mutationFn: () => port.createCategory(categoryName.value.trim()),
  onSuccess: created => {
    void queryClient.invalidateQueries({ queryKey: keys.categories() })
    toast(`Se creó la categoría ${created.name}.`)
    categoryOpen.value = false
    categoryName.value = ''
  },
  onError: toastError
})
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Dulcería</h1>
        <p>Los productos se definen una vez para toda la cadena; cada complejo decide cuáles vende, a qué precio y con qué opciones.</p>
      </div>
      <div class="page-actions">
        <template v-if="tab === 'products' && chainAdmin">
          <button type="button" class="btn btn-secondary" @click="categoryOpen = true"><FolderPlus :size="16" /> Nueva categoría</button>
          <button type="button" class="btn btn-primary" @click="productDialog = { product: null }"><Plus :size="16" /> Nuevo producto</button>
        </template>
        <button v-else-if="tab === 'catalog'" type="button" class="btn btn-primary" :disabled="!candidates.length" @click="entryDialog = { entry: null }">
          <Plus :size="16" /> Agregar al catálogo
        </button>
      </div>
    </div>

    <div class="tabs" role="tablist" aria-label="Secciones de dulcería">
      <button type="button" role="tab" :aria-selected="tab === 'catalog'" @click="tab = 'catalog'">Catálogo del complejo</button>
      <button type="button" role="tab" :aria-selected="tab === 'products'" @click="tab = 'products'">Productos de la cadena</button>
      <button type="button" role="tab" :aria-selected="tab === 'history'" @click="tab = 'history'">Historial de precios</button>
    </div>

    <div class="toolbar">
      <div v-if="tab !== 'products'" class="field">
        <label for="dulceria-complejo">Complejo</label>
        <select id="dulceria-complejo" v-model="complexId" class="select">
          <option v-for="c in store.complexes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div v-if="tab === 'catalog' || tab === 'products'" class="field grow search">
        <label for="dulceria-buscar">Buscar</label>
        <Search :size="17" aria-hidden="true" />
        <input id="dulceria-buscar" v-model="search" class="input" type="search" placeholder="Producto o categoría" />
      </div>
      <div v-if="tab === 'catalog' || tab === 'products'" class="field">
        <label for="dulceria-categoria">Categoría</label>
        <select id="dulceria-categoria" v-model="category" class="select">
          <option value="">Todas</option>
          <option v-for="c in categories.data.value" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>

    <template v-if="tab === 'catalog'">
      <StateView :loading="catalog.isPending.value" :error="catalog.error.value" :empty="!entries.length" skeleton="rows"
        empty-title="Sin productos en este catálogo" empty-text="Agrega productos de la cadena o cambia los filtros." @retry="catalog.refetch()">
        <div class="panel table-wrap">
          <table class="data">
            <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Precio aquí</th><th>Opciones activas</th><th>Disponible</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="entry in entries" :key="entry.product.id" :class="{ 'row-off': !entry.available }">
                <td><span class="stack"><strong>{{ entry.product.name }}</strong><small>{{ STRUCTURE_LABELS[entry.product.structure] }}{{ entry.product.requiresTicketCode ? ' · requiere folio' : ' · sin folio' }}</small></span></td>
                <td>{{ entry.product.category.name }}</td>
                <td class="num">{{ formatMoney(entry.priceCents) }}</td>
                <td>{{ activeOptions(entry) }}</td>
                <td>
                  <button type="button" role="switch" class="switch" :aria-checked="entry.available" :disabled="toggling === entry.product.id"
                    :aria-label="`${entry.product.name} disponible en ${store.complexName(complexId)}`" @click="setAvailability.mutate(entry)">
                    <span class="track" aria-hidden="true"><span class="thumb" /></span>
                    <span class="switch-label">{{ entry.available ? 'Disponible' : 'No disponible' }}</span>
                  </button>
                </td>
                <td class="actions-col">
                  <div class="row-actions">
                    <button type="button" class="action" :aria-label="`Editar ${entry.product.name}`" @click="entryDialog = { entry }"><Pencil :size="15" /> Precio y opciones</button>
                    <button type="button" class="action danger" :aria-label="`Quitar ${entry.product.name} del catálogo`" @click="remove(entry)"><PackageMinus :size="15" /> Quitar</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </StateView>
    </template>

    <template v-else-if="tab === 'products'">
      <p v-if="!chainAdmin" class="notice small spaced">Solo el administrador puede crear o modificar productos de la cadena. Tú decides el catálogo de tu complejo.</p>
      <StateView :loading="productsQuery.isPending.value" :error="productsQuery.error.value" :empty="!chainProducts.length" skeleton="rows" @retry="productsQuery.refetch()">
        <div class="panel table-wrap">
          <table class="data">
            <thead><tr><th>Producto</th><th>Categoría</th><th>Estructura</th><th>Personalización</th><th>Folio</th><th class="num">Complejos</th><th class="actions-col"><span class="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="product in chainProducts" :key="product.id">
                <td><span class="stack"><strong>{{ product.name }}</strong><small>{{ product.description || 'Sin descripción' }}</small></span></td>
                <td>{{ product.category.name }}</td>
                <td>{{ STRUCTURE_LABELS[product.structure] }}</td>
                <td><span class="tags"><span v-for="rule in product.rules" :key="rule.id" class="tag">{{ rule.title }} ({{ rule.options.length }})</span><span v-if="!product.rules.length" class="muted small">Sin opciones</span></span></td>
                <td>{{ product.requiresTicketCode ? 'Requiere' : 'No' }}</td>
                <td class="num">{{ product.complexCount }}</td>
                <td class="actions-col"><button v-if="chainAdmin" type="button" class="action" :aria-label="`Editar ${product.name}`" @click="productDialog = { product }"><Pencil :size="15" /> Editar</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </StateView>
    </template>

    <template v-else-if="tab === 'history'">
      <StateView :loading="history.isPending.value" :error="history.error.value" :empty="!history.data.value?.length" skeleton="rows"
        empty-title="Sin cambios de precio" empty-text="Cada cambio de precio en este complejo aparecerá aquí." @retry="history.refetch()">
        <div class="panel table-wrap">
          <table class="data">
            <thead><tr><th>Fecha</th><th>Producto</th><th class="num">Antes</th><th class="num">Después</th><th class="num">Cambio</th></tr></thead>
            <tbody>
              <tr v-for="change in history.data.value" :key="change.id">
                <td>{{ formatDateTime(change.changedAt) }}</td>
                <td><strong>{{ change.productName }}</strong></td>
                <td class="num">{{ formatMoney(change.previousCents) }}</td>
                <td class="num">{{ formatMoney(change.newCents) }}</td>
                <td class="num">{{ change.newCents >= change.previousCents ? '+' : '−' }}{{ formatMoney(Math.abs(change.newCents - change.previousCents)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </StateView>
    </template>

    <CatalogEntryDialog :open="!!entryDialog" :complex-id="complexId" :entry="entryDialog?.entry ?? null" :candidates="candidates" @close="entryDialog = null" />
    <ProductDialog :open="!!productDialog" :product="productDialog?.product ?? null" @close="productDialog = null" />
    <BaseDialog :open="categoryOpen" label="Nueva categoría" size="small" :dirty="!!categoryName" @close="categoryOpen = false">
      <form id="form-categoria" class="field" @submit.prevent="categoryName.trim() && createCategory.mutate()">
        <label for="categoria-nombre">Nombre</label>
        <input id="categoria-nombre" v-model="categoryName" class="input" maxlength="60" />
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="categoryOpen = false">Cancelar</button>
        <button type="submit" form="form-categoria" class="btn btn-primary" :disabled="!categoryName.trim() || createCategory.isPending.value">Crear categoría</button>
      </template>
    </BaseDialog>
  </section>
</template>

<style scoped>
.toolbar .search svg { top: auto; bottom: 11px; transform: none; }
.spaced { margin-bottom: 12px; }
.switch { display: inline-flex; align-items: center; gap: 8px; padding: 4px 0; border: 0; background: none; color: var(--ink); font: 600 13px var(--font-body); cursor: pointer; white-space: nowrap; }
.switch:disabled { cursor: progress; opacity: .6; }
.switch:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; border-radius: 6px; }
.track { position: relative; width: 36px; height: 20px; flex: none; border-radius: 999px; background: var(--line-strong); }
.thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / .2); }
.switch[aria-checked='true'] .track { background: var(--success); }
.switch[aria-checked='true'] .thumb { left: 18px; }
.switch[aria-checked='false'] .switch-label { color: var(--muted); }
</style>
