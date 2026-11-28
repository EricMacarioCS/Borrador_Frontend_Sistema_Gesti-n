import type { ComponentType } from 'react'
import { createBrowserRouter, useRouteError, type RouteObject } from 'react-router'
import type { Permission } from '@/domain/models'
import App from '@/App'
import { NAV_ITEMS } from './navigation'

/** Datos de cada ruta: título, si es pública y el permiso que exige. Los lee el guardia de `App`. */
export interface RouteHandle {
  name: string
  title?: string
  /** Sin sesión: pantalla de acceso. */
  public?: boolean
  permission?: Permission
}

type Loader = () => Promise<{ default: ComponentType }>
const lazy = (load: Loader) => async () => ({ Component: (await load()).default })

const VIEWS: Record<string, Loader> = {
  dashboard: () => import('@/features/dashboard/DashboardView'),
  movies: () => import('@/features/movies/MoviesView'),
  screenings: () => import('@/features/screenings/ScreeningsView'),
  products: () => import('@/features/products/ProductsView'),
  content: () => import('@/features/content/ContentView'),
  prices: () => import('@/features/prices/PricesView'),
  promotions: () => import('@/features/promotions/PromotionsView'),
  complexes: () => import('@/features/complexes/ComplexesView'),
  employees: () => import('@/features/employees/EmployeesView'),
  settings: () => import('@/features/settings/SettingsView')
}

/** Tras un despliegue, una pestaña abierta puede pedir un archivo que ya no existe: se recarga una vez. */
function RouteError() {
  const error = useRouteError()
  if (/dynamically imported module|Importing a module script failed/i.test(String(error)) && !sessionStorage.getItem('cp-admin-reloaded')) {
    sessionStorage.setItem('cp-admin-reloaded', '1')
    window.location.reload()
    return null
  }
  console.error(error)
  return (
    <main className="boot-error">
      <div className="panel card">
        <h1>Algo salió mal</h1>
        <p>Recarga la página para continuar.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    </main>
  )
}

export function createAppRouter() {
  const children: RouteObject[] = [
    { path: 'acceso', lazy: lazy(() => import('@/features/auth/LoginView')), handle: { name: 'login', title: 'Acceso', public: true } satisfies RouteHandle },
    ...NAV_ITEMS.map((item): RouteObject => ({
      path: item.path, lazy: lazy(VIEWS[item.name]!), handle: { name: item.name, title: item.label, permission: item.permission } satisfies RouteHandle
    })),
    { path: 'funciones/programar', lazy: lazy(() => import('@/features/screenings/ScheduleView')), handle: { name: 'schedule', title: 'Programar funciones', permission: 'screenings.manage' } satisfies RouteHandle },
    { path: 'sin-acceso', lazy: lazy(() => import('@/features/system/ForbiddenView')), handle: { name: 'forbidden', title: 'Sin acceso' } satisfies RouteHandle },
    { path: '*', lazy: lazy(() => import('@/features/system/NotFoundView')), handle: { name: 'not-found', title: 'Página no encontrada' } satisfies RouteHandle }
  ]
  return createBrowserRouter([{ path: '/', element: <App />, errorElement: <RouteError />, children }], { basename: import.meta.env.BASE_URL })
}
