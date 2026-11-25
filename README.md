# Borrador_Frontend_Sistema_Gestión

Borrador del **sistema de gestión** de Cinépolis, basado en el prototipo de administración y en el diagrama de la base de datos. Lo usan el administrador (toda la cadena) y el personal con cuenta asignada a un complejo para manejar cartelera, funciones, dulcería, tarifas, promociones, contenido del sitio y personal. No maneja ventas, ingresos, pedidos ni inventario: las ventas las registran el sitio web y la taquilla.

Es solo el **frontend**. Mientras no exista el backend, trae un **backend simulado** que corre en el navegador y responde el contrato JSON acordado; al conectar el API real se cambia la configuración, no el código.

> Proyecto académico, sin relación comercial con Cinépolis. Los datos de ejemplo son ficticios.

## Requisitos

- Node.js 24 (ver `.nvmrc`) y npm.
- Docker solo para construir la imagen de despliegue.

## Uso

```bash
npm ci
npm run dev        # http://localhost:5174 con el backend simulado
npm run check      # lint + tipos + pruebas + compilación (lo mismo que corre CI)
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Revisa tipos y compila a `dist/`. |
| `npm run preview` | Sirve `dist/` para revisar la compilación. |
| `npm test` / `npm run test:watch` | Pruebas con Vitest. |
| `npm run lint` / `npm run lint:fix` | ESLint (Vue + TypeScript con reglas de tipos). |
| `npm run typecheck` | `vue-tsc` sobre la app, las pruebas y la configuración. |

### Cuentas de demostración (solo en modo simulado)

Se entra con el correo o con el nombre de usuario (`usuario_admin.correo` o `username`).

| Usuario | Correo | Contraseña | Perfil |
| --- | --- | --- | --- |
| `admin` | `admin@cinepolis.test` | `Demo-2026` | Administrador: sin complejo asignado, todos los permisos sobre toda la cadena. |
| `gerente.xalapa` | `gerente.xalapa@cinepolis.test` | `Demo-2026` | Asignado a Xalapa Centro: funciones, catálogo de dulcería, tarifas, salas y personal de ese complejo. No toca lo que es de toda la cadena. |
| `supervisor.boulevard` | `supervisor.boulevard@cinepolis.test` | `Demo-2026` | Cuenta desactivada (`activo = false`): no puede entrar. |

Los datos simulados se guardan en el navegador (`localStorage`, clave `cp-admin-mock-v3`). Para empezar de cero, borra esa clave.

## Módulos

| Módulo | Qué permite | Tablas principales |
| --- | --- | --- |
| Panel principal | Información operativa: funciones de hoy, cartelera, estrenos y preventas de la semana, películas sin funciones o que terminan pronto, productos no disponibles y bitácora reciente. Sin ventas ni ingresos. | `funcion`, `pelicula`, `detalle_catalogo` |
| Películas | Catálogo, fechas de cartelera, reparto, medios y estado calculado (próximamente, preventa, estreno). | `pelicula`, `persona`, `pelicula_persona` |
| Funciones y horarios | Lista por fechas, edición, retiro y **programación por lote en cuatro pasos** con salas compatibles, limpieza entre funciones y revisión de traslapes en el servidor. | `funcion`, `sala`, `sala_formato_sala` |
| Dulcería | Productos de la cadena con reglas de personalización; catálogo, precio y opciones por complejo; **interruptor de disponible / no disponible** que el personal marca a mano (no hay inventario); historial de precios. | `producto_dulceria`, `modificador_regla`, `modificador_opcion`, `catalogo_complejo`, `detalle_catalogo`, `disponibilidad_modificador`, `historial_producto` |
| Contenido web | Portada, banners, preguntas frecuentes, páginas legales y reglas de compra. | `banner_promo`, `banner_promo_complejo` |
| Tarifas | Matriz de precios explícitos por complejo, tipo de sala, proyección y tipo de boleto, con calculadora para llenarla. Tipos de boleto. | `precio_boleto`, `tipo_boleto` |
| Promociones y Club | Promociones con vigencia, complejos, nivel del Club y reglas automáticas. Niveles del Club. | `promocion`, `promocion_complejo`, `nivel_club` |
| Complejos y salas | Datos del complejo, tipo de sala, proyecciones y **editor del plano de asientos**. | `complejo`, `ciudad`, `sala`, `asiento_plantilla` |
| Empleados | Personal por complejo y puestos. Los salarios solo se ven al editar. | `empleado`, `rol` |
| Configuración | Cuenta (usuario, correo, puesto y alcance), ambiente y datos de la organización. | `usuario_admin`, `empleado`, `rol` |

## Arquitectura

```
src/
  app/          Arranque, configuración, rutas con permisos, consultas (TanStack Query), sesión (Pinia), menú
  domain/       Modelos, puertos, reglas puras y textos: lo único que conocen las vistas
  adapters/http Esquemas zod del contrato, conversores y adaptadores
  mocks/        Backend simulado (solo se descarga en modo mock)
  features/     Una carpeta por módulo
  shared/       Utilidades (dinero, fechas, HTTP, errores) y componentes base (ventanas, selección múltiple, importes)
```

Decisiones que facilitan conectar el backend:

1. **Puertos y adaptadores.** Las vistas solo usan las interfaces de `src/domain/ports.ts`. El adaptador valida cada respuesta con zod y la convierte al modelo; si el backend cambia un nombre, se corrige en `adapters/http`.
2. **El simulador habla el mismo contrato.** `src/mocks` es un `fetch` falso. Los dos modos pasan por los mismos adaptadores, así que lo probado en simulación ya ejercita el código de producción.
3. **El servidor manda.** Permisos, alcance por complejo, planeación de funciones, y validaciones se deciden en el servidor; la interfaz solo guía.
4. **Concurrencia optimista.** Cada registro editable trae `version`; guardar sobre una versión vieja responde `409 VERSION_CONFLICT` en lugar de pisar el cambio de otra persona.
5. **Configuración en tiempo de ejecución.** `/config.json` se lee al arrancar; la misma compilación se promueve entre ambientes. En producción, una configuración inválida detiene el arranque en lugar de caer al simulador.
6. **Seguridad de la sesión.** Cookie de sesión más `X-CSRF-Token`, sesión absoluta de 12 horas, cierre por inactividad configurable, bloqueo tras cinco intentos fallidos y rutas protegidas por permiso.

Más detalle:

- [docs/contrato-api.md](docs/contrato-api.md): endpoints, formas JSON, errores, permisos e idempotencia.
- [docs/mapeo-bd.md](docs/mapeo-bd.md): de dónde sale cada dato en las tablas y qué columnas faltan.

## Conectar el API real

En desarrollo, crea `.env.local` a partir de `.env.example`:

```bash
VITE_API_MODE=http
VITE_PROXY_TARGET=http://localhost:5080   # el servidor de Vite reenvía /api al backend
```

En un ambiente desplegado no se recompila: el contenedor genera `/config.json` con variables de entorno.

Las pruebas de `src/mocks/contract.test.ts` describen lo que el backend debe cumplir: sesión y bloqueo, CSRF, permisos y alcance por complejo, versiones, idempotencia, planeación sin traslapes, historial de precios, disponibilidad por complejo y protección de funciones con boletos vendidos.

## Despliegue

```bash
docker build -t cinepolis-gestion .
docker run -p 8080:8080 -e ENVIRONMENT_NAME=staging cinepolis-gestion
```

- Compila con Node 24 y sirve con `nginx-unprivileged` (usuario sin privilegios, puerto 8080), con CSP, `X-Robots-Tag: noindex` y caché correcta para archivos con huella.
- Kong enruta `/api/admin/*` al backend y lo demás a este contenedor. Al estar en el mismo dominio no hace falta CORS y la cookie de sesión funciona.
- Si más adelante se empaqueta como ejecutable de escritorio (por ejemplo con Tauri), el API quedará en otro origen: habrá que cambiar la sesión a tokens y habilitar CORS en Kong.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `API_MODE` | `http` | `http` o `mock` (demostraciones sin backend). |
| `API_BASE_URL` | `/api/admin/v1` | Prefijo del API de gestión. |
| `ENVIRONMENT_NAME` | `production` | Nombre visible en el sistema. |
| `SUPPORT_EMAIL` | vacío | Correo de soporte, opcional. |
| `IDLE_MINUTES` | `30` | Minutos sin actividad antes de cerrar la sesión. `0` lo desactiva. |

## Estado del borrador

Hecho y probado en navegador (escritorio y 375 px):

- Acceso con correo o usuario, bloqueo por intentos, cuentas desactivadas, permisos por módulo y alcance de un solo complejo por cuenta.
- Todos los módulos de la tabla anterior, con validaciones, avisos de cambios sin guardar y confirmaciones.
- Programación por lote: asignación de salas, limpieza, traslapes, revalidación al crear y "Deshacer".
- Disponibilidad manual de productos por complejo desde la lista del catálogo.

Pendiente o fuera de alcance:

- Columnas y tablas que faltan en la base de datos (ver `docs/mapeo-bd.md`): fechas de cartelera, reglas de promoción, configuración y bitácora. `usuario_admin` ya existe en la nueva versión de la base de datos.
- Por decisión del equipo se quitaron ventas, ingresos, reportes, pedidos e inventario. El sitio web también debe dejar de descontar existencias.
- Imágenes: solo se capturan las direcciones; no hay carga de archivos.
- Taquilla, control de acceso, cortes de caja, cuentas del Club y reclamaciones de garantía no forman parte de este sistema.
- La imagen de Docker no se ha construido en esta máquina (no hay Docker instalado); CI la valida.
