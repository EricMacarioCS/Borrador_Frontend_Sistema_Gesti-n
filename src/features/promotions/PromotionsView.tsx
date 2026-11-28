import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import ClubLevelDialog from './ClubLevelDialog'
import PromotionDialog from './PromotionDialog'
import { useClubLevels, usePromotions } from '@/app/queries'
import { useSession } from '@/app/stores/session'
import { PROMOTION_LABELS, WEEKDAYS, labelOf } from '@/domain/labels'
import type { ClubLevel, Promotion } from '@/domain/models'
import StateView from '@/shared/ui/StateView'
import { formatDate } from '@/shared/lib/datetime'
import './PromotionsView.css'

export default function PromotionsView() {
  const store = useSession()
  const promotions = usePromotions()
  const levels = useClubLevels()
  const [tab, setTab] = useState<'promotions' | 'club'>('promotions')
  const [editing, setEditing] = useState<{ promotion: Promotion | null } | null>(null)
  const [editingLevel, setEditingLevel] = useState<ClubLevel | null>(null)

  function state(p: Promotion) {
    const today = store.today()
    if (p.validTo && p.validTo < today) return { label: 'Vencida', tone: 'muted' }
    return p.validFrom > today ? { label: 'Programada', tone: 'info' } : { label: 'Vigente', tone: 'success' }
  }
  const sorted = [...(promotions.data ?? [])].sort((a, b) => Number(state(a).label === 'Vencida') - Number(state(b).label === 'Vencida') || a.name.localeCompare(b.name))
  const levelName = (id: string | null) => id ? levels.data?.find(l => l.id === id)?.name ?? '—' : 'Todo público'
  const formats = (p: Promotion) => [
    ...p.rules.roomTypes.map(code => store.reference?.roomTypes.find(t => t.code === code)?.name ?? code),
    ...p.rules.projections.map(code => store.reference?.projections.find(x => x.code === code)?.name ?? code)
  ].join(', ') || 'Todos'

  return (
    <section className="promotions-view">
      <div className="page-head">
        <div>
          <h1>Promociones y Club</h1>
          <p>Una promoción por compra. Las del Club pueden limitarse a un nivel de socio.</p>
        </div>
        {tab === 'promotions' && <button type="button" className="btn btn-primary" onClick={() => setEditing({ promotion: null })}><Plus size={16} /> Nueva promoción</button>}
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones">
        <button type="button" role="tab" aria-selected={tab === 'promotions'} onClick={() => setTab('promotions')}>Promociones</button>
        <button type="button" role="tab" aria-selected={tab === 'club'} onClick={() => setTab('club')}>Niveles del Club</button>
      </div>

      {tab === 'promotions' ? (
        <StateView loading={promotions.isPending} error={promotions.error} empty={!sorted.length} skeleton="rows"
          emptyTitle="Sin promociones" onRetry={() => void promotions.refetch()}>
          <div className="panel table-wrap">
            <table className="data">
              <thead><tr><th>Promoción</th><th>Tipo</th><th>Días</th><th>Formatos</th><th>Complejos</th><th>Socios</th><th>Vigencia</th><th>Estado</th><th className="actions-col"><span className="visually-hidden">Acciones</span></th></tr></thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} className={state(p).label === 'Vencida' ? 'row-off' : undefined}>
                    <td><span className="stack"><strong>{p.name}</strong><small>{p.description}</small></span></td>
                    <td>{p.kind === 'percent' ? `${p.rules.percent} % de descuento` : labelOf(PROMOTION_LABELS, p.kind)}</td>
                    <td>{p.rules.weekdays.length ? p.rules.weekdays.map(d => WEEKDAYS[d]).join(', ') : 'Todos'}</td>
                    <td>{formats(p)}</td>
                    <td>{p.appliesToAll ? 'Toda la cadena' : `${p.complexIds.length} ${p.complexIds.length === 1 ? 'complejo' : 'complejos'}`}</td>
                    <td>{levelName(p.clubLevelId)}</td>
                    <td>{formatDate(p.validFrom, 'short')} – {p.validTo ? formatDate(p.validTo, 'short') : 'sin fin'}</td>
                    <td><span className={`pill ${state(p).tone}`}>{state(p).label}</span></td>
                    <td className="actions-col"><button type="button" className="action" aria-label={`Editar ${p.name}`} onClick={() => setEditing({ promotion: p })}><Pencil size={15} /> Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateView>
      ) : (
        <StateView loading={levels.isPending} error={levels.error} skeleton="rows" onRetry={() => void levels.refetch()}>
          <p className="notice small spaced">Los niveles se calculan con las visitas del semestre (tabla <code>nivel_club</code>). Las cuentas de los socios no se administran aquí.</p>
          <div className="levels">
            {levels.data?.map(level => (
              <article key={level.id} className="panel panel-pad level">
                <h2>{level.name}</h2>
                <p className="muted">{level.maxVisits === null ? `${level.minVisits} visitas o más` : `De ${level.minVisits} a ${level.maxVisits} visitas`} por semestre</p>
                <p><strong>{level.pointsPercent} %</strong> del gasto en puntos</p>
                <p className="small">{level.benefits || 'Sin beneficios descritos.'}</p>
                <button type="button" className="action" aria-label={`Editar ${level.name}`} onClick={() => setEditingLevel(level)}><Pencil size={15} /> Editar</button>
              </article>
            ))}
          </div>
        </StateView>
      )}

      <PromotionDialog open={!!editing} promotion={editing?.promotion ?? null} onClose={() => setEditing(null)} />
      <ClubLevelDialog level={editingLevel} onClose={() => setEditingLevel(null)} />
    </section>
  )
}
