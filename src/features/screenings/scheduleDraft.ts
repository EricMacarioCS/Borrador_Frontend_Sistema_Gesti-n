/** Borrador de programación. Se conserva al consultar otros módulos y se descarta al recargar la página. */
import { create } from 'zustand'
import type { ScheduleRequest } from '@/domain/models'

const blank = () => ({
  step: 1,
  movieIds: [] as string[],
  languages: ['es'] as string[],
  complexIds: [] as string[],
  roomTypes: ['traditional'] as string[],
  projections: ['2d'] as string[],
  roomIds: [] as string[],
  dates: [] as string[],
  times: [] as string[],
  extraDates: [] as string[],
  extraTimes: [] as string[],
  excluded: [] as string[]
})

export type ScheduleDraft = ReturnType<typeof blank>

interface DraftStore extends ScheduleDraft {
  patch: (changes: Partial<ScheduleDraft>) => void
  reset: () => void
}

export const useScheduleDraft = create<DraftStore>()(set => ({
  ...blank(),
  patch: changes => set(changes),
  reset: () => set(blank())
}))

export function toRequest(draft: ScheduleDraft): ScheduleRequest {
  return {
    movieIds: [...draft.movieIds], languages: [...draft.languages], complexIds: [...draft.complexIds], roomTypes: [...draft.roomTypes],
    projections: [...draft.projections], roomIds: [...draft.roomIds], dates: [...draft.dates].sort(), times: [...draft.times].sort()
  }
}
