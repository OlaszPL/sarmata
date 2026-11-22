# syntax=docker/dockerfile:1
# Builds the Sarmata app from the monorepo sources (ADR 0003: local build, no registry).
# Context: repository root. Targets: web (Next.js standalone) and worker (pnpm deploy --prod).
ARG NODE_IMAGE=node:24.19.0-bookworm-slim

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
# semble (legal search of the AI procedure assistant, ADR 0008) is baked in with its embedding model,
# so the worker searches the legal texts without network from the first query. The base image is glibc
# (Debian) because semble-grammars ships only manylinux wheels, none for musl (Alpine).
FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production \
    SARMATA_LEGAL_ROOT=/legal \
    HOME=/home/node \
    UV_CACHE_DIR=/home/node/.cache/uv \
    UV_PYTHON_INSTALL_DIR=/home/node/.local/share/uv/python \
    UV_TOOL_DIR=/home/node/.local/share/uv/tools \
    UV_TOOL_BIN_DIR=/home/node/.local/bin \
    PATH=/home/node/.local/bin:$PATH
COPY --from=ghcr.io/astral-sh/uv:0.8.0 /uv /uvx /usr/local/bin/
WORKDIR /worker
COPY --from=build --chown=node:node /out/worker ./
COPY --from=build --chown=node:node /repo/backend/regulations /legal/backend/regulations
USER node
# Python, the tool and its caches belong to node, the user the worker runs as, so semble can write the
# index of a new regulation version at run time. The uv download cache is dropped to keep the image small.
RUN uv tool install "semble[mcp]==0.6.1" \
 && uv cache clean
# Warm-up: downloads the embedding model and indexes the bundled regulation. It runs exactly like the
# worker does (cwd = SARMATA_LEGAL_ROOT, relative source directory), so the cached index matches.
# Optional BuildKit secret "ca": CA bundle for networks with a TLS-inspecting proxy
# (docker build --secret id=ca,src=<pem>). Without it the build works on a plain network.
WORKDIR /legal
RUN --mount=type=secret,id=ca,uid=1000,required=false \
    if [ -f /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi \
 && semble search "termin sprzeciwu od oceny okresowej" backend/regulations/regulation-2016/sources \
      --content docs --format json -k 1 > /dev/null
# Offline only in the final image: the warm-up above has to reach Hugging Face.
ENV SARMATA_SEMBLE_COMMAND=semble \
    HF_HUB_OFFLINE=1
WORKDIR /worker
CMD ["node_modules/.bin/tsx", "src/main.ts"]
