import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys } from '@/app/queries'
import { useServices } from '@/app/services'
import type { Role } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'

export default function RoleDialog({ open, role, onClose }: { open: boolean; role: Role | null; onClose: () => void }) {
  const { employees } = useServices()
  const queryClient = useQueryClient()
  const id = useId()
  const { draft, update, dirty } = useDraft(open, () => ({
    name: role?.name ?? '', isManager: role?.isManager ?? false, responsibilities: role?.responsibilities ?? '', area: role?.area ?? ''
  }))

  const save = useMutation({
    mutationFn: () => employees.saveRole({ id: role?.id ?? null, version: role?.version ?? 0, ...draft, name: draft.name.trim() }),
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.roles() })
      toast(`Puesto ${saved.name} guardado.`)
      onClose()
    },
    onError: toastError
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (draft.name.trim()) save.mutate()
  }

  return (
    <BaseDialog open={open} label={role ? `Editar ${role.name}` : 'Nuevo puesto'} eyebrow="Puestos" size="small" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={!draft.name.trim() || save.isPending}>Guardar</button>
      </>}>
      <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
        <div className="field full"><label htmlFor={`${id}-name`}>Nombre del puesto *</label><input id={`${id}-name`} value={draft.name} onChange={e => update({ name: e.target.value })} className="input" maxLength={80} /></div>
        <div className="field full"><label htmlFor={`${id}-area`}>Área</label><input id={`${id}-area`} value={draft.area} onChange={e => update({ area: e.target.value })} className="input" maxLength={80} placeholder="Ej. Dulcería" /></div>
        <div className="field full"><label htmlFor={`${id}-resp`}>Responsabilidades</label><textarea id={`${id}-resp`} value={draft.responsibilities} onChange={e => update({ responsibilities: e.target.value })} className="textarea" maxLength={1000} /></div>
        <label className="check full"><input checked={draft.isManager} onChange={e => update({ isManager: e.target.checked })} type="checkbox" /> Es un puesto de mando (gerencia o supervisión)</label>
      </form>
    </BaseDialog>
  )
}
