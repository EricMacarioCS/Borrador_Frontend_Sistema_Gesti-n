/** Textos de la interfaz para los valores del modelo. */
import type { EmployeeStatus, ModifierKind, MovieStage, ProductStructure, PromotionKind, SeatKind } from './models'

export const STAGE_LABELS: Record<MovieStage, string> = {
  'coming-soon': 'Próximamente',
  'presale': 'Preventa',
  'premiere': 'Estreno',
  'now-showing': 'En cartelera',
  'finished': 'Finalizada'
}

export const STRUCTURE_LABELS: Record<ProductStructure, string> = {
  simple: 'Simple',
  compound: 'Configurable',
  combo: 'Combo'
}

export const MODIFIER_LABELS: Record<ModifierKind, string> = {
  size: 'Tamaño',
  flavor: 'Sabor',
  extra: 'Adicional',
  choice: 'Elección'
}

export const SEAT_LABELS: Record<SeatKind, string> = {
  standard: 'Estándar',
  accessible: 'Silla de ruedas',
  companion: 'Acompañante',
  premium: 'Preferente'
}

export const PROMOTION_LABELS: Record<PromotionKind, string> = {
  '2x1': '2×1',
  'percent': 'Porcentaje',
  'double-points': 'Puntos dobles',
  'informative': 'Informativa'
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Activo',
  leave: 'Con permiso',
  inactive: 'Baja'
}

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const

export const labelOf = <T extends string>(labels: Record<T, string>, value: string): string =>
  (labels as Record<string, string>)[value] ?? value
