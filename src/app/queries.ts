/**
 * Lecturas al servidor con caché (TanStack Query). Las vistas usan estos hooks y nunca leen
 * de los puertos directamente; las escrituras invalidan las claves de aquí.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ScreeningQuery } from '@/domain/ports'
import { useServices } from './services'

export const keys = {
  movies: () => ['movies'] as const,
  screenings: (query: ScreeningQuery) => ['screenings', query] as const,
  allScreenings: () => ['screenings'] as const,
  rooms: (complexId: string) => ['rooms', complexId] as const,
  allRooms: () => ['rooms'] as const,
  seatTemplate: (roomId: string) => ['seat-template', roomId] as const,
  ticketTypes: () => ['ticket-types'] as const,
  priceSheet: (complexId: string) => ['price-sheet', complexId] as const,
  categories: () => ['product-categories'] as const,
  products: () => ['products'] as const,
  catalog: (complexId: string) => ['catalog', complexId] as const,
  priceHistory: (complexId: string) => ['price-history', complexId] as const,
  promotions: () => ['promotions'] as const,
  clubLevels: () => ['club-levels'] as const,
  home: () => ['content', 'home'] as const,
  banners: () => ['content', 'banners'] as const,
  faq: () => ['content', 'faq'] as const,
  pages: () => ['content', 'pages'] as const,
  purchaseRules: () => ['content', 'purchase-rules'] as const,
  employees: () => ['employees'] as const,
  roles: () => ['roles'] as const,
  activity: () => ['activity'] as const
}

export function useMovies() {
  const { movies } = useServices()
  return useQuery({ queryKey: keys.movies(), queryFn: ({ signal }) => movies.list(signal) })
}

export function useScreenings(query: ScreeningQuery) {
  const { screenings } = useServices()
  return useQuery({
    queryKey: keys.screenings(query),
    queryFn: ({ signal }) => screenings.list(query, signal),
    placeholderData: keepPreviousData
  })
}

export function useRooms(complexId: string | null) {
  const { complexes } = useServices()
  return useQuery({
    queryKey: keys.rooms(complexId ?? ''),
    queryFn: ({ signal }) => complexes.listRooms(complexId!, signal),
    enabled: Boolean(complexId),
    staleTime: 5 * 60_000
  })
}

export function useSeatTemplate(roomId: string | null) {
  const { complexes } = useServices()
  return useQuery({
    queryKey: keys.seatTemplate(roomId ?? ''),
    queryFn: ({ signal }) => complexes.getSeatTemplate(roomId!, signal),
    enabled: Boolean(roomId),
    staleTime: 0
  })
}

export function useTicketTypes() {
  const { prices } = useServices()
  return useQuery({ queryKey: keys.ticketTypes(), queryFn: ({ signal }) => prices.listTicketTypes(signal), staleTime: 5 * 60_000 })
}

export function usePriceSheet(complexId: string | null) {
  const { prices } = useServices()
  return useQuery({
    queryKey: keys.priceSheet(complexId ?? ''),
    queryFn: ({ signal }) => prices.getSheet(complexId!, signal),
    enabled: Boolean(complexId),
    staleTime: 0,
    // Con cambios sin guardar no conviene reemplazar lo que se edita al volver a la pestaña.
    refetchOnWindowFocus: false
  })
}

export function useCategories() {
  const { products } = useServices()
  return useQuery({ queryKey: keys.categories(), queryFn: ({ signal }) => products.listCategories(signal), staleTime: 5 * 60_000 })
}

export function useProducts() {
  const { products } = useServices()
  return useQuery({ queryKey: keys.products(), queryFn: ({ signal }) => products.list(signal) })
}

export function useCatalog(complexId: string | null) {
  const { products } = useServices()
  return useQuery({
    queryKey: keys.catalog(complexId ?? ''),
    queryFn: ({ signal }) => products.catalog(complexId!, signal),
    enabled: Boolean(complexId),
    placeholderData: keepPreviousData
  })
}

export function usePriceHistory(complexId: string | null, enabled: boolean) {
  const { products } = useServices()
  return useQuery({
    queryKey: keys.priceHistory(complexId ?? ''),
    queryFn: ({ signal }) => products.priceHistory(complexId!, signal),
    enabled: Boolean(complexId) && enabled
  })
}

export function usePromotions() {
  const { promotions } = useServices()
  return useQuery({ queryKey: keys.promotions(), queryFn: ({ signal }) => promotions.list(signal) })
}

export function useClubLevels() {
  const { promotions } = useServices()
  return useQuery({ queryKey: keys.clubLevels(), queryFn: ({ signal }) => promotions.listClubLevels(signal) })
}

export function useHomeContent() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.home(), queryFn: ({ signal }) => content.getHome(signal), refetchOnWindowFocus: false })
}
export function useBanners() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.banners(), queryFn: ({ signal }) => content.listBanners(signal) })
}
export function useFaq() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.faq(), queryFn: ({ signal }) => content.getFaq(signal), refetchOnWindowFocus: false })
}
export function usePages() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.pages(), queryFn: ({ signal }) => content.listPages(signal), refetchOnWindowFocus: false })
}
export function usePurchaseRules() {
  const { content } = useServices()
  return useQuery({ queryKey: keys.purchaseRules(), queryFn: ({ signal }) => content.getPurchaseRules(signal), refetchOnWindowFocus: false })
}

export function useEmployees() {
  const { employees } = useServices()
  return useQuery({ queryKey: keys.employees(), queryFn: ({ signal }) => employees.list(signal) })
}
export function useRoles() {
  const { employees } = useServices()
  return useQuery({ queryKey: keys.roles(), queryFn: ({ signal }) => employees.listRoles(signal), staleTime: 5 * 60_000 })
}

export function useActivity(limit = 8) {
  const { activity } = useServices()
  return useQuery({ queryKey: keys.activity(), queryFn: ({ signal }) => activity.list(limit, signal), staleTime: 0 })
}
