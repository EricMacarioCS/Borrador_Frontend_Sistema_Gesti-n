/**
 * Puertos: lo que la interfaz necesita del backend. Hay dos implementaciones, `src/adapters/http`
 * (API real) y el mismo adaptador sobre el simulador de `src/mocks`. Las vistas solo conocen estas interfaces.
 */
import type {
  Activity, AdjustmentReason, Banner, BannerInput, CatalogEntry, CatalogEntryInput, ClubLevel, DailySales, Employee,
  EmployeeInput, FaqContent, HomeContent, Id, InfoPage, Movie, MovieInput, OrderDetail, OrderQuery, OrderSummary,
  Page, PriceChange, PriceSheet, Product, ProductCategory, ProductInput, Promotion, PromotionInput, PurchaseRules,
  ReferenceData, Role, Room, Complex, Screening, ScreeningUpdate, ScheduleRequest, SchedulePlan, SeatTemplate,
  Session, StockMovement, TicketPrice, TicketType
} from './models'

export interface AuthPort {
  getSession(signal?: AbortSignal): Promise<Session>
  signIn(email: string, password: string): Promise<Session>
  signOut(): Promise<Session>
}

export interface ReferencePort {
  load(signal?: AbortSignal): Promise<ReferenceData>
}

export interface MoviesPort {
  list(signal?: AbortSignal): Promise<Movie[]>
  create(input: MovieInput): Promise<Movie>
  update(id: Id, input: MovieInput & { version: number }): Promise<Movie>
  remove(id: Id, version: number): Promise<void>
}

export interface ScreeningQuery {
  from: string
  to: string
  complexId?: Id
  movieId?: Id
}

export interface ScreeningsPort {
  list(query: ScreeningQuery, signal?: AbortSignal): Promise<Screening[]>
  preview(request: ScheduleRequest, signal?: AbortSignal): Promise<SchedulePlan>
  /** Crea las funciones del plan, salvo las desmarcadas. El servidor vuelve a validar todo. */
  createBatch(request: ScheduleRequest, excludedKeys: string[], idempotencyKey: string): Promise<Screening[]>
  update(id: Id, input: ScreeningUpdate): Promise<Screening>
  remove(ids: Id[]): Promise<void>
}

export interface ComplexesPort {
  update(complex: Complex): Promise<Complex>
  listRooms(complexId: Id, signal?: AbortSignal): Promise<Room[]>
  updateRoom(room: Room): Promise<Room>
  getSeatTemplate(roomId: Id, signal?: AbortSignal): Promise<SeatTemplate>
  saveSeatTemplate(template: SeatTemplate): Promise<SeatTemplate>
}

export interface PricesPort {
  listTicketTypes(signal?: AbortSignal): Promise<TicketType[]>
  saveTicketType(type: Omit<TicketType, 'id'> & { id: Id | null }): Promise<TicketType>
  getSheet(complexId: Id, signal?: AbortSignal): Promise<PriceSheet>
  saveSheet(complexId: Id, version: number, prices: TicketPrice[]): Promise<PriceSheet>
}

export interface ProductsPort {
  listCategories(signal?: AbortSignal): Promise<ProductCategory[]>
  createCategory(name: string): Promise<ProductCategory>
  list(signal?: AbortSignal): Promise<Product[]>
  create(input: ProductInput): Promise<Product>
  update(id: Id, input: ProductInput & { version: number }): Promise<Product>
  catalog(complexId: Id, signal?: AbortSignal): Promise<CatalogEntry[]>
  saveCatalogEntry(complexId: Id, productId: Id, input: CatalogEntryInput): Promise<CatalogEntry>
  removeCatalogEntry(complexId: Id, productId: Id, version: number): Promise<void>
  priceHistory(complexId: Id, signal?: AbortSignal): Promise<PriceChange[]>
  adjustStock(complexId: Id, productId: Id, input: { version: number; quantity: number; reason: AdjustmentReason; note: string }): Promise<CatalogEntry>
  stockMovements(complexId: Id, signal?: AbortSignal): Promise<StockMovement[]>
}

export interface PromotionsPort {
  list(signal?: AbortSignal): Promise<Promotion[]>
  create(input: PromotionInput): Promise<Promotion>
  update(id: Id, input: PromotionInput & { version: number }): Promise<Promotion>
  listClubLevels(signal?: AbortSignal): Promise<ClubLevel[]>
  saveClubLevel(level: ClubLevel): Promise<ClubLevel>
}

export interface OrdersPort {
  list(query: OrderQuery, signal?: AbortSignal): Promise<Page<OrderSummary>>
  get(id: Id, signal?: AbortSignal): Promise<OrderDetail>
  cancel(id: Id, reason: string, idempotencyKey: string): Promise<OrderDetail>
  advanceFood(id: Id): Promise<OrderDetail>
}

export interface ContentPort {
  getHome(signal?: AbortSignal): Promise<HomeContent>
  saveHome(content: HomeContent): Promise<HomeContent>
  listBanners(signal?: AbortSignal): Promise<Banner[]>
  createBanner(input: BannerInput): Promise<Banner>
  updateBanner(id: Id, input: BannerInput & { version: number }): Promise<Banner>
  removeBanner(id: Id, version: number): Promise<void>
  getFaq(signal?: AbortSignal): Promise<FaqContent>
  saveFaq(content: FaqContent): Promise<FaqContent>
  listPages(signal?: AbortSignal): Promise<InfoPage[]>
  savePage(page: InfoPage): Promise<InfoPage>
  getPurchaseRules(signal?: AbortSignal): Promise<PurchaseRules>
  savePurchaseRules(rules: PurchaseRules): Promise<PurchaseRules>
}

export interface EmployeesPort {
  list(signal?: AbortSignal): Promise<Employee[]>
  create(input: EmployeeInput): Promise<Employee>
  update(id: Id, input: EmployeeInput & { version: number }): Promise<Employee>
  listRoles(signal?: AbortSignal): Promise<Role[]>
  saveRole(role: Omit<Role, 'id'> & { id: Id | null }): Promise<Role>
}

export interface ReportsPort {
  dailySales(from: string, to: string, signal?: AbortSignal): Promise<DailySales[]>
  activity(limit: number, signal?: AbortSignal): Promise<Activity[]>
}

export interface Services {
  mode: 'mock' | 'http'
  auth: AuthPort
  reference: ReferencePort
  movies: MoviesPort
  screenings: ScreeningsPort
  complexes: ComplexesPort
  prices: PricesPort
  products: ProductsPort
  promotions: PromotionsPort
  orders: OrdersPort
  content: ContentPort
  employees: EmployeesPort
  reports: ReportsPort
}
