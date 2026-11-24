/** Sesión, datos de referencia, complejos, salas, películas y funciones. */
import type { ScheduleRequest } from '@/domain/models'
import { movieDatesProblem, slugify } from '@/domain/rules'
import { CITIES, CLEANING_MINUTES, GENRES, LANGUAGES, LOGIN_LOCK_ATTEMPTS, LOGIN_LOCK_MINUTES, MAX_BATCH, PROJECTIONS, RATINGS, ROOM_TYPES, USERS } from '../fixtures'
import { planScreenings } from '../planner'
import type { MovieRec, ScreeningRec } from '../store'
import {
  body, checkVersion, fail, idempotent, integer, invalid, isoDate, list, logActivity, nextId, noContent, nullableText, ok,
  randomToken, requireScope, route, sessionOf, strings, text, userById, type Context
} from './core'
import {
  capacityOf, complexJson, movieJson, nowLocal, projectionLabel, roomJson, roomTypeLabel, screeningJson, templateJson, templateOf,
  ticketsSold, upcoming
} from './views'

/* Sesión */

function sessionJson(ctx: Context) {
  const session = sessionOf(ctx.state, ctx.request.sid)
  const user = userById(session.userId)
  return {
    user: user ? { id: user.id, name: user.name, email: user.email, roleName: user.roleName } : null,
    permissions: user?.permissions ?? [],
    complexIds: user?.complexIds ?? null,
    csrfToken: session.csrf
  }
}

route('GET', '/session', null, ctx => ok(sessionJson(ctx)))

route('POST', '/session', null, ctx => {
  const input = body(ctx)
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const attempts = ctx.state.logins[email] ?? { failures: 0, lockedUntil: 0 }
  if (attempts.lockedUntil > ctx.now) fail(423, 'ACCOUNT_LOCKED', undefined, { retryAfter: Math.ceil((attempts.lockedUntil - ctx.now) / 1000) })
  const user = USERS.find(item => item.email === email)
  if (!user || user.password !== password) {
    attempts.failures++
    if (attempts.failures >= LOGIN_LOCK_ATTEMPTS) {
      attempts.failures = 0
      attempts.lockedUntil = ctx.now + LOGIN_LOCK_MINUTES * 60_000
    }
    ctx.state.logins[email] = attempts
    // El mismo mensaje para correo y contraseña: no revela qué cuentas existen.
    fail(401, 'INVALID_CREDENTIALS')
  }
  delete ctx.state.logins[email]
  // Sesión nueva al entrar: evita fijación de sesión.
  ctx.state.sessions[ctx.request.sid] = { csrf: randomToken(), userId: user!.id, startedAt: ctx.now }
  return ok(sessionJson(ctx))
})

route('DELETE', '/session', 'any', ctx => {
  ctx.state.sessions[ctx.request.sid] = { csrf: randomToken(), userId: null, startedAt: ctx.now }
  return ok(sessionJson(ctx))
})

/* Datos de referencia */

route('GET', '/reference-data', 'any', ctx => ok({
  serverNow: new Date(ctx.now).toISOString(),
  cities: CITIES,
  complexes: ctx.state.complexes.map(complex => complexJson(ctx.state, complex.id)),
  roomTypes: ROOM_TYPES.map(({ code, name }) => ({ code, name })),
  projections: PROJECTIONS.map(({ code, name }) => ({ code, name })),
  languages: LANGUAGES,
  ratings: RATINGS,
  genres: GENRES,
  limits: { maxScreeningsPerBatch: MAX_BATCH, cleaningMinutes: CLEANING_MINUTES }
}))

/* Complejos, salas y plano de asientos */

route('PUT', '/complexes/:id', 'complexes.manage', ctx => {
  const complex = ctx.state.complexes.find(c => c.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(complex, input.version)
  const slug = slugify(text(input, 'slug', 'la URL amigable', { max: 80 }))
  if (ctx.state.complexes.some(c => c.id !== complex.id && c.slug === slug)) fail(409, 'DUPLICATE', 'Otro complejo ya usa esa URL amigable.')
  const cityId = text(input, 'cityId', 'la ciudad')
  if (!CITIES.some(city => city.id === cityId)) invalid('La ciudad no existe.', 'cityId')
  const postalCode = text(input, 'postalCode', 'el código postal', { max: 5 })
  if (!/^\d{5}$/.test(postalCode)) invalid('El código postal tiene 5 dígitos.', 'postalCode')
  Object.assign(complex, {
    name: text(input, 'name', 'el nombre comercial', { max: 120 }), slug, kind: input.kind === 'vip' ? 'vip' : 'traditional', cityId,
    address: text(input, 'address', 'la dirección', { max: 200 }), postalCode,
    openedOn: isoDate(input, 'openedOn', 'Fecha de apertura')!, imageUrl: nullableText(input, 'imageUrl', 'La imagen'),
    vistaId: nullableText(input, 'vistaId', 'El ID de Vista'), version: complex.version + 1
  })
  logActivity(ctx, 'Complejos', `Actualizó los datos de ${complex.name}.`)
  return ok(complexJson(ctx.state, complex.id))
})

route('GET', '/complexes/:id/rooms', 'any', ctx => {
  const rooms = ctx.state.rooms.filter(room => room.complexId === ctx.params[0]).sort((a, b) => a.number - b.number)
  return ok({ items: rooms.map(room => roomJson(ctx.state, room)) })
})

route('PUT', '/rooms/:id', 'complexes.manage', ctx => {
  const room = ctx.state.rooms.find(r => r.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(room, input.version)
  const type = text(input, 'type', 'el tipo de sala')
  if (!ROOM_TYPES.some(t => t.code === type)) invalid('Tipo de sala desconocido.', 'type')
  const projections = strings(input, 'projections')
  if (!projections.length) invalid('Una sala debe admitir al menos una proyección.', 'projections')
  if (projections.some(code => !PROJECTIONS.some(p => p.code === code))) invalid('Proyección desconocida.', 'projections')
  const future = upcoming(ctx.state, ctx.now, s => s.roomId === room.id)
  if (type !== room.type && future.length) {
    fail(409, 'RESOURCE_IN_USE', `La sala tiene ${future.length} funciones programadas. Retíralas antes de cambiar su tipo.`)
  }
  const lost = future.find(s => !projections.includes(s.projection))
  if (lost) fail(409, 'RESOURCE_IN_USE', `Hay funciones en ${projectionLabel(lost.projection).name} programadas en esta sala, por ejemplo el ${lost.date} a las ${lost.startTime}.`)
  Object.assign(room, { name: text(input, 'name', 'el nombre', { max: 60 }), type, projections, version: room.version + 1 })
  logActivity(ctx, 'Complejos', `Actualizó la sala ${room.number} de ${ctx.state.complexes.find(c => c.id === room.complexId)?.name}.`)
  return ok(roomJson(ctx.state, room))
})

route('GET', '/rooms/:id/seat-template', 'any', ctx => {
  const room = ctx.state.rooms.find(r => r.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  return ok(templateJson(ctx.state, room))
})

route('PUT', '/rooms/:id/seat-template', 'complexes.manage', ctx => {
  const room = ctx.state.rooms.find(r => r.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(templateOf(ctx.state, room), input.version)
  const labels = new Set<string>()
  const rows = list(input, 'rows').map(raw => {
    const row = raw as { label?: unknown; seats?: unknown }
    const label = typeof row.label === 'string' ? row.label.trim().toUpperCase() : ''
    if (!/^[A-Z]{1,2}$/.test(label)) invalid('Cada fila necesita una letra (A, B… AA).', 'rows')
    if (labels.has(label)) invalid(`La fila ${label} está repetida.`, 'rows')
    labels.add(label)
    if (!Array.isArray(row.seats) || !row.seats.length) invalid(`La fila ${label} no tiene asientos.`, 'rows')
    const columns = new Set<number>()
    const seats = (row.seats as { column?: unknown; kind?: unknown }[]).map(seat => {
      if (typeof seat.column !== 'number' || !Number.isInteger(seat.column) || seat.column < 1 || seat.column > 40) invalid(`Fila ${label}: columna inválida.`, 'rows')
      if (columns.has(seat.column as number)) invalid(`Fila ${label}: la columna ${String(seat.column)} está repetida.`, 'rows')
      columns.add(seat.column as number)
      const kind = ['standard', 'accessible', 'companion', 'premium'].includes(String(seat.kind)) ? String(seat.kind) : 'standard'
      return { column: seat.column as number, kind }
    })
    return { label, seats: seats.sort((a, b) => a.column - b.column) }
  })
  if (!rows.length || rows.length > 30) invalid('La sala debe tener de 1 a 30 filas.', 'rows')
  // Igual que el disparador trg_generar_asientos: el plano solo afecta a las funciones que se creen después.
  ctx.state.templates[room.id] = { version: templateOf(ctx.state, room).version + 1, rows }
  logActivity(ctx, 'Complejos', `Actualizó el plano de la sala ${room.number}: ${capacityOf(ctx.state.templates[room.id]!)} asientos.`)
  return ok(templateJson(ctx.state, room))
})

/* Películas */

function readMovie(ctx: Context, current: MovieRec | null): Omit<MovieRec, 'id' | 'version'> {
  const input = body(ctx)
  const title = text(input, 'title', 'el título', { max: 150 })
  const slug = slugify(text(input, 'slug', 'la URL amigable', { optional: true, max: 80 }) || title)
  if (!slug) invalid('La URL amigable no es válida.', 'slug')
  if (ctx.state.movies.some(m => m.id !== current?.id && m.slug === slug)) fail(409, 'DUPLICATE', `Ya existe una película con la URL "${slug}".`)
  const rating = text(input, 'rating', 'la clasificación')
  if (!RATINGS.some(r => r.code === rating)) invalid('Clasificación desconocida.', 'rating')
  const genres = strings(input, 'genres')
  if (!genres.length) invalid('Elige al menos un género.', 'genres')
  const media = (input.media ?? {}) as Record<string, unknown>
  const dates = {
    releaseDate: isoDate(input, 'releaseDate', 'Estreno', true),
    presaleFrom: isoDate(input, 'presaleFrom', 'Preventa', true),
    lastDay: isoDate(input, 'lastDay', 'Último día', true)
  }
  const problem = movieDatesProblem(dates)
  if (problem) invalid(problem, 'releaseDate')
  const cast = list(input, 'cast').map(raw => {
    const person = raw as { name?: unknown; role?: unknown }
    const name = typeof person.name === 'string' ? person.name.trim() : ''
    if (!name) invalid('Cada persona del reparto necesita nombre.', 'cast')
    return { name, role: person.role === 'director' ? 'director' : 'actor' }
  })
  return {
    title, slug, rating, genres, durationMinutes: integer(input, 'durationMinutes', 'La duración', 1, 600),
    synopsis: text(input, 'synopsis', 'la sinopsis', { max: 2000 }), category: text(input, 'category', 'la categoría', { max: 60 }),
    isSpecialEvent: input.isSpecialEvent === true, posterUrl: nullableText(media, 'posterUrl', 'El póster'),
    bannerUrl: nullableText(media, 'bannerUrl', 'La imagen horizontal'), trailerUrl: nullableText(media, 'trailerUrl', 'El tráiler'),
    vistaId: nullableText(input, 'vistaId', 'El ID de Vista'), cast, ...dates
  }
}

route('GET', '/movies', 'any', ctx => ok({ items: ctx.state.movies.map(movie => movieJson(ctx.state, movie, ctx.now)) }))

route('POST', '/movies', 'movies.manage', ctx => {
  const movie: MovieRec = { id: nextId(ctx.state, 'm'), version: 1, ...readMovie(ctx, null) }
  ctx.state.movies.unshift(movie)
  logActivity(ctx, 'Películas', `Registró ${movie.title}.`)
  return ok(movieJson(ctx.state, movie, ctx.now), 201)
})

route('PUT', '/movies/:id', 'movies.manage', ctx => {
  const movie = ctx.state.movies.find(m => m.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  checkVersion(movie, body(ctx).version)
  const next = readMovie(ctx, movie)
  const scheduled = upcoming(ctx.state, ctx.now, s => s.movieId === movie.id)
  if (scheduled.length && next.durationMinutes !== movie.durationMinutes) {
    fail(409, 'RESOURCE_IN_USE', `Tiene ${scheduled.length} funciones programadas. Retíralas para cambiar la duración.`)
  }
  const outside = scheduled.find(s => (next.releaseDate && s.date < next.releaseDate) || (next.lastDay && s.date > next.lastDay))
  if (outside) fail(409, 'RESOURCE_IN_USE', `Hay una función el ${outside.date} fuera de esas fechas. Retírala primero.`)
  Object.assign(movie, next, { version: movie.version + 1 })
  logActivity(ctx, 'Películas', `Actualizó ${movie.title}.`)
  return ok(movieJson(ctx.state, movie, ctx.now))
})

route('DELETE', '/movies/:id', 'movies.manage', ctx => {
  const movie = ctx.state.movies.find(m => m.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  checkVersion(movie, Number(ctx.request.query.get('version')))
  const scheduled = upcoming(ctx.state, ctx.now, s => s.movieId === movie.id)
  if (scheduled.length) fail(409, 'RESOURCE_IN_USE', `Tiene ${scheduled.length} funciones programadas. Retíralas primero en Funciones y horarios.`)
  if (ctx.state.screenings.some(s => s.movieId === movie.id)) {
    fail(409, 'RESOURCE_IN_USE', 'Tiene funciones pasadas con ventas registradas. Se conserva para los reportes; márcala con un último día.')
  }
  ctx.state.movies = ctx.state.movies.filter(m => m.id !== movie.id)
  logActivity(ctx, 'Películas', `Retiró ${movie.title} del catálogo.`)
  return noContent()
})

/* Funciones */

route('GET', '/screenings', 'any', ctx => {
  const from = ctx.request.query.get('from') ?? fail(400, 'MALFORMED_REQUEST', 'Falta from.')
  const to = ctx.request.query.get('to') ?? fail(400, 'MALFORMED_REQUEST', 'Falta to.')
  const complexId = ctx.request.query.get('complexId')
  const movieId = ctx.request.query.get('movieId')
  const roomIds = new Set(ctx.state.rooms.filter(room =>
    (!complexId || room.complexId === complexId) && (ctx.user.complexIds === null || ctx.user.complexIds.includes(room.complexId))).map(room => room.id))
  const items = ctx.state.screenings
    .filter(s => s.date >= from && s.date <= to && roomIds.has(s.roomId) && (!movieId || s.movieId === movieId))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    .map(s => screeningJson(ctx.state, s))
  return ok({ items })
})

function readSchedule(ctx: Context): ScheduleRequest {
  const input = body(ctx)
  const request: ScheduleRequest = {
    movieIds: strings(input, 'movieIds'), languages: strings(input, 'languages'), complexIds: strings(input, 'complexIds'),
    roomTypes: strings(input, 'roomTypes'), projections: strings(input, 'projections'), roomIds: strings(input, 'roomIds'),
    dates: strings(input, 'dates'), times: strings(input, 'times')
  }
  if (!request.movieIds.length || !request.languages.length || !request.complexIds.length || !request.roomTypes.length ||
    !request.projections.length || !request.dates.length || !request.times.length) invalid('Completa los cuatro pasos.')
  if (request.times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) invalid('Hay un horario inválido.', 'times')
  if (request.dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) invalid('Hay una fecha inválida.', 'dates')
  request.complexIds.forEach(id => requireScope(ctx, id))
  return request
}

function plan(ctx: Context, request: ScheduleRequest, excluded?: Set<string>) {
  const { state } = ctx
  return planScreenings({
    request, excluded, cleaningMinutes: CLEANING_MINUTES, maxBatch: MAX_BATCH, now: nowLocal(ctx.now),
    movies: state.movies, rooms: state.rooms,
    existing: state.screenings.filter(s => s.active).map(s => {
      const movie = state.movies.find(m => m.id === s.movieId)
      return { ...s, durationMinutes: movie?.durationMinutes ?? 120, title: movie?.title ?? 'otra función' }
    }),
    names: { roomType: code => roomTypeLabel(code).name, projection: code => projectionLabel(code).name }
  })
}

function planJson(rows: ReturnType<typeof plan>['rows']) {
  return rows.map(row => ({
    key: row.key, movieId: row.movie.id, movieTitle: row.movie.title, complexId: row.complexId,
    room: row.room ? { id: row.room.id, number: row.room.number } : null,
    roomType: roomTypeLabel(row.roomType), projection: projectionLabel(row.projection),
    language: { code: row.language, name: LANGUAGES.find(l => l.code === row.language)?.name ?? row.language },
    date: row.date, startTime: row.startTime, endTime: row.endTime, endsNextDay: row.endsNextDay, problem: row.problem
  }))
}

route('POST', '/screening-batches/preview', 'screenings.manage', ctx => {
  const result = plan(ctx, readSchedule(ctx))
  return ok({ tooMany: result.tooMany, rows: planJson(result.rows) })
})

route('POST', '/screening-batches', 'screenings.manage', ctx => ok(idempotent(ctx, 'screening-batch', () => {
  const request = readSchedule(ctx)
  const excluded = new Set(strings(body(ctx), 'excludedKeys'))
  // Se vuelve a planear: pudo pasar la hora o alguien más pudo programar en esas salas.
  const result = plan(ctx, request, excluded)
  if (result.tooMany) invalid(`El lote supera ${MAX_BATCH} funciones.`)
  const created: ScreeningRec[] = result.rows.filter(row => !row.problem && !excluded.has(row.key) && row.room).map(row => ({
    id: nextId(ctx.state, 's'), version: 1, movieId: row.movie.id, roomId: row.room!.id, date: row.date, startTime: row.startTime,
    projection: row.projection, language: row.language, active: true
  }))
  if (!created.length) invalid('No hay funciones válidas para crear.')
  ctx.state.screenings.push(...created)
  const titles = [...new Set(created.map(s => ctx.state.movies.find(m => m.id === s.movieId)?.title))].join(', ')
  logActivity(ctx, 'Funciones', `Programó ${created.length} ${created.length === 1 ? 'función' : 'funciones'} de ${titles}.`)
  return { items: created.map(s => screeningJson(ctx.state, s)) }
}), 201))

route('PUT', '/screenings/:id', 'screenings.manage', ctx => {
  const screening = ctx.state.screenings.find(s => s.id === ctx.params[0]) ?? fail(404, 'NOT_FOUND')
  const input = body(ctx)
  checkVersion(screening, input.version)
  const room = ctx.state.rooms.find(r => r.id === text(input, 'roomId', 'la sala')) ?? invalid('La sala no existe.', 'roomId')
  requireScope(ctx, room.complexId)
  const sold = ticketsSold(ctx.state, screening.id)
  if (!upcoming(ctx.state, ctx.now, s => s.id === screening.id).length) fail(409, 'RESOURCE_IN_USE', 'La función ya empezó: no se puede modificar.')
  const next = {
    roomId: room.id, date: isoDate(input, 'date', 'Fecha')!, startTime: text(input, 'startTime', 'la hora'),
    projection: text(input, 'projection', 'la proyección'), language: text(input, 'language', 'el idioma'), active: input.active !== false
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.startTime)) invalid('Hora inválida.', 'startTime')
  const moves = next.roomId !== screening.roomId || next.date !== screening.date || next.startTime !== screening.startTime || !next.active
  if (sold && moves) fail(409, 'RESOURCE_IN_USE', `La función tiene ${sold} boletos vendidos. Cancélalos en Pedidos antes de moverla o desactivarla.`)
  if (!room.projections.includes(next.projection)) invalid(`La sala ${room.number} no proyecta en ${projectionLabel(next.projection).name}.`, 'projection')
  const movie = ctx.state.movies.find(m => m.id === screening.movieId)!
  if ((movie.releaseDate && next.date < movie.releaseDate) || (movie.lastDay && next.date > movie.lastDay)) invalid('La fecha está fuera de la exhibición de la película.', 'date')
  const { date, time } = nowLocal(ctx.now)
  if (moves && (next.date < date || (next.date === date && next.startTime <= time))) invalid('El horario ya pasó.', 'startTime')
  if (next.active) {
    const start = Date.parse(`${next.date}T${next.startTime}:00Z`) / 60000
    const end = start + movie.durationMinutes + CLEANING_MINUTES
    const clash = ctx.state.screenings.find(other => {
      if (other.id === screening.id || other.roomId !== room.id || !other.active) return false
      const otherMovie = ctx.state.movies.find(m => m.id === other.movieId)
      const otherStart = Date.parse(`${other.date}T${other.startTime}:00Z`) / 60000
      return start < otherStart + (otherMovie?.durationMinutes ?? 120) + CLEANING_MINUTES && otherStart < end
    })
    if (clash) {
      const title = ctx.state.movies.find(m => m.id === clash.movieId)?.title ?? 'otra función'
      fail(409, 'SCHEDULE_CONFLICT', `La sala ${room.number} está ocupada por ${title} a las ${clash.startTime}.`)
    }
  }
  Object.assign(screening, next, { version: screening.version + 1 })
  logActivity(ctx, 'Funciones', `Modificó ${movie.title} del ${screening.date} a las ${screening.startTime}.`)
  return ok(screeningJson(ctx.state, screening))
})

route('POST', '/screenings/removals', 'screenings.manage', ctx => {
  const ids = strings(body(ctx), 'ids')
  const targets = ids.map(id => ctx.state.screenings.find(s => s.id === id) ?? fail(404, 'NOT_FOUND'))
  for (const screening of targets) {
    requireScope(ctx, ctx.state.rooms.find(r => r.id === screening.roomId)!.complexId)
    const sold = ticketsSold(ctx.state, screening.id)
    if (sold) fail(409, 'RESOURCE_IN_USE', `Una de las funciones tiene ${sold} boletos vendidos. Cancélalos en Pedidos.`)
    if (!upcoming(ctx.state, ctx.now, s => s.id === screening.id).length) fail(409, 'RESOURCE_IN_USE', 'Una de las funciones ya empezó: se conserva como historial.')
  }
  ctx.state.screenings = ctx.state.screenings.filter(s => !ids.includes(s.id))
  logActivity(ctx, 'Funciones', `Retiró ${targets.length} ${targets.length === 1 ? 'función' : 'funciones'}.`)
  return noContent()
})
