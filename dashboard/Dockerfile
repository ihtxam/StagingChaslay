# Merchant dashboard static assets.
# Production/staging deploys use the committed dashboard/dist from git (built in CI/agent)
# so the running image always matches the repo hash — no second Vite build inside Docker
# (server-side rebuilds had drifted from committed dist and blocked #903 from going live).

FROM caddy:2.9-alpine
COPY dashboard/dist /srv
COPY dashboard/Caddyfile.static /etc/caddy/Caddyfile
EXPOSE 80
