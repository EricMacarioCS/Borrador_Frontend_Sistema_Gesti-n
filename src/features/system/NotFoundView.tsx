import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { useSession } from '@/app/stores/session'
import './system.css'

export default function NotFoundView() {
  const store = useSession()
  return (
    <div className={store.signedIn ? undefined : 'system-alone'}>
      <div className="panel empty system-view">
        <SearchX size={36} aria-hidden="true" />
        <h1>Esta página no existe</h1>
        <p>Revisa la dirección o vuelve al inicio.</p>
        <Link to="/" className="btn btn-primary">Ir al inicio</Link>
      </div>
    </div>
  )
}
