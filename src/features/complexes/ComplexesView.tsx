import { useState } from 'react'
import { Armchair, Building2, MapPin, Pencil } from 'lucide-react'
import ComplexDialog from './ComplexDialog'
import RoomsDialog from './RoomsDialog'
import { useSession } from '@/app/stores/session'
import type { Complex } from '@/domain/models'
import { formatDate } from '@/shared/lib/datetime'
import './ComplexesView.css'

export default function ComplexesView() {
  const store = useSession()
  const [editing, setEditing] = useState<Complex | null>(null)
  const [roomsOf, setRoomsOf] = useState<Complex | null>(null)

  const groups = new Map<string, Complex[]>()
  for (const complex of store.complexes) groups.set(complex.cityName, [...(groups.get(complex.cityName) ?? []), complex])
  const cities = [...groups]
  const rooms = store.complexes.reduce((sum, c) => sum + c.roomCount, 0)
  const seats = store.complexes.reduce((sum, c) => sum + c.seatCount, 0)

  return (
    <section className="complexes-view">
      <div className="page-head">
        <div>
          <h1>Complejos y salas</h1>
          <p>Datos de cada complejo, sus salas, las proyecciones que admiten y el plano de asientos.</p>
        </div>
      </div>

      <div className="metric-grid spaced">
        <article className="panel metric"><div className="metric-top"><span>Complejos</span><span className="metric-icon"><Building2 size={17} /></span></div><strong>{store.complexes.length}</strong></article>
        <article className="panel metric"><div className="metric-top"><span>Ciudades</span><span className="metric-icon"><MapPin size={17} /></span></div><strong>{cities.length}</strong></article>
        <article className="panel metric"><div className="metric-top"><span>Salas</span><span className="metric-icon"><Armchair size={17} /></span></div><strong>{rooms}</strong></article>
        <article className="panel metric"><div className="metric-top"><span>Asientos</span><span className="metric-icon"><Armchair size={17} /></span></div><strong>{seats.toLocaleString('es-MX')}</strong></article>
      </div>

      {cities.map(([city, list]) => (
        <section key={city} className="city" aria-labelledby={`ciudad-${city}`}>
          <h2 id={`ciudad-${city}`}><MapPin size={16} aria-hidden="true" /> {city}</h2>
          <div className="grid">
            {list.map(complex => (
              <article key={complex.id} className="panel card">
                <div className="top">
                  <h3>{complex.name}</h3>
                  <span className={`pill ${complex.kind === 'vip' ? 'info' : 'muted'}`}>{complex.kind === 'vip' ? 'VIP' : 'Tradicional'}</span>
                </div>
                <p className="muted small">{complex.address}, C.P. {complex.postalCode}</p>
                <dl className="stats">
                  <div><dt>Salas</dt><dd>{complex.roomCount}</dd></div>
                  <div><dt>Asientos</dt><dd>{complex.seatCount.toLocaleString('es-MX')}</dd></div>
                  <div><dt>Apertura</dt><dd>{formatDate(complex.openedOn, 'short')}</dd></div>
                </dl>
                <p className="muted small">ID en Vista: {complex.vistaId ?? 'sin asignar'} · /{complex.slug}</p>
                <div className="actions">
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setRoomsOf(complex)}><Armchair size={15} /> Salas y asientos</button>
                  <button type="button" className="action" aria-label={`Editar datos de ${complex.name}`} onClick={() => setEditing(complex)}><Pencil size={15} /> Datos</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <ComplexDialog complex={editing} onClose={() => setEditing(null)} />
      <RoomsDialog complex={roomsOf} onClose={() => setRoomsOf(null)} />
    </section>
  )
}
