import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import AppSidebar from '@/app/layout/AppSidebar'
import AppTopbar from '@/app/layout/AppTopbar'
import FeedbackHost from '@/app/layout/FeedbackHost'
import { firstAllowed } from '@/app/navigation'
import type { RouteHandle } from '@/app/router'
import { useConfig, useServices } from '@/app/services'
import { useSession } from '@/app/stores/session'
import { useIdleTimer } from '@/shared/hooks/idle'
import './App.css'

/** Ruta activa: la más profunda que tenga datos. */
export function useRouteHandle(): RouteHandle {
  const matches = useMatches()
  return (matches.findLast(match => match.handle)?.handle ?? { name: '' }) as RouteHandle
}

/**
 * Guardia de navegación: sin sesión se va al acceso, con sesión no se vuelve a él
 * y un módulo sin permiso lleva al primero permitido o a "Sin acceso".
 */
function guard(handle: RouteHandle, store: ReturnType<typeof useSession>, fullPath: string, search: URLSearchParams): string | null {
  if (handle.public) {
    if (!store.signedIn) return null
    // Tras entrar se continúa a donde iba, solo si es una ruta interna (nunca una dirección externa).
    const wanted = search.get('siguiente')
    return wanted?.startsWith('/') && !wanted.startsWith('//') ? wanted : (firstAllowed(store.can)?.path ?? '/sin-acceso')
  }
  if (!store.signedIn) return fullPath === '/' ? '/acceso' : `/acceso?siguiente=${encodeURIComponent(fullPath)}`
  if (handle.permission && !store.can(handle.permission)) {
    const fallback = firstAllowed(store.can)
    return fallback && handle.name === 'dashboard' ? fallback.path : '/sin-acceso'
  }
  return null
}

export default function App() {
  const store = useSession()
  const config = useConfig()
  const services = useServices()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const handle = useRouteHandle()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(location.pathname)
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname)
    setMenuOpen(false)
  }

  useEffect(() => {
    document.title = `${handle.title ?? 'Administración'} · Cinépolis`
  }, [handle.title])

  // Una sesión olvidada abierta en una computadora compartida es un riesgo: se cierra sola.
  useIdleTimer(config.idleMinutes, store.signedIn, async () => {
    await store.signOut('idle')
    queryClient.clear()
    await navigate('/acceso')
  })

  const redirect = guard(handle, store, location.pathname + location.search, new URLSearchParams(location.search))
  if (redirect) return <Navigate to={redirect} replace />

  const shell = store.signedIn && !handle.public
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      {shell ? (
        <div className="shell">
          <AppSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
          {menuOpen && <div className="scrim" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
          <div className="main-area">
            <AppTopbar onMenu={() => setMenuOpen(true)} />
            {services.mode === 'mock' && <p className="demo-bar" role="note">Ambiente de demostración: datos simulados que solo existen en este navegador.</p>}
            <main id="contenido" className="page" tabIndex={-1}>
              <Outlet />
            </main>
            <footer className="footer">
              <span>Proyecto académico, sin relación comercial con Cinépolis.</span>
              <span>Versión {config.environmentName} · {services.mode === 'mock' ? 'simulación' : 'API'}</span>
            </footer>
          </div>
        </div>
      ) : (
        <main id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      )}
      <FeedbackHost />
    </>
  )
}
