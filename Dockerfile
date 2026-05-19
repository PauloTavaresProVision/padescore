# =====================================================================
# Padescore — imagem de produção (Next.js 16 standalone, pnpm)
# Build:  docker build -t padescore \
#           --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
#           --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... .
# Run:    docker run -p 3000:3000 \
#           -e SUPABASE_SERVICE_ROLE_KEY=... \
#           -e NEXT_PUBLIC_SUPABASE_URL=... \
#           -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... padescore
# =====================================================================

# ---- deps: instala dependências (cacheável) ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: compila o Next ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* têm de existir no BUILD (são embebidas no bundle do browser).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- runner: imagem final mínima ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilizador não-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Output standalone: server mínimo + só os node_modules usados
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# SUPABASE_SERVICE_ROLE_KEY é só de runtime (NUNCA embebida no bundle).
CMD ["node", "server.js"]
