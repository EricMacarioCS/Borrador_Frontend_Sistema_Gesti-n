import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { Permission } from '@/domain/models'
import { useSessionStore } from './stores/session'
import { firstAllowed, NAV_ITEMS } from './navigation'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Sin sesión: pantalla de acceso. */
    public?: boolean
    permission?: Permission
  }
}

const VIEWS: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('@/features/dashboard/DashboardView.vue'),
  movies: () => import('@/features/movies/MoviesView.vue'),
  screenings: () => import('@/features/screenings/ScreeningsView.vue'),
  products: () => import('@/features/products/ProductsView.vue'),
  content: () => import('@/features/content/ContentView.vue'),
  prices: () => import('@/features/prices/PricesView.vue'),
  promotions: () => import('@/features/promotions/PromotionsView.vue'),
  orders: () => import('@/features/orders/OrdersView.vue'),
  complexes: () => import('@/features/complexes/ComplexesView.vue'),
  employees: () => import('@/features/employees/EmployeesView.vue'),
  reports: () => import('@/features/reports/ReportsView.vue'),
  settings: () => import('@/features/settings/SettingsView.vue')
}

const routes: RouteRecordRaw[] = [
  { path: '/acceso', name: 'login', component: () => import('@/features/auth/LoginView.vue'), meta: { title: 'Acceso', public: true } },
  ...NAV_ITEMS.map((item): RouteRecordRaw => ({
    path: item.path, name: item.name, component: VIEWS[item.name]!, meta: { title: item.label, permission: item.permission }
  })),
  { path: '/funciones/programar', name: 'schedule', component: () => import('@/features/screenings/ScheduleView.vue'), meta: { title: 'Programar funciones', permission: 'screenings.manage' } },
  { path: '/sin-acceso', name: 'forbidden', component: () => import('@/features/system/ForbiddenView.vue'), meta: { title: 'Sin acceso' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/features/system/NotFoundView.vue'), meta: { title: 'Página no encontrada' } }
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 }
})

router.beforeEach(to => {
  const store = useSessionStore()
  if (to.meta.public) {
    // Con sesión activa no tiene sentido volver a la pantalla de acceso.
    return store.signedIn ? (firstAllowed(store.can)?.path ?? '/sin-acceso') : true
  }
  if (!store.signedIn) return { name: 'login', query: to.fullPath === '/' ? {} : { siguiente: to.fullPath } }
  if (to.meta.permission && !store.can(to.meta.permission)) {
    const fallback = firstAllowed(store.can)
    return fallback && to.name === 'dashboard' ? fallback.path : { name: 'forbidden' }
  }
  return true
})

router.afterEach((to, _from, failure) => {
  if (!failure) document.title = `${to.meta.title ?? 'Administración'} · Cinépolis`
})

// Tras un despliegue, una pestaña abierta puede pedir un archivo que ya no existe: se recarga una vez.
router.onError((error, to) => {
  if (/dynamically imported module|Importing a module script failed/i.test(String(error)) && !sessionStorage.getItem('cp-admin-reloaded')) {
    sessionStorage.setItem('cp-admin-reloaded', '1')
    window.location.assign(to.fullPath)
  }
})
