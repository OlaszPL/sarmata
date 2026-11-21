# Builds the Sarmata app from the monorepo sources (ADR 0003: local build, no registry).
# Context: repository root. Targets: web (Next.js standalone) and worker (pnpm deploy --prod).
ARG NODE_IMAGE=node:24.19.0-alpine3.24

FROM ${NODE_IMAGE} AS build
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY . .
# Only the app, the worker and their workspace dependencies (pnpm 12.21.0 from packageManager).
RUN pnpm install --frozen-lockfile --filter "@sarmata/web..." --filter "@sarmata/worker..."
RUN pnpm --filter @sarmata/web build \
 && mkdir -p frontend/web/public \
 && pnpm --filter @sarmata/worker --prod deploy /out/worker

FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/frontend/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/frontend/web/.next/static ./frontend/web/.next/static
COPY --from=build --chown=node:node /repo/frontend/web/public ./frontend/web/public
USER node
EXPOSE 3000
CMD ["node", "frontend/web/server.js"]

# Same start as "pnpm --filter @sarmata/worker start": tsx runs the TypeScript sources.
FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production
WORKDIR /worker
COPY --from=build --chown=node:node /out/worker ./
USER node
CMD ["node_modules/.bin/tsx", "src/main.ts"]
