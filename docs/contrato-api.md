# Contrato del API de gestión (`/api/admin/v1`)

Lo que el frontend del sistema de gestión espera del backend. La fuente ejecutable es `src/adapters/http/schemas.ts` (formas JSON) y `src/mocks/contract.test.ts` (reglas). El simulador de `src/mocks` implementa todo esto.

## Convenciones

- JSON en camelCase. Los IDs son texto (los `serial` de PostgreSQL se envían como cadena).
- Dinero: `{ "amount": 8550, "currency": "MXN" }`, en **centavos enteros**. Los `numeric` de la BD se convierten con aritmética decimal, nunca con `double`.
- Instantes (fechas de registro, actividad, cambios): ISO 8601 **con zona** (`2026-11-24T19:30:00-06:00`). Sin zona se rechaza como `MALFORMED_RESPONSE`.
- Fechas de negocio: `AAAA-MM-DD`. Horas de función: `HH:MM` locales del complejo, igual que `funcion.hora_inicio`.
- Listas: `{ "items": [...] }`.
- Errores: Problem Details (RFC 9457) con `code` estable; la interfaz decide por `code`. En reglas de negocio (`VALIDATION_FAILED`, `RESOURCE_IN_USE`, `SCHEDULE_CONFLICT`, `DUPLICATE`) el `detail` se muestra al usuario, así que debe estar en español y ser claro. `errors` lleva los campos con problema.
- Encabezados: `X-CSRF-Token` en escrituras, `Idempotency-Key` en las operaciones marcadas, `X-Correlation-Id` en todas.
- **Concurrencia optimista:** todo registro editable trae `version`. El cliente la reenvía al guardar (`PUT`, y en `DELETE` como `?version=`). Si cambió, `409 VERSION_CONFLICT`. En PostgreSQL puede usarse `xmin` o una columna `version` que se incrementa en cada `UPDATE`.

## Sesión y permisos

| Método y ruta | Uso |
| --- | --- |
| `GET /session` | Sesión actual y token CSRF. Crea una sesión anónima si no existe. |
| `POST /session` | `{ login, password }` → sesión. `login` es el correo o el nombre de usuario de `usuario_admin` (sin distinguir mayúsculas). Credenciales incorrectas: `401 INVALID_CREDENTIALS` (mismo error si la cuenta no existe o está desactivada). Al entrar se actualiza `ultimo_acceso`. Tras 5 fallos, `423 ACCOUNT_LOCKED` por 15 minutos con `Retry-After`. Emite una sesión nueva (evita fijación). |
| `DELETE /session` | Cierra la sesión. |

```json
{
  "user": { "id": "u-1", "name": "Ana Torres", "username": "admin", "email": "admin@cinepolis.test", "roleName": "Administrador del sistema" },
  "permissions": ["dashboard.view", "movies.manage", "..."],
  "complexId": null,
  "csrfToken": "…"
}
```

- `user` sale de `usuario_admin` (`username`, `correo`), del empleado ligado (`name` = nombre y apellido) y del puesto (`roleName` = `rol.nombre`).
- `complexId` = `usuario_admin.complejo_id`. **`null` = administrador:** todos los permisos sobre toda la cadena. Con un complejo, la cuenta solo lee y modifica lo de ese complejo; el servidor filtra las lecturas y rechaza con `403 FORBIDDEN` cualquier lectura o escritura de otro complejo (salas, plano, tarifas, catálogo, historial de precios, funciones y personal). La versión VIP de una plaza es otro complejo.
- Una cuenta desactivada (`activo = false`) pierde el acceso también en las sesiones que ya tenía abiertas.
- Permisos: `dashboard.view`, `movies.manage`, `screenings.manage`, `products.manage`, `content.manage`, `prices.manage`, `promotions.manage`, `complexes.manage`, `employees.manage`, `settings.view`. Un permiso desconocido se ignora en el cliente.
- Sin sesión: `401 SESSION_REQUIRED`. Sesión vencida (absoluta de 12 horas): `401 SESSION_EXPIRED`. Sin permiso: `403 FORBIDDEN`. Sin CSRF válido: `403 CSRF_INVALID` (el cliente renueva el token con `GET /session` y repite una vez).
- Lo que es de toda la cadena solo lo modifica el administrador (`complexId: null`), aunque la cuenta tenga el permiso del módulo: productos y categorías de dulcería, tipos de boleto y puestos. Películas, contenido web y promociones requieren permisos que solo tiene el administrador.
- Permisos de una cuenta de complejo (en el simulador): `dashboard.view`, `screenings.manage`, `products.manage`, `prices.manage`, `complexes.manage`, `employees.manage`, `settings.view`. En el backend real los asigna el servidor; el cliente solo los obedece.

## Endpoints

| Método y ruta | Permiso | Notas |
| --- | --- | --- |
| `GET /reference-data` | sesión | `serverNow`, ciudades, complejos (con `roomCount` y `seatCount`), tipos de sala, proyecciones, idiomas, clasificaciones, géneros y límites (`maxScreeningsPerBatch`, `cleaningMinutes`). |
| `PUT /complexes/{id}` | `complexes.manage` | Datos del complejo. `slug` único. |
| `GET /complexes/{id}/rooms` | sesión | Salas con tipo, proyecciones y capacidad. |
| `PUT /rooms/{id}` | `complexes.manage` | Nombre, tipo y proyecciones. Con funciones futuras no se cambia el tipo ni se quita una proyección en uso (`RESOURCE_IN_USE`). |
| `GET`/`PUT /rooms/{id}/seat-template` | sesión / `complexes.manage` | Plano: filas con `{ column, kind }`. Las columnas que faltan son pasillos. Solo afecta funciones creadas después. |
| `GET /movies` | sesión | Incluye `upcomingScreenings`. |
| `POST /movies`, `PUT /movies/{id}` | `movies.manage` | `slug` único (`DUPLICATE`). Con funciones programadas no cambia la duración ni las fechas que las dejarían fuera. |
| `DELETE /movies/{id}?version=` | `movies.manage` | Solo sin funciones (pasadas o futuras); si no, `RESOURCE_IN_USE`. |
| `GET /screenings?from&to&complexId&movieId` | sesión | Rango de fechas obligatorio. Filtrado por alcance. |
| `POST /screening-batches/preview` | `screenings.manage` | Planea el lote: un renglón por combinación, con sala asignada o `problem`. |
| `POST /screening-batches` | `screenings.manage` | **Idempotente.** `{ ...solicitud, excludedKeys }`. Vuelve a planear y crea solo lo válido. |
| `PUT /screenings/{id}` | `screenings.manage` | Sala, fecha, hora, proyección, idioma y activa. Con boletos vendidos solo cambia idioma o proyección. Traslape: `SCHEDULE_CONFLICT`. |
| `POST /screenings/removals` | `screenings.manage` | `{ ids }`. Rechaza funciones con boletos o que ya empezaron. |
| `GET /ticket-types`, `POST`, `PUT /ticket-types/{id}` | sesión / `prices.manage` | `fixedPrice` para boletos de precio fijo. |
| `GET`/`PUT /complexes/{id}/ticket-prices` | sesión / `prices.manage` | Hoja de precios completa del complejo con versión. |
| `GET /product-categories`, `POST` | sesión / `products.manage` + cadena | |
| `GET /products`, `POST`, `PUT /products/{id}` | sesión / `products.manage` + cadena | Reglas y opciones anidadas; IDs que empiezan con `tmp-` son nuevos. Al cambiar opciones se ajustan los catálogos. |
| `GET /complexes/{id}/catalog` | sesión | Producto, precio local, disponibilidad y opciones. No hay existencias. |
| `PUT /complexes/{id}/catalog/{productId}` | `products.manage` | Crea o actualiza. Cada cambio de precio entra en el historial. Una regla obligatoria no puede quedar sin opciones activas. |
| `DELETE /complexes/{id}/catalog/{productId}?version=` | `products.manage` | |
| `GET /complexes/{id}/price-history` | sesión | |
| `PUT /complexes/{id}/catalog/{productId}/availability` | `products.manage` | `{ version, available }`. Marca a mano el producto como disponible o no disponible en ese complejo; no toca precio ni opciones. Queda en la bitácora. |
| `GET /promotions`, `POST`, `PUT /promotions/{id}` | sesión / `promotions.manage` | |
| `GET /club-levels`, `PUT /club-levels/{id}` | sesión / `promotions.manage` | |
| `GET`/`PUT /content/home` | sesión / `content.manage` | Películas destacadas (máximo 8). |
| `GET /banners`, `POST`, `PUT /banners/{id}`, `DELETE /banners/{id}?version=` | sesión / `content.manage` | |
| `GET`/`PUT /content/faq` | sesión / `content.manage` | Lista completa con versión. |
| `GET /content/pages`, `PUT /content/pages/{slug}` | sesión / `content.manage` | |
| `GET`/`PUT /settings/purchase-rules` | sesión / `content.manage` | Asientos por compra, minutos de apartado, minutos para cancelar, días de cartelera. |
| `GET /employees`, `POST`, `PUT /employees/{id}` | `employees.manage` | Salario en `salary` (dinero). Los empleados no se borran: se dan de baja. |
| `GET /roles`, `POST`, `PUT /roles/{id}` | `employees.manage` | |
| `GET /activity?limit` | sesión | Bitácora de cambios: quién, cuándo, área y resumen. |

## Reglas que el backend debe garantizar

1. **Planeación del lote.** Para cada combinación película × complejo × tipo de sala × proyección × idioma × fecha × hora: usar las salas elegidas o la primera compatible y libre (primero las que admiten menos proyecciones), reservar los minutos de limpieza, detectar traslapes en minutos absolutos (también al cruzar la medianoche), no duplicar una función idéntica, y rechazar fechas fuera de la exhibición u horarios pasados. Al crear se vuelve a planear todo. Tope por lote: `maxScreeningsPerBatch`.
2. **Funciones con historia.** Una función que ya empezó o tiene boletos vendidos no se mueve, no se desactiva ni se borra. La función solo informa `hasTicketsSold` (booleano); la gestión no muestra cuántos boletos se vendieron.
3. **Plano por función.** Como el disparador `trg_generar_asientos`, el plano de la sala se copia al crear la función; cambiar el plano no altera funciones existentes.
4. **Precios explícitos.** La hoja de precios se guarda completa; el precio cobrado en una venta no cambia después.
5. **Bitácora.** Cada cambio del sistema de gestión queda registrado con el usuario.

## Errores (`code`)

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `VALIDATION_FAILED` | 422 | Datos inválidos; `detail` explica y `errors` señala campos. |
| `INVALID_CREDENTIALS` | 401 | Correo o contraseña incorrectos. |
| `ACCOUNT_LOCKED` | 423 | Demasiados intentos. |
| `SESSION_REQUIRED`, `SESSION_EXPIRED` | 401 | Sin sesión o sesión vencida. |
| `FORBIDDEN` | 403 | Sin permiso o fuera del alcance. |
| `CSRF_INVALID` | 403 | Token CSRF ausente o distinto. |
| `NOT_FOUND` | 404 | No existe. |
| `VERSION_CONFLICT` | 409 | Alguien más guardó antes. |
| `DUPLICATE` | 409 | Nombre, URL o correo repetido. |
| `RESOURCE_IN_USE` | 409 | Tiene funciones, boletos u otra dependencia. |
| `SCHEDULE_CONFLICT` | 409 | La sala está ocupada en ese horario. |
| `IDEMPOTENCY_CONFLICT` | 409 | Misma clave con otro cuerpo. |
| `MALFORMED_REQUEST` | 400 | Falta un parámetro o la forma es incorrecta. |
| `RATE_LIMITED` | 429 | Con `Retry-After`. |
| `SERVICE_UNAVAILABLE` | 5xx | Falla temporal; las lecturas se reintentan. |
