import type { Component } from 'vue'
import {
  BadgePercent, Building2, CalendarDays, ChartNoAxesCombined, Clapperboard, LayoutDashboard, PanelsTopLeft, Popcorn,
  ReceiptText, Settings, Tags, Users
} from '@lucide/vue'
import type { Permission } from '@/domain/models'

export interface NavItem {
  name: string
  path: string
  label: string
  group: string
  icon: Component
  permission: Permission
}

/** Módulos del sistema. El menú y las rutas salen de esta lista; cada uno exige un permiso. */
export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', path: '/', label: 'Panel principal', group: 'General', icon: LayoutDashboard, permission: 'dashboard.view' },
  { name: 'movies', path: '/peliculas', label: 'Películas', group: 'Cartelera', icon: Clapperboard, permission: 'movies.manage' },
  { name: 'screenings', path: '/funciones', label: 'Funciones y horarios', group: 'Cartelera', icon: CalendarDays, permission: 'screenings.manage' },
  { name: 'products', path: '/dulceria', label: 'Dulcería', group: 'Cartelera', icon: Popcorn, permission: 'products.manage' },
  { name: 'content', path: '/contenido', label: 'Contenido web', group: 'Cartelera', icon: PanelsTopLeft, permission: 'content.manage' },
  { name: 'prices', path: '/tarifas', label: 'Tarifas', group: 'Comercial', icon: Tags, permission: 'prices.manage' },
  { name: 'promotions', path: '/promociones', label: 'Promociones y Club', group: 'Comercial', icon: BadgePercent, permission: 'promotions.manage' },
  { name: 'orders', path: '/pedidos', label: 'Pedidos', group: 'Comercial', icon: ReceiptText, permission: 'orders.view' },
  { name: 'complexes', path: '/complejos', label: 'Complejos y salas', group: 'Operación', icon: Building2, permission: 'complexes.manage' },
  { name: 'employees', path: '/empleados', label: 'Empleados', group: 'Operación', icon: Users, permission: 'employees.manage' },
  { name: 'reports', path: '/reportes', label: 'Reportes e ingresos', group: 'Análisis', icon: ChartNoAxesCombined, permission: 'reports.view' },
  { name: 'settings', path: '/configuracion', label: 'Configuración', group: 'Análisis', icon: Settings, permission: 'settings.view' }
]

export const NAV_GROUPS = [...new Set(NAV_ITEMS.map(item => item.group))]

/** Primer módulo al que el usuario tiene acceso. */
export function firstAllowed(can: (permission: Permission) => boolean): NavItem | null {
  return NAV_ITEMS.find(item => can(item.permission)) ?? null
}
