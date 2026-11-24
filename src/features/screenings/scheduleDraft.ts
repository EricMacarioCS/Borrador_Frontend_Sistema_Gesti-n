/** Borrador de programación. Se conserva al consultar otros módulos y se descarta al recargar la página. */
import { reactive } from 'vue'
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

export const draft = reactive(blank())

export function resetDraft() {
  Object.assign(draft, blank())
}

export function toRequest(): ScheduleRequest {
  return {
    movieIds: [...draft.movieIds], languages: [...draft.languages], complexIds: [...draft.complexIds], roomTypes: [...draft.roomTypes],
    projections: [...draft.projections], roomIds: [...draft.roomIds], dates: [...draft.dates].sort(), times: [...draft.times].sort()
  }
}
