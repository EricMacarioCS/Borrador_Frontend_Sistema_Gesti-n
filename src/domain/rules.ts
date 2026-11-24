/**
 * Reglas puras que la interfaz usa para guiar al usuario. El servidor las vuelve a aplicar:
 * lo que valida el navegador se puede alterar.
 */
import type { Movie, MovieStage, Permission, Session } from './models'
import { addDays } from '@/shared/lib/datetime'

/** Etapa de cartelera calculada con la fecha de negocio del servidor. */
export function movieStage(movie: Pick<Movie, 'releaseDate' | 'presaleFrom' | 'lastDay'>, today: string): MovieStage {
  if (movie.lastDay && movie.lastDay < today) return 'finished'
  if (!movie.releaseDate || movie.releaseDate > today) {
    return movie.presaleFrom && movie.presaleFrom <= today ? 'presale' : 'coming-soon'
  }
  return addDays(movie.releaseDate, 14) >= today ? 'premiere' : 'now-showing'
}

/** Problemas de las fechas de cartelera de una película. */
export function movieDatesProblem(movie: Pick<Movie, 'releaseDate' | 'presaleFrom' | 'lastDay'>): string | null {
  if (!movie.releaseDate) return movie.presaleFrom || movie.lastDay ? 'Escribe la fecha de estreno.' : null
  if (movie.presaleFrom && movie.presaleFrom > movie.releaseDate) return 'La preventa debe empezar antes del estreno.'
  if (movie.lastDay && movie.lastDay < movie.releaseDate) return 'El último día no puede ser anterior al estreno.'
  return null
}

/** URL amigable a partir del título: sin acentos, minúsculas y guiones. */
export function slugify(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export function can(session: Session, permission: Permission): boolean {
  return session.permissions.includes(permission)
}

export function canManageComplex(session: Session, complexId: string): boolean {
  return session.complexIds === null || session.complexIds.includes(complexId)
}

/** Hora de término de una función, con aviso si cruza la medianoche. */
export function endTime(startTime: string, durationMinutes: number): { time: string; nextDay: boolean } {
  const [h, m] = startTime.split(':').map(Number)
  const total = h! * 60 + m! + durationMinutes
  const minutes = total % 1440
  const pad = (n: number) => String(n).padStart(2, '0')
  return { time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`, nextDay: total >= 1440 }
}

/** Convierte pesos escritos en un campo (por ejemplo "85.50") a centavos. `null` si no es válido. */
export function pesosToCents(value: string | number): number | null {
  const text = String(value).trim().replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const [whole, decimals = ''] = text.split('.')
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
}

export function centsToPesos(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}
