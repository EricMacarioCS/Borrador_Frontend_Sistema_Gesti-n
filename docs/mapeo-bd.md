# Del sistema de gestión a la base de datos

Cómo se relaciona cada módulo con las tablas del diagrama ER (`Diagrama ER cinepolis.pgerd`) y qué falta en el modelo. El contrato del API está en [contrato-api.md](contrato-api.md).

## 1. Conversiones que hace el backend

| Dato | En la BD | En el contrato |
| --- | --- | --- |
| Identificadores | `serial` | Texto: `"42"`. |
| Dinero | `numeric` en pesos | Centavos enteros (`{ amount, currency }`), convertidos con `decimal`, nunca con `double`. |
| Instantes | `timestamp` **sin** zona | ISO 8601 con zona. Se interpretan en `America/Mexico_City` (todos los complejos son de Veracruz). |
| Función | `fecha_funcion`, `hora_inicio`, `hora_termino` | `date`, `startTime`, `endTime` locales y `endsNextDay` cuando `hora_termino < hora_inicio`. |
| Proyección de la función | `funcion.formato_id` → `formato_sala` con `es_proyeccion = true` | `projection { code, name }` (2D, 3D). |
| Tipo de sala | `sala.tipo_sala` (texto) | `type { code, name }`. Conviene un catálogo o `CHECK` con los valores válidos. |
| Idioma | `funcion.idioma` (texto) | `language { code, name }`. |

## 2. Qué tabla alimenta cada módulo

| Módulo | Tablas | Observaciones |
| --- | --- | --- |
| Acceso y alcance | `usuario_admin` → `empleado`, `rol`, `complejo` | Se entra con `correo` o `username` y se valida contra `password_hash`. `activo = false` impide entrar. `ultimo_acceso` se actualiza al entrar. `complejo_id` nulo = administrador con toda la cadena; con complejo, la cuenta solo modifica ese complejo. El nombre visible sale del empleado ligado y el puesto de `rol`. |
| Complejos | `complejo`, `ciudad` | `kind` = `tipo_complejo`; `vista_id`, `slug`, `codigo_postal`, `fecha_apertura`, `imagen_url`. `roomCount` y `seatCount` se calculan. Falta zona horaria por complejo. |
| Salas | `sala`, `sala_formato_sala`, `formato_sala` | `capacidad_asientos` debe igualar el número de asientos de la plantilla (calcularla o validarla con un disparador). El disparador `trg_check_formato_proyeccion` ya impide asociar formatos que no son de proyección. |
| Plano de asientos | `asiento_plantilla` | `fila`, `columna`, `tipo_asiento`, `area_category_code`. Los pasillos se representan como columnas sin asiento: no hace falta columna nueva. `tipo_asiento` debería limitarse con `CHECK` a estándar, silla de ruedas, acompañante y preferente. |
| Películas | `pelicula`, `persona`, `pelicula_persona` | `genero` es texto libre: el sistema envía una lista y el backend la une con comas (o se normaliza en una tabla N:M). `categoria` = "Garantía Cinépolis" o "Normal". Las fechas de cartelera **no existen** (ver faltantes). |
| Funciones | `funcion` (+ `asiento` vía `trg_generar_asientos`) | `es_preventa` y `activa` existen. La restricción `uq_funcion_logica (sala, fecha, hora_inicio)` no evita traslapes: el servidor debe revisarlos (o usar una restricción de exclusión con rango de tiempo). El lote no tiene tabla: es una operación del API. |
| Función con boletos vendidos | `detalle_venta_boleto` → `asiento.funcion_id` | Solo se necesita saber si existe al menos un boleto (`hasTicketsSold`); la gestión no muestra cantidades ni importes. |
| Productos de la cadena | `producto_dulceria`, `categoria_dulceria`, `modificador_regla`, `modificador_opcion` | `estructura` = simple, compound o combo. Los combos se modelan con reglas de elección; no hay tabla de componentes. |
| Catálogo por complejo | `catalogo_complejo`, `detalle_catalogo`, `disponibilidad_modificador` | Precio en `detalle_catalogo.precio_actual`, disponibilidad en `disponibilidad` (el personal la marca a mano; no hay inventario). Opciones por complejo en `disponibilidad_modificador` (`activo`, `precio_extra`). El sistema usa un catálogo por complejo; la BD permite varios (por temporada). |
| Historial de precios | `historial_producto` | Se inserta en cada cambio de `precio_actual`. Falta quién hizo el cambio. |
| Tarifas | `precio_boleto`, `tipo_boleto` | Una fila por complejo + `formato_id` + `tipo_boleto_id` + `tipo_sala` (+ `area_category_code`, que el sistema aún no edita). `cargo_servicio_online` por fila. `tipo_boleto.precio_fijo` para boletos de precio fijo. |
| Promociones | `promocion`, `promocion_complejo` | `aplica_todos` o puente por complejo; `nivel_id` para promociones del Club; `restricciones` es texto. |
| Niveles del Club | `nivel_club` | Visitas mínimas y máximas por semestre, porcentaje de puntos y beneficios. |
| Banners | `banner_promo`, `banner_promo_complejo` | Igual que promociones: `aplica_todos` o puente. |
| Empleados | `empleado`, `rol` | `estatus` texto: el sistema usa activo, con permiso y baja. `salario` en `numeric`. No se borran: tienen sesiones de caja ligadas (`RESTRICT`). |

**No se administran aquí:** `cuenta_club` y `detalle_puntos` (socios), `garantia_reclamo` (reclamaciones), `sesion`, `corte_caja` y `punto_venta` (taquilla), `carrito` y `detalle_carrito` (sitio web), `folio` (vales de beneficio externo), `otp_verificacion` (acceso del sitio web). Tampoco ventas, pedidos, ingresos ni reportes (`venta` y sus detalles): por decisión del equipo, la gestión no los muestra.

## 3. Lo que falta para funciones del sistema

| # | Falta | Afecta | Propuesta |
| --- | --- | --- | --- |
| 1 | **Detalles de `usuario_admin`** | Acceso al sistema | La tabla ya existe en la nueva versión. Falta: `UNIQUE` en `correo` y `username`; `complejo_id` **nullable** (nulo = administrador) o, si se prefiere, un rol marcado como administrador; intentos fallidos y bloqueo (`intentos_fallidos`, `bloqueado_hasta`) o tabla aparte; tabla de sesiones del servidor. El hash debe ser Argon2id o bcrypt. |
| 2 | **Bitácora** | Actividad reciente, auditoría | Tabla `bitacora` (usuario, fecha `timestamptz`, área, entidad, id, resumen, cambios en `jsonb`). |
| 3 | Fechas de cartelera de la película | Próximamente, preventa, último día, validación de funciones | `pelicula.fecha_estreno`, `inicio_preventa`, `fecha_fin`. |
| 4 | Estado de la venta | Saber si una función ya vendió | Si el sitio guarda ventas sin pagar (apartados), `venta.estado` para contar solo las pagadas. |
| 5 | Reglas de promoción | Aplicarlas solas | Columnas para días, tipos de sala, proyecciones y porcentaje (o tabla de reglas). |
| 6 | Exigir folio por producto | Compra de alimentos en línea | `producto_dulceria.requiere_folio`. |
| 7 | Mitad y mitad | Reglas de sabores | `modificador_regla.permite_mitades`. |
| 8 | Configuración | Reglas de compra, limpieza entre funciones, tope del lote | Tabla `configuracion` (global y por complejo). |
| 9 | Contenido | Preguntas frecuentes, páginas legales, destacados de la portada | Tablas simples o un CMS; el contrato no cambia. |
| 10 | Concurrencia | Evitar que un cambio pise otro | `xmin` de PostgreSQL o columna `version` en las tablas editables. |
| 11 | Zona horaria | Instantes correctos | `timestamptz` en instantes; como mínimo `complejo.zona_horaria`. |
| 12 | Autor del cambio de precio | Historial | `historial_producto.usuario_id`. |

## 4. Preguntas para el equipo de base de datos

1. ¿Cómo se marca al administrador en `usuario_admin`: con `complejo_id` nulo (lo que asume el sistema) o con un rol especial? ¿`complejo_id` acepta nulos?
2. ¿Los permisos de una cuenta de complejo dependen de su `rol_id` (por ejemplo, un taquillero no debería editar tarifas) o son iguales para todas? Hoy el simulador da los mismos a todas.
3. ¿Quién crea la tabla de bitácora?
4. ¿`tipo_sala`, `idioma` y `estatus` tendrán catálogo o `CHECK`?
5. ¿Se usará `area_category_code` en las tarifas? Hoy el sistema no lo edita.
6. ¿Habrá más de un catálogo de dulcería por complejo (temporadas)?
