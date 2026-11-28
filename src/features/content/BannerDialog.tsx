import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import type { Banner, BannerInput } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import MultiSelect from '@/shared/ui/MultiSelect'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'

export default function BannerDialog({ open, banner, onClose }: { open: boolean; banner: Banner | null; onClose: () => void }) {
  const store = useSession()
  const { content } = useServices()
  const queryClient = useQueryClient()
  const id = useId()

  const blank = (): BannerInput => ({ title: '', imageUrl: '', targetUrl: '/', startsOn: store.today(), endsOn: null, active: true, appliesToAll: true, complexIds: [] })
  const { draft, update, dirty } = useDraft<BannerInput>(open, () => {
    const { id: _i, version: _v, ...rest } = banner ?? { id: '', version: 0, ...blank() }
    return { ...rest, complexIds: [...rest.complexIds] }
  })

  const problem = !draft.title.trim() || !draft.imageUrl.trim() ? 'Completa el título y la imagen.'
    : !draft.targetUrl.startsWith('/') && !draft.targetUrl.startsWith('https://') ? 'El enlace debe empezar con / o https://'
      : draft.endsOn && draft.endsOn < draft.startsOn ? 'El banner termina antes de empezar.'
        : !draft.appliesToAll && !draft.complexIds.length ? 'Elige los complejos o márcalo para toda la cadena.' : null
  const complexOptions = store.complexes.map(c => ({ value: c.id, label: c.name, group: c.cityName }))

  const save = useMutation({
    mutationFn: () => {
      const input = { ...draft, title: draft.title.trim(), endsOn: draft.endsOn || null, complexIds: draft.appliesToAll ? [] : draft.complexIds }
      return banner ? content.updateBanner(banner.id, { ...input, version: banner.version }) : content.createBanner(input)
    },
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.banners() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`Banner ${saved.title} guardado.`)
      onClose()
    },
    onError: toastError
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!problem) save.mutate()
  }

  return (
    <BaseDialog open={open} label={banner ? `Editar ${banner.title}` : 'Nuevo banner'} eyebrow="Contenido web" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={!!problem || save.isPending}>Guardar banner</button>
      </>}>
      <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
        <div className="field full"><label htmlFor={`${id}-title`}>Título *</label><input id={`${id}-title`} value={draft.title} onChange={e => update({ title: e.target.value })} className="input" maxLength={120} /></div>
        <div className="field full"><label htmlFor={`${id}-image`}>URL de la imagen *</label><input id={`${id}-image`} value={draft.imageUrl} onChange={e => update({ imageUrl: e.target.value })} className="input" placeholder="https://… o /banners/archivo.jpg" /></div>
        <div className="field full">
          <label htmlFor={`${id}-target`}>Enlace al pulsarlo *</label>
          <input id={`${id}-target`} value={draft.targetUrl} onChange={e => update({ targetUrl: e.target.value })} className="input" placeholder="/promociones" />
          <p className="field-hint">Una ruta del sitio (/promociones) o una dirección https://</p>
        </div>
        <div className="field"><label htmlFor={`${id}-start`}>Desde *</label><input id={`${id}-start`} value={draft.startsOn} onChange={e => update({ startsOn: e.target.value })} className="input" type="date" /></div>
        <div className="field"><label htmlFor={`${id}-end`}>Hasta</label><input id={`${id}-end`} value={draft.endsOn ?? ''} onChange={e => update({ endsOn: e.target.value })} className="input" type="date" min={draft.startsOn} /></div>
        <label className="check full"><input checked={draft.active} onChange={e => update({ active: e.target.checked })} type="checkbox" /> Activo</label>
        <label className="check full"><input checked={draft.appliesToAll} onChange={e => update({ appliesToAll: e.target.checked })} type="checkbox" /> Se muestra en toda la cadena</label>
        {!draft.appliesToAll && <MultiSelect value={draft.complexIds} onChange={complexIds => update({ complexIds })} className="full" label="Complejos *" options={complexOptions} />}
        {problem && dirty && <p className="field-error full">{problem}</p>}
      </form>
    </BaseDialog>
  )
}
