import { Building2, Server, ShieldCheck } from 'lucide-react'
import { NAV_ITEMS } from '@/app/navigation'
import { useConfig, useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import './SettingsView.css'

export default function SettingsView() {
  const store = useSession()
  const config = useConfig()
  const services = useServices()
  const user = store.session.user
  const modules = NAV_ITEMS.filter(item => store.can(item.permission)).map(item => item.label)

  return (
    <section className="settings-view">
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <p>Tu cuenta, el ambiente en el que trabajas y los datos generales de la organización.</p>
        </div>
      </div>

      <div className="grid">
        <article className="panel panel-pad card">
          <span className="metric-icon"><ShieldCheck size={18} /></span>
          <h2>Tu cuenta</h2>
          <dl>
            <div><dt>Nombre</dt><dd>{user?.name}</dd></div>
            <div><dt>Usuario</dt><dd>{user?.username}</dd></div>
            <div><dt>Correo</dt><dd>{user?.email}</dd></div>
            <div><dt>Puesto</dt><dd>{user?.roleName}</dd></div>
            <div><dt>Alcance</dt><dd>{store.chainAdmin ? 'Administrador: toda la cadena' : `Solo ${store.complexes[0]?.name ?? 'su complejo'}`}</dd></div>
            <div><dt>Módulos</dt><dd>{modules.join(', ')}</dd></div>
            <div><dt>Cierre por inactividad</dt><dd>{config.idleMinutes ? `${config.idleMinutes} minutos` : 'Desactivado'}</dd></div>
          </dl>
        </article>

        <article className="panel panel-pad card">
          <span className="metric-icon"><Server size={18} /></span>
          <h2>Ambiente</h2>
          <dl>
            <div><dt>Nombre</dt><dd>{config.environmentName}</dd></div>
            <div><dt>Datos</dt><dd><span className={`pill ${services.mode === 'mock' ? 'warning' : 'success'}`}>{services.mode === 'mock' ? 'Simulados en el navegador' : 'API conectada'}</span></dd></div>
            <div><dt>API</dt><dd><code>{config.apiBaseUrl}</code></dd></div>
            <div><dt>Versión</dt><dd>{__APP_VERSION__}</dd></div>
            {config.supportEmail && <div><dt>Soporte</dt><dd><a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a></dd></div>}
          </dl>
        </article>

        <article className="panel panel-pad card">
          <span className="metric-icon"><Building2 size={18} /></span>
          <h2>Organización</h2>
          <dl>
            <div><dt>Administración</dt><dd>Centralizada por cadena, con gerentes por complejo</dd></div>
            <div><dt>Complejos visibles</dt><dd>{store.complexes.length}</dd></div>
            <div><dt>Ciudades</dt><dd>{store.reference?.cities.map(city => city.name).join(', ')}</dd></div>
            <div><dt>Moneda</dt><dd>Peso mexicano (MXN)</dd></div>
            <div><dt>Zona horaria</dt><dd>Centro de México (America/Mexico_City)</dd></div>
          </dl>
        </article>
      </div>
    </section>
  )
}
