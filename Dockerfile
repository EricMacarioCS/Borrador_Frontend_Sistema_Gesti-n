# syntax=docker/dockerfile:1
# Imagen del sistema de gestión: compila con Node y sirve archivos estáticos con nginx sin privilegios.
# La misma imagen se promueve entre ambientes; /config.json se genera al arrancar (ver deploy/).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
# Los mapas de fuentes no se publican; se suben aparte al servicio de errores si se usa uno.
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
RUN find /usr/share/nginx/html -name '*.map' -delete
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=755 deploy/docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

ENV API_MODE=http \
    API_BASE_URL=/api/admin/v1 \
    ENVIRONMENT_NAME=production \
    SUPPORT_EMAIL= \
    IDLE_MINUTES=30

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
