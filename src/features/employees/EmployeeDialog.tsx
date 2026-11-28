import { useId, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useRoles } from '@/app/queries'
import { useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { EMPLOYEE_STATUS_LABELS } from '@/domain/labels'
import type { Employee, EmployeeStatus } from '@/domain/models'
import BaseDialog from '@/shared/ui/BaseDialog'
import MoneyInput from '@/shared/ui/MoneyInput'
import { useDraft } from '@/shared/hooks/draft'
import { toast, toastError } from '@/shared/hooks/feedback'
import { addDays } from '@/shared/lib/datetime'

interface Draft {
  firstName: string; lastName: string; secondLastName: string; email: string; phone: string; birthDate: string; hiredOn: string
  salaryCents: number | null; status: EmployeeStatus; complexId: string; roleId: string
}
const STATUSES = Object.entries(EMPLOYEE_STATUS_LABELS) as [EmployeeStatus, string][]

export default function EmployeeDialog({ open, employee, onClose }: { open: boolean; employee: Employee | null; onClose: () => void }) {
  const store = useSession()
  const { employees } = useServices()
  const roles = useRoles()
  const queryClient = useQueryClient()
  const id = useId()

  const { draft: d, update, dirty, touched, setTouched } = useDraft<Draft>(open, () => employee
    ? { firstName: employee.firstName, lastName: employee.lastName, secondLastName: employee.secondLastName ?? '', email: employee.email ?? '', phone: employee.phone ?? '',
        birthDate: employee.birthDate, hiredOn: employee.hiredOn, salaryCents: employee.salaryCents, status: employee.status, complexId: employee.complexId, roleId: employee.roleId }
    : { firstName: '', lastName: '', secondLastName: '', email: '', phone: '', birthDate: '', hiredOn: store.today(), salaryCents: null, status: 'active',
        complexId: store.complexes[0]?.id ?? '', roleId: roles.data?.[0]?.id ?? '' })

  const errors = {
    name: d.firstName.trim() && d.lastName.trim() ? null : 'Escribe el nombre y el apellido paterno.',
    email: !d.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) ? null : 'Escribe un correo válido.',
    phone: !d.phone.trim() || /^\d{10}$/.test(d.phone.trim()) ? null : 'El teléfono tiene 10 dígitos.',
    birth: d.birthDate && d.birthDate <= addDays(d.hiredOn || store.today(), -16 * 365) ? null : 'Debe tener al menos 16 años al contratarse.',
    salary: d.salaryCents !== null && d.salaryCents > 0 ? null : 'Escribe el salario mensual.',
    assignment: d.complexId && d.roleId ? null : 'Elige el complejo y el puesto.'
  }
  const valid = Object.values(errors).every(e => !e)
  const show = (key: keyof typeof errors) => touched ? errors[key] : null

  const save = useMutation({
    mutationFn: () => {
      const input = {
        firstName: d.firstName.trim(), lastName: d.lastName.trim(), secondLastName: d.secondLastName.trim() || null, email: d.email.trim().toLowerCase() || null,
        phone: d.phone.trim() || null, birthDate: d.birthDate, hiredOn: d.hiredOn, salaryCents: d.salaryCents!, status: d.status, complexId: d.complexId, roleId: d.roleId
      }
      return employee ? employees.update(employee.id, { ...input, version: employee.version }) : employees.create(input)
    },
    onSuccess: saved => {
      void queryClient.invalidateQueries({ queryKey: keys.employees() })
      void queryClient.invalidateQueries({ queryKey: keys.activity() })
      toast(`${saved.firstName} ${saved.lastName} se guardó.`)
      onClose()
    },
    onError: toastError
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (valid) save.mutate()
  }

  return (
    <BaseDialog open={open} label={employee ? `Editar a ${employee.firstName} ${employee.lastName}` : 'Registrar empleado'} eyebrow="Personal" size="large" dirty={dirty} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form={`${id}-form`} className="btn btn-primary" disabled={save.isPending}>Guardar</button>
      </>}>
      <form id={`${id}-form`} className="form-grid" noValidate onSubmit={submit}>
        <h3 className="form-section">Datos personales</h3>
        <div className="field"><label htmlFor={`${id}-first`}>Nombre *</label><input id={`${id}-first`} value={d.firstName} onChange={e => update({ firstName: e.target.value })} className="input" maxLength={60} autoComplete="off" /></div>
        <div className="field"><label htmlFor={`${id}-last`}>Apellido paterno *</label><input id={`${id}-last`} value={d.lastName} onChange={e => update({ lastName: e.target.value })} className="input" maxLength={60} autoComplete="off" /></div>
        <div className="field"><label htmlFor={`${id}-second`}>Apellido materno</label><input id={`${id}-second`} value={d.secondLastName} onChange={e => update({ secondLastName: e.target.value })} className="input" maxLength={60} autoComplete="off" /></div>
        <div className="field">
          <label htmlFor={`${id}-birth`}>Fecha de nacimiento *</label>
          <input id={`${id}-birth`} value={d.birthDate} onChange={e => update({ birthDate: e.target.value })} className="input" type="date" />
          <p className="field-error">{show('birth')}</p>
        </div>
        <p className="field-error full">{show('name')}</p>
        <div className="field">
          <label htmlFor={`${id}-email`}>Correo</label>
          <input id={`${id}-email`} value={d.email} onChange={e => update({ email: e.target.value })} className="input" type="email" autoComplete="off" />
          <p className="field-error">{show('email')}</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>Teléfono</label>
          <input id={`${id}-phone`} value={d.phone} onChange={e => update({ phone: e.target.value })} className="input" inputMode="tel" maxLength={10} autoComplete="off" />
          <p className="field-error">{show('phone')}</p>
        </div>

        <h3 className="form-section">Puesto</h3>
        <div className="field">
          <label htmlFor={`${id}-complex`}>Complejo *</label>
          <select id={`${id}-complex`} value={d.complexId} onChange={e => update({ complexId: e.target.value })} className="select">
            {store.complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-role`}>Puesto *</label>
          <select id={`${id}-role`} value={d.roleId} onChange={e => update({ roleId: e.target.value })} className="select">
            {roles.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-hired`}>Fecha de contratación *</label>
          <input id={`${id}-hired`} value={d.hiredOn} onChange={e => update({ hiredOn: e.target.value })} className="input" type="date" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-salary`}>Salario mensual *</label>
          <MoneyInput id={`${id}-salary`} value={d.salaryCents} onChange={salaryCents => update({ salaryCents })} />
          <p className="field-error">{show('salary')}</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-status`}>Estado</label>
          <select id={`${id}-status`} value={d.status} onChange={e => update({ status: e.target.value as EmployeeStatus })} className="select">
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="field-hint">Los empleados no se borran: tienen turnos y ventas ligadas. Se dan de baja.</p>
        </div>
        <p className="field-error full">{show('assignment')}</p>
      </form>
    </BaseDialog>
  )
}
