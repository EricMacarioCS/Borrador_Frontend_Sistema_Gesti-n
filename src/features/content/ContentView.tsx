import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import BannerDialog from './BannerDialog'
import { keys, useBanners, useFaq, useHomeContent, useMovies, usePages, usePurchaseRules } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Banner, FaqItem, InfoPage, PurchaseRules } from '@/domain/models'
import { movieStage } from '@/domain/rules'
import StateView from '@/shared/ui/StateView'
import { useDirtyGuard } from '@/shared/hooks/dirty'
import { numberValue, useSyncedState } from '@/shared/hooks/draft'
import { confirmAction, toast, toastError } from '@/shared/hooks/feedback'
import { formatDate } from '@/shared/lib/datetime'
import './ContentView.css'

type Tab = 'home' | 'banners' | 'faq' | 'pages' | 'rules'

const LIMITS = [
  { key: 'maxSeatsPerPurchase', label: 'Asientos por compra', min: 1, max: 30 },
  { key: 'holdMinutes', label: 'Minutos de apartado', min: 5, max: 30 },
  { key: 'cancelMinutesBefore', label: 'Minutos límite para cancelar antes de la función', min: 0, max: 1440 },
  { key: 'scheduleDays', label: 'Días de cartelera visibles', min: 1, max: 60 }
] as const

export default function ContentView() {
  const store = useSession()
  const { content } = useServices()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('home')

  const home = useHomeContent()
  const movies = useMovies()
  const banners = useBanners()
  const faq = useFaq()
  const pages = usePages()
  const rules = usePurchaseRules()

  /* Portada */
  const [featured, setFeatured] = useSyncedState([home.data], () => [...(home.data?.featuredMovieIds ?? [])])
  const [toAdd, setToAdd] = useState('')
  const homeDirty = JSON.stringify(featured) !== JSON.stringify(home.data?.featuredMovieIds ?? [])
  const candidates = (movies.data ?? []).filter(m => !featured.includes(m.id) && movieStage(m, store.today()) !== 'finished')
  const title = (id: string) => movies.data?.find(m => m.id === id)?.title ?? 'Película retirada'
  function move(index: number, step: number) {
    const list = [...featured]
    const [item] = list.splice(index, 1)
    list.splice(index + step, 0, item!)
    setFeatured(list)
  }
  const saveHome = useMutation({
    mutationFn: () => content.saveHome({ version: home.data!.version, featuredMovieIds: featured }),
    onSuccess: saved => { queryClient.setQueryData(keys.home(), saved); toast('Portada guardada.') },
    onError: toastError
  })

  /* Banners */
  const [bannerDialog, setBannerDialog] = useState<{ banner: Banner | null } | null>(null)
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
  const [faqItems, setFaqItems] = useSyncedState<FaqItem[]>([faq.data], () => (faq.data?.items ?? []).map(item => ({ ...item })))
  const faqDirty = JSON.stringify(faqItems) !== JSON.stringify(faq.data?.items ?? [])
  const faqValid = faqItems.every(item => item.question.trim() && item.answer.trim())
  const updateFaq = (index: number, patch: Partial<FaqItem>) => setFaqItems(items => items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const saveFaq = useMutation({
    mutationFn: () => content.saveFaq({ version: faq.data!.version, items: faqItems.map(i => ({ question: i.question.trim(), answer: i.answer.trim() })) }),
    onSuccess: saved => { queryClient.setQueryData(keys.faq(), saved); toast('Preguntas frecuentes guardadas.') },
    onError: toastError
  })

  /* Páginas */
  const [chosenSlug, setChosenSlug] = useState('')
  const pageSlug = chosenSlug || pages.data?.[0]?.slug || ''
  const savedPage = pages.data?.find(p => p.slug === pageSlug)
  const [pageDraft, setPageDraft] = useSyncedState<InfoPage | null>([savedPage], () => (savedPage ? { ...savedPage } : null))
  const pageDirty = Boolean(savedPage && pageDraft && (savedPage.title !== pageDraft.title || savedPage.body !== pageDraft.body))
  async function changePage(slug: string) {
    if (pageDirty && !await confirmAction({ title: 'Descartar cambios', text: 'La página tiene cambios sin guardar.', confirmLabel: 'Descartar', danger: true })) return
    setChosenSlug(slug)
  }
  const savePage = useMutation({
    mutationFn: () => content.savePage({ ...pageDraft!, title: pageDraft!.title.trim(), body: pageDraft!.body.trim() }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: keys.pages() }); toast('Página guardada.') },
    onError: toastError
  })

  /* Reglas de compra */
  const [rulesDraft, setRulesDraft] = useSyncedState<PurchaseRules | null>([rules.data], () => (rules.data ? { ...rules.data } : null))
  const rulesDirty = JSON.stringify(rulesDraft) !== JSON.stringify(rules.data ?? null)
  const rulesValid = rulesDraft !== null && LIMITS.every(l => {
    const value = rulesDraft[l.key]
    return Number.isInteger(value) && value >= l.min && value <= l.max
  })
  const saveRules = useMutation({
    mutationFn: () => content.savePurchaseRules(rulesDraft!),
    onSuccess: saved => { queryClient.setQueryData(keys.purchaseRules(), saved); toast('Reglas de compra guardadas.') },
    onError: toastError
  })

  useDirtyGuard(homeDirty || faqDirty || pageDirty || rulesDirty)

  const dot = (dirty: boolean) => dirty && <span> •</span>
  return (
    <section className="content-view">
      <div className="page-head">
        <div>
          <h1>Contenido web</h1>
          <p>Lo que el sitio público muestra: portada, banners, preguntas frecuentes, textos legales y reglas de compra.</p>
        </div>
        {tab === 'banners' && <button type="button" className="btn btn-primary" onClick={() => setBannerDialog({ banner: null })}><Plus size={16} /> Nuevo banner</button>}
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones del contenido">
        <button type="button" role="tab" aria-selected={tab === 'home'} onClick={() => setTab('home')}>Portada{dot(homeDirty)}</button>
        <button type="button" role="tab" aria-selected={tab === 'banners'} onClick={() => setTab('banners')}>Banners</button>
        <button type="button" role="tab" aria-selected={tab === 'faq'} onClick={() => setTab('faq')}>Preguntas frecuentes{dot(faqDirty)}</button>
        <button type="button" role="tab" aria-selected={tab === 'pages'} onClick={() => setTab('pages')}>Páginas legales{dot(pageDirty)}</button>
        <button type="button" role="tab" aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>Reglas de compra{dot(rulesDirty)}</button>
      </div>

      {tab === 'home' && (
        <StateView loading={home.isPending || movies.isPending} error={home.error ?? movies.error} skeleton="rows" onRetry={() => void home.refetch()}>
          <div className="panel panel-pad section">
            <h2>Carrusel de la portada</h2>
            <p className="muted small">El orden es el del carrusel. Hasta 8 películas o eventos.</p>
            <ol className="featured" role="list">
              {featured.map((movieId, index) => (
                <li key={movieId}>
                  <span className="n">{index + 1}</span>
                  <strong>{title(movieId)}</strong>
                  <button type="button" className="icon-btn" disabled={index === 0} aria-label={`Subir ${title(movieId)}`} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
                  <button type="button" className="icon-btn" disabled={index === featured.length - 1} aria-label={`Bajar ${title(movieId)}`} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
                  <button type="button" className="icon-btn danger" aria-label={`Quitar ${title(movieId)} de la portada`} onClick={() => setFeatured(featured.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
                </li>
              ))}
            </ol>
            <div className="add">
              <label htmlFor="portada-agregar" className="visually-hidden">Película para agregar</label>
              <select id="portada-agregar" value={toAdd} onChange={e => setToAdd(e.target.value)} className="select">
                <option value="">Elige una película…</option>
                {candidates.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" disabled={!toAdd || featured.length >= 8} onClick={() => { setFeatured([...featured, toAdd]); setToAdd('') }}><Plus size={16} /> Agregar</button>
            </div>
            <div className="save"><button type="button" className="btn btn-primary" disabled={!homeDirty || !featured.length || saveHome.isPending} onClick={() => saveHome.mutate()}><Check size={16} /> Guardar portada</button></div>
          </div>
        </StateView>
      )}

      {tab === 'banners' && (
        <StateView loading={banners.isPending} error={banners.error} empty={!banners.data?.length} skeleton="rows" emptyTitle="Sin banners" onRetry={() => void banners.refetch()}>
          <div className="panel table-wrap">
            <table className="data">
              <thead><tr><th>Banner</th><th>Enlace</th><th>Vigencia</th><th>Dónde</th><th>Estado</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {banners.data?.map(b => (
                  <tr key={b.id}>
                    <td><span className="stack"><strong>{b.title}</strong><small>{b.imageUrl}</small></span></td>
                    <td>{b.targetUrl}</td>
                    <td>{formatDate(b.startsOn, 'short')} – {b.endsOn ? formatDate(b.endsOn, 'short') : 'sin fin'}</td>
                    <td>{b.appliesToAll ? 'Toda la cadena' : b.complexIds.map(store.complexName).join(', ')}</td>
                    <td><span className={`pill ${bannerState(b).tone}`}>{bannerState(b).label}</span></td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button type="button" className="action" aria-label={`Editar ${b.title}`} onClick={() => setBannerDialog({ banner: b })}><Pencil size={15} /> Editar</button>
                        <button type="button" className="action danger" aria-label={`Eliminar ${b.title}`} onClick={() => void deleteBanner(b)}><Trash2 size={15} /> Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateView>
      )}

      {tab === 'faq' && (
        <StateView loading={faq.isPending} error={faq.error} skeleton="rows" onRetry={() => void faq.refetch()}>
          <div className="panel panel-pad section">
            {faqItems.map((item, index) => (
              <div key={index} className="faq">
                <div className="field">
                  <label htmlFor={`faq-q-${index}`}>Pregunta {index + 1}</label>
                  <input id={`faq-q-${index}`} value={item.question} onChange={e => updateFaq(index, { question: e.target.value })} className="input" maxLength={300} />
                </div>
                <div className="field">
                  <label htmlFor={`faq-a-${index}`}>Respuesta</label>
                  <textarea id={`faq-a-${index}`} value={item.answer} onChange={e => updateFaq(index, { answer: e.target.value })} className="textarea" maxLength={2000} />
                </div>
                <button type="button" className="icon-btn danger" aria-label={`Quitar la pregunta ${index + 1}`} onClick={() => setFaqItems(faqItems.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={() => setFaqItems([...faqItems, { question: '', answer: '' }])}><Plus size={16} /> Agregar pregunta</button>
            {!faqValid && <p className="field-error">Completa o quita las preguntas vacías.</p>}
            <div className="save"><button type="button" className="btn btn-primary" disabled={!faqDirty || !faqValid || saveFaq.isPending} onClick={() => saveFaq.mutate()}><Check size={16} /> Guardar preguntas</button></div>
          </div>
        </StateView>
      )}

      {tab === 'pages' && (
        <StateView loading={pages.isPending} error={pages.error} skeleton="rows" onRetry={() => void pages.refetch()}>
          {pageDraft && (
            <div className="panel panel-pad section">
              <div className="field narrow">
                <label htmlFor="pagina">Página</label>
                <select id="pagina" className="select" value={pageSlug} onChange={e => void changePage(e.target.value)}>
                  {pages.data?.map(page => <option key={page.slug} value={page.slug}>{page.title}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="pagina-titulo">Título</label><input id="pagina-titulo" value={pageDraft.title} onChange={e => setPageDraft({ ...pageDraft, title: e.target.value })} className="input" maxLength={120} /></div>
              <div className="field">
                <label htmlFor="pagina-texto">Texto</label>
                <textarea id="pagina-texto" value={pageDraft.body} onChange={e => setPageDraft({ ...pageDraft, body: e.target.value })} className="textarea tall" maxLength={20000} />
                <p className="field-hint">Texto simple: cada salto de línea doble es un párrafo. El texto definitivo lo valida el área jurídica.</p>
              </div>
              <div className="save"><button type="button" className="btn btn-primary" disabled={!pageDirty || !pageDraft.title.trim() || !pageDraft.body.trim() || savePage.isPending} onClick={() => savePage.mutate()}><Check size={16} /> Guardar página</button></div>
            </div>
          )}
        </StateView>
      )}

      {tab === 'rules' && (
        <StateView loading={rules.isPending} error={rules.error} skeleton="rows" onRetry={() => void rules.refetch()}>
          {rulesDraft && (
            <div className="panel panel-pad section">
              <div className="form-grid">
                {LIMITS.map(limit => (
                  <div key={limit.key} className="field">
                    <label htmlFor={`regla-${limit.key}`}>{limit.label}</label>
                    <input id={`regla-${limit.key}`} value={numberValue(rulesDraft[limit.key])} onChange={e => setRulesDraft({ ...rulesDraft, [limit.key]: e.target.valueAsNumber })}
                      className="input" type="number" min={limit.min} max={limit.max} />
                    <p className="field-hint">De {limit.min} a {limit.max}.</p>
                  </div>
                ))}
              </div>
              <p className="notice small">Los pedidos de dulcería en línea exigen un folio vigente del mismo complejo. Estas reglas viven hoy en una tabla de configuración que falta en la base de datos.</p>
              <div className="save"><button type="button" className="btn btn-primary" disabled={!rulesDirty || !rulesValid || saveRules.isPending} onClick={() => saveRules.mutate()}><Check size={16} /> Guardar reglas</button></div>
            </div>
          )}
        </StateView>
      )}

      <BannerDialog open={!!bannerDialog} banner={bannerDialog?.banner ?? null} onClose={() => setBannerDialog(null)} />
    </section>
  )
}
