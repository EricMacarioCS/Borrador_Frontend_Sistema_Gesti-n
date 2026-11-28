import { Link } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { firstAllowed } from '@/app/navigation'
import { useSession } from '@/app/stores/session'
import './system.css'

export default function ForbiddenView() {
  const store = useSession()
  const home = firstAllowed(store.can)
  return (
    <div className="panel empty system-view">
      <ShieldAlert size={36} aria-hidden="true" />
      <h1>No tienes acceso a este módulo</h1>
      <p>Si lo necesitas, pídelo al administrador general.</p>
      {home && <Link to={home.path} className="btn btn-primary">Ir a {home.label}</Link>}
    </div>
  )
}
