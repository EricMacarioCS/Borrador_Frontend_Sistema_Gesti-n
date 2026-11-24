/**
 * Lecturas al servidor con caché (TanStack Query). Las vistas usan estos composables y nunca leen
 * de los puertos directamente; las escrituras invalidan las claves de aquí.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { OrderQuery } from '@/domain/models'
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
  movements: (complexId: string) => ['stock-movements', complexId] as const,
  promotions: () => ['promotions'] as const,
  clubLevels: () => ['club-levels'] as const,
  orders: (query: OrderQuery) => ['orders', query] as const,
  allOrders: () => ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  home: () => ['content', 'home'] as const,
  banners: () => ['content', 'banners'] as const,
  faq: () => ['content', 'faq'] as const,
  pages: () => ['content', 'pages'] as const,
  purchaseRules: () => ['content', 'purchase-rules'] as const,
  employees: () => ['employees'] as const,
  roles: () => ['roles'] as const,
  dailySales: (from: string, to: string) => ['daily-sales', from, to] as const,
  activity: () => ['activity'] as const
}

export function useMovies() {
  const { movies } = useServices()
  return useQuery({ queryKey: keys.movies(), queryFn: ({ signal }) => movies.list(signal) })
}

export function useScreenings(query: MaybeRefOrGetter<ScreeningQuery>) {
  const { screenings } = useServices()
  return useQuery({
    queryKey: computed(() => keys.screenings(toValue(query))),
    queryFn: ({ signal }) => screenings.list(toValue(query), signal),
    placeholderData: keepPreviousData
  })
}

export function useRooms(complexId: MaybeRefOrGetter<string | null>) {
  const { complexes } = useServices()
  return useQuery({
    queryKey: computed(() => keys.rooms(toValue(complexId) ?? '')),
    queryFn: ({ signal }) => complexes.listRooms(toValue(complexId)!, signal),
    enabled: computed(() => Boolean(toValue(complexId))),
    staleTime: 5 * 60_000
  })
}

export function useSeatTemplate(roomId: MaybeRefOrGetter<string | null>) {
  const { complexes } = useServices()
  return useQuery({
    queryKey: computed(() => keys.seatTemplate(toValue(roomId) ?? '')),
    queryFn: ({ signal }) => complexes.getSeatTemplate(toValue(roomId)!, signal),
    enabled: computed(() => Boolean(toValue(roomId))),
    staleTime: 0
  })
}

export function useTicketTypes() {
  const { prices } = useServices()
  return useQuery({ queryKey: keys.ticketTypes(), queryFn: ({ signal }) => prices.listTicketTypes(signal), staleTime: 5 * 60_000 })
}

export function usePriceSheet(complexId: MaybeRefOrGetter<string | null>) {
  const { prices } = useServices()
  return useQuery({
    queryKey: computed(() => keys.priceSheet(toValue(complexId) ?? '')),
    queryFn: ({ signal }) => prices.getSheet(toValue(complexId)!, signal),
    enabled: computed(() => Boolean(toValue(complexId))),
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

export function useCatalog(complexId: MaybeRefOrGetter<string | null>) {
  const { products } = useServices()
  return useQuery({
    queryKey: computed(() => keys.catalog(toValue(complexId) ?? '')),
    queryFn: ({ signal }) => products.catalog(toValue(complexId)!, signal),
    enabled: computed(() => Boolean(toValue(complexId))),
    placeholderData: keepPreviousData
  })
}

export function usePriceHistory(complexId: MaybeRefOrGetter<string | null>, enabled: MaybeRefOrGetter<boolean>) {
  const { products } = useServices()
  return useQuery({
    queryKey: computed(() => keys.priceHistory(toValue(complexId) ?? '')),
    queryFn: ({ signal }) => products.priceHistory(toValue(complexId)!, signal),
    enabled: computed(() => Boolean(toValue(complexId)) && toValue(enabled))
  })
}

export function useStockMovements(complexId: MaybeRefOrGetter<string | null>, enabled: MaybeRefOrGetter<boolean>) {
  const { products } = useServices()
  return useQuery({
    queryKey: computed(() => keys.movements(toValue(complexId) ?? '')),
    queryFn: ({ signal }) => products.stockMovements(toValue(complexId)!, signal),
    enabled: computed(() => Boolean(toValue(complexId)) && toValue(enabled))
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

export function useOrders(query: MaybeRefOrGetter<OrderQuery>) {
  const { orders } = useServices()
  return useQuery({
    queryKey: computed(() => keys.orders(toValue(query))),
    queryFn: ({ signal }) => orders.list(toValue(query), signal),
    placeholderData: keepPreviousData
  })
}

export function useOrder(id: MaybeRefOrGetter<string | null>) {
  const { orders } = useServices()
  return useQuery({
    queryKey: computed(() => keys.order(toValue(id) ?? '')),
    queryFn: ({ signal }) => orders.get(toValue(id)!, signal),
    enabled: computed(() => Boolean(toValue(id))),
    staleTime: 0,
    // Mientras el reembolso está en proceso se consulta su estado.
    refetchInterval: query => query.state.data?.status === 'refund-pending' ? 2000 : false
  })
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

export function useDailySales(range: MaybeRefOrGetter<{ from: string; to: string }>) {
  const { reports } = useServices()
  return useQuery({
    queryKey: computed(() => keys.dailySales(toValue(range).from, toValue(range).to)),
    queryFn: ({ signal }) => reports.dailySales(toValue(range).from, toValue(range).to, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000
  })
}

export function useActivity(limit = 8) {
  const { reports } = useServices()
  return useQuery({ queryKey: keys.activity(), queryFn: ({ signal }) => reports.activity(limit, signal), staleTime: 0 })
}
