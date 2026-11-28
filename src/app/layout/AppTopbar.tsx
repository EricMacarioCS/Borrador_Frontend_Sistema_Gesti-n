import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu } from 'lucide-react'
import { useSession } from '@/app/stores/session'
import { useRouteHandle } from '@/App'
import './AppTopbar.css'

export default function AppTopbar({ onMenu }: { onMenu: () => void }) {
  const store = useSession()
  const handle = useRouteHandle()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = store.session.user
  const initials = (user?.name ?? '').split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase()
  const scope = store.chainAdmin ? 'Toda la cadena' : store.complexes[0]?.name ?? 'Sin complejo'

  async function signOut() {
    await store.signOut()
    queryClient.clear()
    await navigate('/acceso')
  }

  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu" aria-label="Abrir menú" onClick={onMenu}><Menu size={20} /></button>
      <p className="crumb">Administración <span aria-hidden="true">/</span> <strong>{handle.title}</strong></p>
      <div className="right">
        <span className="scope"><span className="dot" aria-hidden="true" /> {scope}</span>
        <div className="user">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <span className="who"><strong>{user?.name}</strong><small>{user?.roleName}</small></span>
        </div>
        <button type="button" className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={signOut}><LogOut size={18} /></button>
      </div>
    </header>
  )
}
