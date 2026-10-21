# Builds the portal (Next.js) into a small production image.
# Supabase (database + edge functions) is not part of it: those stay hosted.
#
# Usually built through docker-compose.yml, which passes the build args below
# from .env. See README.md → "Running with Docker".

# 1. Install dependencies.
FROM node:22-slim AS deps
# git: @supabase/ssr is installed straight from GitHub.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build the app.
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are baked into the JavaScript at build time, so they
# must be here, not only when the container starts. Changing one means
# rebuilding the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_COMET_APP_ID
ARG NEXT_PUBLIC_COMET_AUTH_KEY
ARG NEXT_PUBLIC_COMET_ADMIN_UID
ARG NEXT_PUBLIC_COMET_AI_UID
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_KEY=$NEXT_PUBLIC_SUPABASE_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_COMET_APP_ID=$NEXT_PUBLIC_COMET_APP_ID \
    NEXT_PUBLIC_COMET_AUTH_KEY=$NEXT_PUBLIC_COMET_AUTH_KEY \
    NEXT_PUBLIC_COMET_ADMIN_UID=$NEXT_PUBLIC_COMET_ADMIN_UID \
    NEXT_PUBLIC_COMET_AI_UID=$NEXT_PUBLIC_COMET_AI_UID \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone

RUN npm run build

# 3. Run it: only the built server, no source code or dev dependencies.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
