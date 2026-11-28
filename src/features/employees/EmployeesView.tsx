import { useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import EmployeeDialog from './EmployeeDialog'
import RoleDialog from './RoleDialog'
import { useEmployees, useRoles } from '@/app/queries'
import { useSession } from '@/app/stores/session'
import { EMPLOYEE_STATUS_LABELS } from '@/domain/labels'
import type { Employee, EmployeeStatus, Role } from '@/domain/models'
import StateView from '@/shared/ui/StateView'
import { normalizeText } from '@/shared/lib/text'
import './EmployeesView.css'

const fullName = (e: Employee) => [e.firstName, e.lastName, e.secondLastName].filter(Boolean).join(' ')
const tone = (s: EmployeeStatus) => s === 'active' ? 'success' : s === 'leave' ? 'warning' : 'muted'
const initials = (e: Employee) => `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase()
const STATUSES = Object.entries(EMPLOYEE_STATUS_LABELS) as [EmployeeStatus, string][]

export default function EmployeesView() {
  const store = useSession()
  const employees = useEmployees()
  const roles = useRoles()
  const [tab, setTab] = useState<'staff' | 'roles'>('staff')
  const [search, setSearch] = useState('')
  const [complexId, setComplexId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<EmployeeStatus | ''>('active')
  const [editing, setEditing] = useState<{ employee: Employee | null } | null>(null)
  const [editingRole, setEditingRole] = useState<{ role: Role | null } | null>(null)

  const roleName = (id: string) => roles.data?.find(r => r.id === id)?.name ?? '—'
  const shown = (employees.data ?? [])
    .filter(e => (!complexId || e.complexId === complexId) && (!roleId || e.roleId === roleId) && (!status || e.status === status))
    .filter(e => normalizeText(`${fullName(e)} ${e.email ?? ''} ${roleName(e.roleId)} ${store.complexName(e.complexId)}`).includes(normalizeText(search)))
    .sort((a, b) => store.complexName(a.complexId).localeCompare(store.complexName(b.complexId)) || a.lastName.localeCompare(b.lastName))

  return (
    <section className="employees-view">
      <div className="page-head">
        <div>
          <h1>Empleados</h1>
          <p>Personal de los complejos. Los salarios solo se muestran al editar un registro.</p>
        </div>
        {tab === 'staff' ? (
          <button type="button" className="btn btn-primary" disabled={!roles.data?.length} onClick={() => setEditing({ employee: null })}><Plus size={16} /> Registrar empleado</button>
        ) : store.chainAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setEditingRole({ role: null })}><Plus size={16} /> Nuevo puesto</button>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones de personal">
        <button type="button" role="tab" aria-selected={tab === 'staff'} onClick={() => setTab('staff')}>Personal</button>
        <button type="button" role="tab" aria-selected={tab === 'roles'} onClick={() => setTab('roles')}>Puestos</button>
      </div>

      {tab === 'staff' ? (
        <>
          <div className="toolbar">
            <div className="field grow search">
              <label htmlFor="emp-buscar">Buscar</label>
              <Search size={17} aria-hidden="true" />
              <input id="emp-buscar" value={search} onChange={e => setSearch(e.target.value)} className="input" type="search" placeholder="Nombre, correo, puesto o complejo" />
            </div>
            <div className="field">
              <label htmlFor="emp-complejo">Complejo</label>
              <select id="emp-complejo" value={complexId} onChange={e => setComplexId(e.target.value)} className="select">
                <option value="">Todos</option>
                {store.complexes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="emp-puesto">Puesto</label>
              <select id="emp-puesto" value={roleId} onChange={e => setRoleId(e.target.value)} className="select">
                <option value="">Todos</option>
                {roles.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="emp-estado">Estado</label>
              <select id="emp-estado" value={status} onChange={e => setStatus(e.target.value as EmployeeStatus | '')} className="select">
                <option value="">Todos</option>
                {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <span className="count">{shown.length} personas</span>
          </div>
          <StateView loading={employees.isPending} error={employees.error} empty={!shown.length} skeleton="rows" emptyTitle="Sin resultados" onRetry={() => void employees.refetch()}>
            <div className="panel table-wrap">
              <table className="data">
                <thead><tr><th>Empleado</th><th>Puesto</th><th>Complejo</th><th>Contacto</th><th>Estado</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {shown.map(e => (
                    <tr key={e.id}>
                      <td><span className="person"><span className="avatar" aria-hidden="true">{initials(e)}</span><strong>{fullName(e)}</strong></span></td>
                      <td>{roleName(e.roleId)}</td>
                      <td>{store.complexName(e.complexId)}</td>
                      <td><span className="stack"><span>{e.email ?? '—'}</span><small>{e.phone ?? ''}</small></span></td>
                      <td><span className={`pill ${tone(e.status)}`}>{EMPLOYEE_STATUS_LABELS[e.status]}</span></td>
                      <td className="actions-col"><button type="button" className="action" aria-label={`Editar a ${fullName(e)}`} onClick={() => setEditing({ employee: e })}><Pencil size={15} /> Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StateView>
        </>
      ) : (
        <>
          {!store.chainAdmin && <p className="notice small spaced">Los puestos son de toda la cadena: solo el administrador los crea o modifica.</p>}
          <StateView loading={roles.isPending} error={roles.error} skeleton="rows" onRetry={() => void roles.refetch()}>
            <div className="panel table-wrap">
              <table className="data">
                <thead><tr><th>Puesto</th><th>Área</th><th>Mando</th><th>Responsabilidades</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
                <tbody>
                  {roles.data?.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.area || '—'}</td>
                      <td>{r.isManager ? 'Sí' : 'No'}</td>
                      <td>{r.responsibilities || '—'}</td>
                      <td className="actions-col">{store.chainAdmin && <button type="button" className="action" aria-label={`Editar ${r.name}`} onClick={() => setEditingRole({ role: r })}><Pencil size={15} /> Editar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StateView>
        </>
      )}

      <EmployeeDialog open={!!editing} employee={editing?.employee ?? null} onClose={() => setEditing(null)} />
      <RoleDialog open={!!editingRole} role={editingRole?.role ?? null} onClose={() => setEditingRole(null)} />
    </section>
  )
}
