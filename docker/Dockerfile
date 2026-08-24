# UNGRD Temas Operativos — imagen de producción (Next.js standalone)
# Build: docker build -f docker/Dockerfile --target runner -t ungrd-temas .
# Migraciones: docker build -f docker/Dockerfile --target migrator -t ungrd-temas-migrate .

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Job one-shot: schema + seed (docker compose migrate)
FROM deps AS migrator
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "db:setup"]

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/uploads /app/.data \
  && chown -R nextjs:nodejs /app/uploads /app/.data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
