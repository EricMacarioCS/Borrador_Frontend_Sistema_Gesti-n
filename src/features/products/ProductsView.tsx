import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, PackageMinus, Pencil, Plus, Search } from 'lucide-react'
import CatalogEntryDialog from './CatalogEntryDialog'
import ProductDialog from './ProductDialog'
import { keys, useCatalog, useCategories, usePriceHistory, useProducts } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { STRUCTURE_LABELS } from '@/domain/labels'
import type { CatalogEntry, Product } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import StateView from '@/shared/ui/StateView'
import { confirmAction, toast, toastError } from '@/shared/hooks/feedback'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { normalizeText } from '@/shared/lib/text'
import './ProductsView.css'

type Tab = 'catalog' | 'products' | 'history'

const activeOptions = (entry: CatalogEntry) => {
  const total = entry.product.rules.reduce((sum, rule) => sum + rule.options.length, 0)
  return total ? `${entry.optionSettings.filter(s => s.active).length} de ${total}` : '—'
}

export default function ProductsView() {
  const store = useSession()
  const { products: port } = useServices()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('catalog')
  const [complexId, setComplexIdState] = useState(store.complexes[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  // Solo el administrador define productos de la cadena; cada complejo decide su catálogo.
  const chainAdmin = store.chainAdmin
  const catalog = useCatalog(complexId)
  const productsQuery = useProducts()
  const categories = useCategories()
  const history = usePriceHistory(complexId, tab === 'history')
  function setComplexId(id: string) {
    setComplexIdState(id)
    setSearch('')
  }

  const matches = (text: string) => normalizeText(text).includes(normalizeText(search))
  const entries = (catalog.data ?? [])
    .filter(entry => (!category || entry.product.category.id === category) && matches(`${entry.product.name} ${entry.product.category.name}`))
    .sort((a, b) => a.product.category.name.localeCompare(b.product.category.name) || a.product.name.localeCompare(b.product.name))
  const chainProducts = (productsQuery.data ?? [])
    .filter(product => (!category || product.category.id === category) && matches(`${product.name} ${product.category.name}`))
  const candidates = (productsQuery.data ?? []).filter(product => !catalog.data?.some(entry => entry.product.id === product.id))

  /* Sin inventario: el personal marca a mano si el producto está disponible en el complejo. */
  const [toggling, setToggling] = useState<string | null>(null)
  const setAvailability = useMutation({
    mutationFn: (entry: CatalogEntry) => port.setAvailability(complexId, entry.product.id, entry.version, !entry.available),
    onMutate: entry => { setToggling(entry.product.id) },
    onSuccess: updated => {
      void queryClient.invalidateQueries({ queryKey: keys.catalog(updated.complexId) })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`${updated.product.name} quedó ${updated.available ? 'disponible' : 'no disponible'} en ${store.complexName(updated.complexId)}.`)
    },
    onError: error => {
      void queryClient.invalidateQueries({ queryKey: keys.catalog(complexId) })
      toastError(error)
    },
    onSettled: () => { setToggling(null) }
  })

  /* Ventanas */
  const [entryDialog, setEntryDialog] = useState<{ entry: CatalogEntry | null } | null>(null)
  const [productDialog, setProductDialog] = useState<{ product: Product | null } | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')

  const removeEntry = useMutation({
    mutationFn: (entry: CatalogEntry) => port.removeCatalogEntry(complexId, entry.product.id, entry.version),
    onSuccess: (_, entry) => {
      void queryClient.invalidateQueries({ queryKey: keys.catalog(complexId) })
      void queryClient.invalidateQueries({ queryKey: keys.products() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`${entry.product.name} se quitó del catálogo de ${store.complexName(complexId)}.`)
    },
    onError: toastError
  })
  async function remove(entry: CatalogEntry) {
    const ok = await confirmAction({
      title: `Quitar ${entry.product.name}`, text: `Dejará de venderse en ${store.complexName(complexId)}. El producto sigue existiendo en la cadena y se puede volver a agregar.`,
      confirmLabel: 'Quitar del catálogo', danger: true
    })
    if (ok) removeEntry.mutate(entry)
  }

  const createCategory = useMutation({
    mutationFn: () => port.createCategory(categoryName.trim()),
    onSuccess: created => {
      void queryClient.invalidateQueries({ queryKey: keys.categories() })
      toast(`Se creó la categoría ${created.name}.`)
      setCategoryOpen(false)
      setCategoryName('')
    },
    onError: toastError
  })
  function submitCategory(event: FormEvent) {
    event.preventDefault()
    if (categoryName.trim()) createCategory.mutate()
  }

  const searchable = tab === 'catalog' || tab === 'products'
  return (
    <section className="products-view">
      <div className="page-head">
        <div>
          <h1>Dulcería</h1>
          <p>Los productos se definen una vez para toda la cadena; cada complejo decide cuáles vende, a qué precio y con qué opciones.</p>
        </div>
        <div className="page-actions">
          {tab === 'products' && chainAdmin ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setCategoryOpen(true)}><FolderPlus size={16} /> Nueva categoría</button>
              <button type="button" className="btn btn-primary" onClick={() => setProductDialog({ product: null })}><Plus size={16} /> Nuevo producto</button>
            </>
          ) : tab === 'catalog' && (
            <button type="button" className="btn btn-primary" disabled={!candidates.length} onClick={() => setEntryDialog({ entry: null })}>
              <Plus size={16} /> Agregar al catálogo
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones de dulcería">
        <button type="button" role="tab" aria-selected={tab === 'catalog'} onClick={() => setTab('catalog')}>Catálogo del complejo</button>
        <button type="button" role="tab" aria-selected={tab === 'products'} onClick={() => setTab('products')}>Productos de la cadena</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Historial de precios</button>
      </div>

      <div className="toolbar">
        {tab !== 'products' && (
          <div className="field">
            <label htmlFor="dulceria-complejo">Complejo</label>
            <select id="dulceria-complejo" value={complexId} onChange={e => setComplexId(e.target.value)} className="select">
              {store.complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {searchable && (
          <div className="field grow search">
            <label htmlFor="dulceria-buscar">Buscar</label>
            <Search size={17} aria-hidden="true" />
            <input id="dulceria-buscar" value={search} onChange={e => setSearch(e.target.value)} className="input" type="search" placeholder="Producto o categoría" />
          </div>
        )}
        {searchable && (
          <div className="field">
            <label htmlFor="dulceria-categoria">Categoría</label>
            <select id="dulceria-categoria" value={category} onChange={e => setCategory(e.target.value)} className="select">
              <option value="">Todas</option>
              {categories.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {tab === 'catalog' && (
        <StateView loading={catalog.isPending} error={catalog.error} empty={!entries.length} skeleton="rows"
          emptyTitle="Sin productos en este catálogo" emptyText="Agrega productos de la cadena o cambia los filtros." onRetry={() => void catalog.refetch()}>
          <div className="panel table-wrap">
            <table className="data">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="num">Precio aquí</th><th>Opciones activas</th><th>Disponible</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.product.id} className={entry.available ? undefined : 'row-off'}>
                    <td><span className="stack"><strong>{entry.product.name}</strong><small>{STRUCTURE_LABELS[entry.product.structure]}{entry.product.requiresTicketCode ? ' · requiere folio' : ' · sin folio'}</small></span></td>
                    <td>{entry.product.category.name}</td>
                    <td className="num">{formatMoney(entry.priceCents)}</td>
                    <td>{activeOptions(entry)}</td>
                    <td>
                      <button type="button" role="switch" className="switch" aria-checked={entry.available} disabled={toggling === entry.product.id}
                        aria-label={`${entry.product.name} disponible en ${store.complexName(complexId)}`} onClick={() => setAvailability.mutate(entry)}>
                        <span className="track" aria-hidden="true"><span className="thumb" /></span>
                        <span className="switch-label">{entry.available ? 'Disponible' : 'No disponible'}</span>
                      </button>
                    </td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button type="button" className="action" aria-label={`Editar ${entry.product.name}`} onClick={() => setEntryDialog({ entry })}><Pencil size={15} /> Precio y opciones</button>
                        <button type="button" className="action danger" aria-label={`Quitar ${entry.product.name} del catálogo`} onClick={() => void remove(entry)}><PackageMinus size={15} /> Quitar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateView>
      )}

      {tab === 'products' && (
        <>
          {!chainAdmin && <p className="notice small spaced">Solo el administrador puede crear o modificar productos de la cadena. Tú decides el catálogo de tu complejo.</p>}
          <StateView loading={productsQuery.isPending} error={productsQuery.error} empty={!chainProducts.length} skeleton="rows" onRetry={() => void productsQuery.refetch()}>
            <div className="panel table-wrap">
              <table className="data">
                <thead><tr><th>Producto</th><th>Categoría</th><th>Estructura</th><th>Personalización</th><th>Folio</th><th className="num">Complejos</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {chainProducts.map(product => (
                    <tr key={product.id}>
                      <td><span className="stack"><strong>{product.name}</strong><small>{product.description || 'Sin descripción'}</small></span></td>
                      <td>{product.category.name}</td>
                      <td>{STRUCTURE_LABELS[product.structure]}</td>
                      <td><span className="tags">{product.rules.map(rule => <span key={rule.id} className="tag">{rule.title} ({rule.options.length})</span>)}{!product.rules.length && <span className="muted small">Sin opciones</span>}</span></td>
                      <td>{product.requiresTicketCode ? 'Requiere' : 'No'}</td>
                      <td className="num">{product.complexCount}</td>
                      <td className="actions-col">{chainAdmin && <button type="button" className="action" aria-label={`Editar ${product.name}`} onClick={() => setProductDialog({ product })}><Pencil size={15} /> Editar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StateView>
        </>
      )}

      {tab === 'history' && (
        <StateView loading={history.isPending} error={history.error} empty={!history.data?.length} skeleton="rows"
          emptyTitle="Sin cambios de precio" emptyText="Cada cambio de precio en este complejo aparecerá aquí." onRetry={() => void history.refetch()}>
          <div className="panel table-wrap">
            <table className="data">
              <thead><tr><th>Fecha</th><th>Producto</th><th className="num">Antes</th><th className="num">Después</th><th className="num">Cambio</th></tr></thead>
              <tbody>
                {history.data?.map(change => (
                  <tr key={change.id}>
                    <td>{formatDateTime(change.changedAt)}</td>
                    <td><strong>{change.productName}</strong></td>
                    <td className="num">{formatMoney(change.previousCents)}</td>
                    <td className="num">{formatMoney(change.newCents)}</td>
                    <td className="num">{change.newCents >= change.previousCents ? '+' : '−'}{formatMoney(Math.abs(change.newCents - change.previousCents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateView>
      )}

      <CatalogEntryDialog open={!!entryDialog} complexId={complexId} entry={entryDialog?.entry ?? null} candidates={candidates} onClose={() => setEntryDialog(null)} />
      <ProductDialog open={!!productDialog} product={productDialog?.product ?? null} onClose={() => setProductDialog(null)} />
      <BaseDialog open={categoryOpen} label="Nueva categoría" size="small" dirty={!!categoryName} onClose={() => { setCategoryOpen(false); setCategoryName('') }}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => { setCategoryOpen(false); setCategoryName('') }}>Cancelar</button>
          <button type="submit" form="form-categoria" className="btn btn-primary" disabled={!categoryName.trim() || createCategory.isPending}>Crear categoría</button>
        </>}>
        <form id="form-categoria" className="field" onSubmit={submitCategory}>
          <label htmlFor="categoria-nombre">Nombre</label>
          <input id="categoria-nombre" value={categoryName} onChange={e => setCategoryName(e.target.value)} className="input" maxLength={60} data-autofocus />
        </form>
      </BaseDialog>
    </section>
  )
}
