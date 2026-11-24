/**
 * Datos por defecto del simulador. Son ficticios y siguen la forma de la base de datos: complejos de Veracruz
 * (la versión VIP es otro complejo), salas con tipo fijo y proyecciones, precios explícitos por combinación,
 * productos de la cadena con reglas de personalización y catálogo propio por complejo.
 * Usan los mismos complejos y películas que el borrador del sitio web.
 */
import { addDays, dateInZone, DEFAULT_TIME_ZONE } from '@/shared/lib/datetime'
import type { Permission } from '@/domain/models'

export const TIME_ZONE = DEFAULT_TIME_ZONE
export const CLEANING_MINUTES = 20
export const MAX_BATCH = 1000
export const SERVICE_FEE_CENTS = 600
export const LOGIN_LOCK_ATTEMPTS = 5
export const LOGIN_LOCK_MINUTES = 15

export const today = () => dateInZone(new Date(), TIME_ZONE)

/* Usuarios de demostración. Solo existen en el simulador; el backend real usa su propio almacén de identidades. */

const ALL: Permission[] = [
  'dashboard.view', 'reports.view', 'movies.manage', 'screenings.manage', 'products.manage', 'inventory.adjust',
  'content.manage', 'prices.manage', 'promotions.manage', 'orders.view', 'orders.manage', 'complexes.manage',
  'employees.manage', 'settings.view'
]

export const USERS = [
  {
    id: 'u-1', name: 'Ana Torres', email: 'admin@cinepolis.test', password: 'Demo-2026',
    roleName: 'Administrador general', permissions: ALL, complexIds: null as string[] | null
  },
  {
    id: 'u-2', name: 'Luis Ramírez', email: 'gerente.xalapa@cinepolis.test', password: 'Demo-2026',
    roleName: 'Gerente de complejo',
    permissions: ['dashboard.view', 'reports.view', 'screenings.manage', 'products.manage', 'inventory.adjust', 'orders.view', 'orders.manage', 'settings.view'] as Permission[],
    complexIds: ['xal-centro', 'xal-centro-vip'] as string[] | null
  }
]

/* Catálogos */

export const CITIES = [
  { id: 'city-xal', name: 'Xalapa' },
  { id: 'city-ver', name: 'Veracruz' },
  { id: 'city-boc', name: 'Boca del Río' },
  { id: 'city-coa', name: 'Coatzacoalcos' },
  { id: 'city-cor', name: 'Córdoba' }
]

export const ROOM_TYPES = [
  { code: 'traditional', name: 'Tradicional', surchargeCents: 0 },
  { code: 'junior', name: 'Junior', surchargeCents: 1000 },
  { code: 'macro-xe', name: 'Macro XE', surchargeCents: 3000 },
  { code: 'imax', name: 'IMAX', surchargeCents: 4500 },
  { code: '4dx', name: '4DX', surchargeCents: 6000 },
  { code: 'vip', name: 'VIP', surchargeCents: 7000 }
]
export const PROJECTIONS = [
  { code: '2d', name: '2D', surchargeCents: 0 },
  { code: '3d', name: '3D', surchargeCents: 2500 }
]
export const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'sub', name: 'Subtitulada' }
]
export const RATINGS = [
  { code: 'AA', description: 'Para todo público, comprensible para menores de 7 años' },
  { code: 'A', description: 'Para todo público' },
  { code: 'B', description: 'Para adolescentes de 12 años en adelante' },
  { code: 'B15', description: 'No recomendada para menores de 15 años' },
  { code: 'C', description: 'Para adultos de 18 años en adelante' },
  { code: 'D', description: 'Exclusivamente para adultos' }
]
export const GENRES = ['Acción', 'Animación', 'Aventura', 'Ciencia ficción', 'Comedia', 'Documental', 'Drama', 'Música', 'Ópera', 'Suspenso', 'Terror']

/* Complejos y salas */

type RoomSeed = [type: string, threeD: boolean]
interface ComplexSeed {
  id: string; name: string; cityId: string; kind: 'traditional' | 'vip'; baseCents: number; address: string; postalCode: string
  openedOn: string; rooms: RoomSeed[]
}

export const COMPLEX_SEEDS: ComplexSeed[] = [
  { id: 'xal-centro', name: 'Xalapa Centro', cityId: 'city-xal', kind: 'traditional', baseCents: 8500, address: 'Av. Lázaro Cárdenas 100', postalCode: '91000', openedOn: '2009-05-14',
    rooms: [['imax', true], ['macro-xe', true], ['4dx', true], ['traditional', true], ['traditional', false], ['traditional', false], ['junior', false]] },
  { id: 'xal-centro-vip', name: 'Xalapa Centro VIP', cityId: 'city-xal', kind: 'vip', baseCents: 9500, address: 'Av. Lázaro Cárdenas 100, nivel 2', postalCode: '91000', openedOn: '2012-11-30',
    rooms: [['vip', true], ['vip', false], ['vip', false]] },
  { id: 'xal-animas', name: 'Xalapa Ánimas', cityId: 'city-xal', kind: 'traditional', baseCents: 8200, address: 'Blvd. Culturas Veracruzanas 120', postalCode: '91190', openedOn: '2016-03-18',
    rooms: [['macro-xe', true], ['traditional', true], ['traditional', false], ['traditional', false], ['junior', false]] },
  { id: 'ver-boulevard', name: 'Veracruz Boulevard', cityId: 'city-ver', kind: 'traditional', baseCents: 9000, address: 'Blvd. Manuel Ávila Camacho 2500', postalCode: '91910', openedOn: '2005-08-26',
    rooms: [['macro-xe', true], ['traditional', true], ['traditional', false], ['traditional', false], ['traditional', true], ['junior', false]] },
  { id: 'ver-puerto', name: 'Veracruz Puerto', cityId: 'city-ver', kind: 'traditional', baseCents: 8800, address: 'Av. Independencia 1200', postalCode: '91700', openedOn: '2018-07-06',
    rooms: [['4dx', true], ['traditional', true], ['traditional', false], ['traditional', false]] },
  { id: 'boca-costa', name: 'Boca del Río Costa', cityId: 'city-boc', kind: 'traditional', baseCents: 9200, address: 'Blvd. Adolfo Ruiz Cortines 3500', postalCode: '94299', openedOn: '2011-12-15',
    rooms: [['imax', true], ['traditional', true], ['traditional', false], ['traditional', false], ['4dx', true]] },
  { id: 'coatza-malecon', name: 'Coatzacoalcos Malecón', cityId: 'city-coa', kind: 'traditional', baseCents: 7900, address: 'Av. Malecón Costero 400', postalCode: '96400', openedOn: '2008-04-11',
    rooms: [['traditional', true], ['traditional', false], ['traditional', false], ['macro-xe', false], ['traditional', false]] },
  { id: 'cordoba-parque', name: 'Córdoba Parque', cityId: 'city-cor', kind: 'traditional', baseCents: 7600, address: 'Av. 11 número 1500', postalCode: '94500', openedOn: '2014-10-03',
    rooms: [['traditional', true], ['traditional', false], ['traditional', false], ['junior', false]] }
]

/** Plano por tipo de sala: filas, asientos por fila y columnas de pasillo (las que faltan en la BD). */
export const SEAT_SHAPES: Record<string, { rows: number; columns: number; aisles: number[]; premiumRows: number }> = {
  'traditional': { rows: 11, columns: 16, aisles: [4, 13], premiumRows: 0 },
  'junior': { rows: 8, columns: 12, aisles: [6], premiumRows: 0 },
  'macro-xe': { rows: 13, columns: 20, aisles: [5, 16], premiumRows: 3 },
  'imax': { rows: 14, columns: 22, aisles: [6, 17], premiumRows: 4 },
  '4dx': { rows: 8, columns: 12, aisles: [4, 9], premiumRows: 0 },
  'vip': { rows: 6, columns: 10, aisles: [3, 8], premiumRows: 6 }
}

/* Películas. Fechas relativas al día de hoy. */

export interface MovieSeed {
  id: string; title: string; slug: string; rating: string; genres: string[]; durationMinutes: number; synopsis: string
  category: string; isSpecialEvent: boolean; releaseOffset: number; presaleOffset: number | null; lastDayOffset: number | null
  cast: { name: string; role: string }[]
}

export const MOVIE_SEEDS: MovieSeed[] = [
  { id: 'm-101', title: 'Horizonte infinito', slug: 'horizonte-infinito', rating: 'B', genres: ['Ciencia ficción', 'Aventura'], durationMinutes: 138, category: 'Garantía Cinépolis', isSpecialEvent: false, releaseOffset: -3, presaleOffset: null, lastDayOffset: null,
    synopsis: 'Una tripulación cruza los límites del sistema solar para encontrar un nuevo hogar para la humanidad.',
    cast: [{ name: 'Lucía Arreola', role: 'director' }, { name: 'Tomás Rivera', role: 'actor' }, { name: 'Ana Belmonte', role: 'actor' }] },
  { id: 'm-102', title: 'Ciudad de sombras', slug: 'ciudad-de-sombras', rating: 'B15', genres: ['Suspenso'], durationMinutes: 114, category: 'Normal', isSpecialEvent: false, releaseOffset: 9, presaleOffset: -2, lastDayOffset: null,
    synopsis: 'Una detective sigue una pista imposible a través de una ciudad que nunca duerme.',
    cast: [{ name: 'Mateo Llorente', role: 'director' }, { name: 'Sofía Durán', role: 'actor' }] },
  { id: 'm-103', title: 'El último verano', slug: 'el-ultimo-verano', rating: 'A', genres: ['Drama'], durationMinutes: 107, category: 'Normal', isSpecialEvent: false, releaseOffset: -25, presaleOffset: null, lastDayOffset: 10,
    synopsis: 'Cuatro amigos vuelven al lugar donde crecieron para cumplir una promesa pendiente.', cast: [] },
  { id: 'm-104', title: 'Fuego del norte', slug: 'fuego-del-norte', rating: 'B', genres: ['Aventura', 'Acción'], durationMinutes: 126, category: 'Normal', isSpecialEvent: false, releaseOffset: -6, presaleOffset: null, lastDayOffset: null,
    synopsis: 'Una exploradora debe atravesar territorio desconocido para recuperar un antiguo mapa.',
    cast: [{ name: 'Iván Castañeda', role: 'director' }, { name: 'Regina Paz', role: 'actor' }] },
  { id: 'm-105', title: 'La gran travesía', slug: 'la-gran-travesia', rating: 'AA', genres: ['Animación', 'Comedia'], durationMinutes: 98, category: 'Garantía Cinépolis', isSpecialEvent: false, releaseOffset: -12, presaleOffset: null, lastDayOffset: null,
    synopsis: 'Un grupo de animales del bosque emprende un viaje para salvar el río que les da hogar.', cast: [] },
  { id: 'm-106', title: 'Ecos del abismo', slug: 'ecos-del-abismo', rating: 'C', genres: ['Terror'], durationMinutes: 101, category: 'Normal', isSpecialEvent: false, releaseOffset: -2, presaleOffset: null, lastDayOffset: null,
    synopsis: 'Una expedición submarina descubre que algo responde a sus señales desde el fondo del océano.', cast: [] },
  { id: 'm-107', title: 'Risas en la carretera', slug: 'risas-en-la-carretera', rating: 'B', genres: ['Comedia'], durationMinutes: 112, category: 'Normal', isSpecialEvent: false, releaseOffset: 16, presaleOffset: null, lastDayOffset: null,
    synopsis: 'Dos hermanos que no se hablan desde hace años comparten un viaje de tres días hacia la boda de su madre.', cast: [] },
  { id: 'm-108', title: 'Guardianes del arrecife', slug: 'guardianes-del-arrecife', rating: 'AA', genres: ['Animación', 'Aventura'], durationMinutes: 92, category: 'Normal', isSpecialEvent: false, releaseOffset: -4, presaleOffset: null, lastDayOffset: null,
    synopsis: 'Una tortuga marina y un pez payaso unen fuerzas para proteger su arrecife de una tormenta.', cast: [] },
  { id: 'm-109', title: 'La Traviata en vivo', slug: 'la-traviata-en-vivo', rating: 'A', genres: ['Música', 'Ópera'], durationMinutes: 160, category: 'Normal', isSpecialEvent: true, releaseOffset: 5, presaleOffset: -7, lastDayOffset: 5,
    synopsis: 'Transmisión de ópera desde un teatro europeo. Programación de demostración.', cast: [] },
  { id: 'm-110', title: 'Sinfonía bajo las estrellas', slug: 'sinfonia-bajo-las-estrellas', rating: 'AA', genres: ['Música'], durationMinutes: 110, category: 'Normal', isSpecialEvent: true, releaseOffset: 2, presaleOffset: -7, lastDayOffset: 2,
    synopsis: 'Una experiencia audiovisual con orquesta en vivo, por una sola noche.', cast: [] }
]

export const offsetDate = (offset: number | null) => offset === null ? null : addDays(today(), offset)

/* Boletos */

export const TICKET_TYPE_SEEDS = [
  { id: 'tt-general', name: 'General', description: 'Admisión general', isPromotional: false, fixedPriceCents: null, percent: 100 },
  { id: 'tt-child', name: 'Niño', description: 'De 3 a 11 años', isPromotional: false, fixedPriceCents: null, percent: 75 },
  { id: 'tt-senior', name: 'Adulto mayor', description: '60 años o más, con credencial INAPAM', isPromotional: false, fixedPriceCents: null, percent: 80 },
  { id: 'tt-fiesta', name: 'Fiesta Cinépolis', description: 'Precio especial de temporada', isPromotional: true, fixedPriceCents: 3500, percent: 0 }
]

/* Dulcería */

export const CATEGORY_SEEDS = [
  { id: 'cat-combos', name: 'Combos' },
  { id: 'cat-palomitas', name: 'Palomitas' },
  { id: 'cat-bebidas', name: 'Bebidas' },
  { id: 'cat-alimentos', name: 'Alimentos' },
  { id: 'cat-dulces', name: 'Dulces' },
  { id: 'cat-promocionales', name: 'Promocionales' }
]

interface OptionSeed { name: string; extraCents?: number; isDefault?: boolean }
interface RuleSeed { title: string; kind: string; min: number; max: number; allowSplit?: boolean; options: OptionSeed[] }
export interface ProductSeed {
  id: string; apiId: string; name: string; description: string; categoryId: string; structure: string; baseCents: number
  requiresTicketCode: boolean; rules: RuleSeed[]; stock: number
}

const SIZES: OptionSeed[] = [{ name: 'Mediano', isDefault: true }, { name: 'Grande', extraCents: 1500 }, { name: 'Jumbo', extraCents: 3000 }]
const POPCORN: OptionSeed[] = [{ name: 'Mantequilla', isDefault: true }, { name: 'Caramelo', extraCents: 1000 }, { name: 'Queso', extraCents: 1000 }, { name: 'Chile', extraCents: 500 }]
const SODAS: OptionSeed[] = [{ name: 'Cola', isDefault: true }, { name: 'Cola sin azúcar' }, { name: 'Naranja' }, { name: 'Limón' }]

export const PRODUCT_SEEDS: ProductSeed[] = [
  { id: 'p-1', apiId: '14301', name: 'Combo pareja', description: 'Palomitas grandes y dos refrescos grandes', categoryId: 'cat-combos', structure: 'combo', baseCents: 18900, requiresTicketCode: true, stock: 60,
    rules: [
      { title: 'Sabor de las palomitas', kind: 'flavor', min: 1, max: 2, allowSplit: true, options: POPCORN },
      { title: 'Primer refresco', kind: 'choice', min: 1, max: 1, options: SODAS },
      { title: 'Segundo refresco', kind: 'choice', min: 1, max: 1, options: SODAS }
    ] },
  { id: 'p-2', apiId: '14302', name: 'Combo individual', description: 'Palomitas medianas y un refresco mediano', categoryId: 'cat-combos', structure: 'combo', baseCents: 12900, requiresTicketCode: true, stock: 80,
    rules: [
      { title: 'Sabor de las palomitas', kind: 'flavor', min: 1, max: 1, options: POPCORN },
      { title: 'Refresco', kind: 'choice', min: 1, max: 1, options: SODAS }
    ] },
  { id: 'p-3', apiId: '16101', name: 'Palomitas', description: 'Recién hechas, con tu sabor favorito', categoryId: 'cat-palomitas', structure: 'compound', baseCents: 7400, requiresTicketCode: true, stock: 220,
    rules: [
      { title: 'Tamaño', kind: 'size', min: 1, max: 1, options: SIZES },
      { title: 'Sabor', kind: 'flavor', min: 1, max: 2, allowSplit: true, options: POPCORN }
    ] },
  { id: 'p-4', apiId: '16201', name: 'Refresco', description: 'Bien frío, en el sabor que elijas', categoryId: 'cat-bebidas', structure: 'compound', baseCents: 5400, requiresTicketCode: true, stock: 300,
    rules: [
      { title: 'Tamaño', kind: 'size', min: 1, max: 1, options: SIZES },
      { title: 'Sabor', kind: 'flavor', min: 1, max: 1, options: SODAS }
    ] },
  { id: 'p-5', apiId: '16301', name: 'Agua natural', description: 'Botella de 600 ml', categoryId: 'cat-bebidas', structure: 'simple', baseCents: 3500, requiresTicketCode: true, stock: 140, rules: [] },
  { id: 'p-6', apiId: '17101', name: 'Nachos con queso', description: 'Totopos con queso caliente', categoryId: 'cat-alimentos', structure: 'compound', baseCents: 7900, requiresTicketCode: true, stock: 90,
    rules: [{ title: 'Adicionales', kind: 'extra', min: 0, max: 3, options: [{ name: 'Jalapeños', extraCents: 1200 }, { name: 'Queso extra', extraCents: 1800 }, { name: 'Salsa picante', extraCents: 500 }] }] },
  { id: 'p-7', apiId: '17201', name: 'Hot dog clásico', description: 'Con papas y aderezos', categoryId: 'cat-alimentos', structure: 'simple', baseCents: 8900, requiresTicketCode: true, stock: 50, rules: [] },
  { id: 'p-8', apiId: '18101', name: 'Gomitas', description: 'Bolsa de 150 g', categoryId: 'cat-dulces', structure: 'simple', baseCents: 4500, requiresTicketCode: true, stock: 120, rules: [] },
  { id: 'p-9', apiId: '18201', name: 'Chocolate', description: 'Barra de 100 g', categoryId: 'cat-dulces', structure: 'simple', baseCents: 4200, requiresTicketCode: true, stock: 0, rules: [] },
  { id: 'p-10', apiId: '19101', name: 'Vaso coleccionable', description: 'Edición limitada de 800 ml', categoryId: 'cat-promocionales', structure: 'simple', baseCents: 32900, requiresTicketCode: false, stock: 24, rules: [] }
]

/** Diferencia de precio por complejo, en centavos, sobre el precio base de la cadena. */
export const CATALOG_MARKUP: Record<string, number> = {
  'xal-centro': 0, 'xal-centro-vip': 2000, 'xal-animas': -400, 'ver-boulevard': 600, 'ver-puerto': 400,
  'boca-costa': 800, 'coatza-malecon': -600, 'cordoba-parque': -800
}

/* Promociones y Club */

export const PROMOTION_SEEDS = [
  { id: 'promo-martes', name: '2×1 todos los martes', kind: '2x1', description: 'Dos boletos al precio de uno en salas tradicionales 2D.', restrictions: 'En cada par no se cobra el boleto de menor precio. No es acumulable.',
    validFrom: -30, validTo: 120, appliesToAll: true, complexIds: [] as string[], clubLevelId: null as string | null, rules: { weekdays: [2], roomTypes: ['traditional'], projections: ['2d'], percent: null as number | null } },
  { id: 'promo-imax', name: 'Jueves IMAX', kind: 'percent', description: '20 % menos en boletos IMAX.', restrictions: 'Solo funciones de jueves. No es acumulable.',
    validFrom: -30, validTo: 60, appliesToAll: true, complexIds: [], clubLevelId: null, rules: { weekdays: [4], roomTypes: ['imax'], projections: [], percent: 20 } },
  { id: 'promo-puntos', name: 'Puntos dobles', kind: 'double-points', description: 'El doble de puntos de viernes a domingo.', restrictions: 'Solo socios del Club. Solo cuenta para boletos.',
    validFrom: -30, validTo: 90, appliesToAll: false, complexIds: ['xal-centro', 'ver-boulevard', 'boca-costa'], clubLevelId: 'lvl-fanatico', rules: { weekdays: [5, 6, 0], roomTypes: [], projections: [], percent: null } },
  { id: 'promo-msi', name: 'Meses sin intereses', kind: 'informative', description: 'Campaña bancaria para compras desde $600.', restrictions: 'Informativa: no se aplica en línea.',
    validFrom: -10, validTo: null as number | null, appliesToAll: true, complexIds: [], clubLevelId: null, rules: { weekdays: [], roomTypes: [], projections: [], percent: null } }
]

export const CLUB_LEVEL_SEEDS = [
  { id: 'lvl-fan', name: 'Fan', minVisits: 0, maxVisits: 3 as number | null, pointsPercent: 5, benefits: 'Acumula puntos en boletos y dulcería.' },
  { id: 'lvl-fanatico', name: 'Fanático', minVisits: 4, maxVisits: 9, pointsPercent: 7, benefits: 'Promociones exclusivas y preventas anticipadas.' },
  { id: 'lvl-super', name: 'Súper Fanático', minVisits: 10, maxVisits: null, pointsPercent: 10, benefits: 'Funciones privadas y regalos de temporada.' }
]

/* Contenido */

export const BANNER_SEEDS = [
  { id: 'ban-1', title: '2×1 los martes', imageUrl: '/banners/martes-2x1.jpg', targetUrl: '/promociones', startsOn: -10, endsOn: 60 as number | null, active: true, appliesToAll: true, complexIds: [] as string[] },
  { id: 'ban-2', title: 'Pide tu dulcería en línea', imageUrl: '/banners/dulceria.jpg', targetUrl: '/dulceria', startsOn: -30, endsOn: null, active: true, appliesToAll: true, complexIds: [] },
  { id: 'ban-3', title: 'Preventa Ciudad de sombras', imageUrl: '/banners/ciudad-de-sombras.jpg', targetUrl: '/peliculas/ciudad-de-sombras', startsOn: -2, endsOn: 9, active: true, appliesToAll: false, complexIds: ['xal-centro', 'boca-costa'] }
]

export const FAQ_SEED = [
  { question: '¿Necesito boletos para pedir dulcería en línea?', answer: 'Sí. Los alimentos requieren el folio de una compra de boletos vigente del mismo complejo.' },
  { question: '¿Puedo usar mi folio más de una vez?', answer: 'Sí. Admite varios pedidos hasta que termine tu función.' },
  { question: '¿Puedo cancelar mi compra?', answer: 'Sí, hasta 60 minutos antes de la función. El reembolso se procesa con el mismo método de pago.' }
]

export const PAGE_SEEDS = [
  { slug: 'terminos', title: 'Términos de uso', body: 'Borrador. El texto definitivo lo proporcionará el área jurídica.' },
  { slug: 'privacidad', title: 'Aviso de privacidad', body: 'Borrador. El aviso definitivo debe cumplir la ley federal de protección de datos personales vigente.' },
  { slug: 'facturacion', title: 'Facturación', body: 'La facturación electrónica estará disponible cuando se integre el proveedor autorizado.' },
  { slug: 'contacto', title: 'Contacto', body: 'Los medios de contacto se publicarán antes del lanzamiento.' }
]

/* Empleados */

export const ROLE_SEEDS = [
  { id: 'rol-gerente', name: 'Gerente', isManager: true, responsibilities: 'Responsable de la operación y resultados del complejo.', area: 'Dirección' },
  { id: 'rol-sub-admin', name: 'Subgerente administrativo', isManager: true, responsibilities: 'Caja, cortes, inventario y personal.', area: 'Administración' },
  { id: 'rol-supervisor', name: 'Supervisor', isManager: true, responsibilities: 'Coordina turnos de taquilla y dulcería.', area: 'Operación' },
  { id: 'rol-taquilla', name: 'Taquillero', isManager: false, responsibilities: 'Venta de boletos en taquilla.', area: 'Taquilla' },
  { id: 'rol-dulceria', name: 'Dulcería', isManager: false, responsibilities: 'Preparación y entrega de alimentos.', area: 'Dulcería' },
  { id: 'rol-proyeccion', name: 'Técnico de proyección', isManager: false, responsibilities: 'Operación de proyectores y sonido.', area: 'Proyección' }
]

const FIRST = ['Mariana', 'Carlos', 'Fernanda', 'Jorge', 'Daniela', 'Ricardo', 'Valeria', 'Emilio', 'Paola', 'Héctor', 'Lucía', 'Andrés']
const LAST = ['López', 'Méndez', 'Ruiz', 'Sánchez', 'Hernández', 'Martínez', 'García', 'Ortega', 'Domínguez', 'Vázquez', 'Castillo', 'Rojas']

export function employeeSeeds() {
  return COMPLEX_SEEDS.flatMap((complex, ci) => ['rol-gerente', 'rol-supervisor', 'rol-taquilla', 'rol-dulceria'].map((roleId, ri) => {
    const n = ci * 4 + ri
    const first = FIRST[n % FIRST.length]!
    const last = LAST[(n * 5) % LAST.length]!
    const second = LAST[(n * 7 + 3) % LAST.length]!
    return {
      id: `emp-${n + 1}`, firstName: first, lastName: last, secondLastName: second,
      email: `${first.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}.${last.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}${n + 1}@cinepolis.test`,
      phone: `228${String(1000000 + n * 7919).slice(0, 7)}`,
      birthDate: `${1975 + (n % 25)}-${String((n % 12) + 1).padStart(2, '0')}-${String((n % 27) + 1).padStart(2, '0')}`,
      hiredOn: `${2012 + (n % 12)}-${String(((n * 3) % 12) + 1).padStart(2, '0')}-01`,
      salaryCents: [3_200_000, 1_850_000, 980_000, 920_000][ri]!,
      status: n % 11 === 10 ? 'inactive' : n % 13 === 7 ? 'leave' : 'active',
      complexId: complex.id, roleId
    }
  }))
}

/* Ventas de demostración por complejo: no salen de los pedidos registrados. */

export const SALES_SEEDS: Record<string, { ticketsPerDay: number; ticketPriceCents: number; foodPerTicketCents: number; otherPerTicketCents: number }> = {
  'xal-centro': { ticketsPerDay: 690, ticketPriceCents: 7600, foodPerTicketCents: 3100, otherPerTicketCents: 600 },
  'xal-centro-vip': { ticketsPerDay: 210, ticketPriceCents: 16500, foodPerTicketCents: 9800, otherPerTicketCents: 900 },
  'xal-animas': { ticketsPerDay: 520, ticketPriceCents: 7300, foodPerTicketCents: 2800, otherPerTicketCents: 500 },
  'ver-boulevard': { ticketsPerDay: 760, ticketPriceCents: 8000, foodPerTicketCents: 3300, otherPerTicketCents: 700 },
  'ver-puerto': { ticketsPerDay: 480, ticketPriceCents: 7800, foodPerTicketCents: 2900, otherPerTicketCents: 600 },
  'boca-costa': { ticketsPerDay: 820, ticketPriceCents: 8600, foodPerTicketCents: 3500, otherPerTicketCents: 800 },
  'coatza-malecon': { ticketsPerDay: 430, ticketPriceCents: 7000, foodPerTicketCents: 2500, otherPerTicketCents: 500 },
  'cordoba-parque': { ticketsPerDay: 390, ticketPriceCents: 6800, foodPerTicketCents: 2400, otherPerTicketCents: 400 }
}
