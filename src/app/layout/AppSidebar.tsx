import { Link, NavLink } from 'react-router'
import { X } from 'lucide-react'
import { NAV_GROUPS, NAV_ITEMS } from '@/app/navigation'
import { useSession } from '@/app/stores/session'
import { useRouteHandle } from '@/App'
import './AppSidebar.css'

export default function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useSession()
  const handle = useRouteHandle()
  const groups = NAV_GROUPS
    .map(group => ({ group, items: NAV_ITEMS.filter(item => item.group === group && store.can(item.permission)) }))
    .filter(entry => entry.items.length)

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Menú principal">
      <div className="brand">
        <Link to="/" className="brand-link">
          <span className="mark" aria-hidden="true">c</span>
          <span className="copy"><strong>cinépolis</strong><small>Administración</small></span>
        </Link>
        <button type="button" className="icon-btn close" aria-label="Cerrar menú" onClick={onClose}><X size={18} /></button>
      </div>
      <nav className="nav">
        {groups.map(entry => (
          <div key={entry.group}>
            <p className="group">{entry.group}</p>
            {entry.items.map(item => {
              const Icon = item.icon
              const active = handle.name === item.name || (handle.name === 'schedule' && item.name === 'screenings')
              return (
                <NavLink key={item.name} to={item.path} end className={`link${active ? ' active' : ''}`}>
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
