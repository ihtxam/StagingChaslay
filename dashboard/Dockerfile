# Build OpenPage (iframe builder) then the merchant dashboard.
# Context must be the monorepo root (see docker-compose.yml).

FROM node:22-bookworm-slim AS openpage
WORKDIR /openpage
COPY openpage/package.json openpage/package-lock.json ./
RUN npm ci
COPY openpage/ ./
ENV OPENPAGE_BASE=/openpage/
RUN npm run build

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
COPY --from=openpage /openpage/dist ./public/openpage
ARG VITE_API_URL=/api
ARG VITE_PUBLIC_DOMAIN=manupos.webprintmedia.swiss
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_DOMAIN=$VITE_PUBLIC_DOMAIN
RUN npm run build

FROM caddy:2.9-alpine
COPY --from=build /app/dist /srv
COPY dashboard/Caddyfile.static /etc/caddy/Caddyfile
EXPOSE 80
