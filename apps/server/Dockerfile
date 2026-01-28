# btca-server Dockerfile
# Standalone Hono API server for answering questions about codebases
#
# Build:
#   docker build -t btca-server -f apps/server/Dockerfile .
#
# Run:
#   docker run -p 8080:8080 \
#     -e BTCA_ALLOWED_GIT_HOSTS=gitlab.yourcompany.com \
#     -e OPENAI_API_KEY=sk-xxx \
#     -v ~/.config/btca:/root/.config/btca \
#     -v ~/.git-credentials:/root/.git-credentials:ro \
#     btca-server

FROM oven/bun:1.1-alpine AS base

# Install git for repo cloning and ca-certificates for HTTPS
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Dependencies stage - cache package installs
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

# Copy workspace package files for dependency resolution
COPY package.json bun.lockb ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

# Install dependencies (production only for smaller image)
RUN bun install --frozen-lockfile --production

# ─────────────────────────────────────────────────────────────────────────────
# Build stage - copy source
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source files
COPY apps/server/ apps/server/
COPY packages/shared/ packages/shared/
COPY package.json bun.lockb ./

# ─────────────────────────────────────────────────────────────────────────────
# Runtime stage
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S btca && \
    adduser -S btca -u 1001 -G btca

# Copy built application
COPY --from=build --chown=btca:btca /app /app

# Configure git credential helper and default settings
RUN git config --global credential.helper store && \
    git config --global init.defaultBranch main && \
    git config --global --add safe.directory '*' && \
    mkdir -p /home/btca/.config/btca /home/btca/.local/share/btca && \
    chown -R btca:btca /home/btca

# Switch to non-root user
USER btca
WORKDIR /app

# Environment configuration
ENV PORT=8080
ENV NODE_ENV=production
ENV HOME=/home/btca

# Expose server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start the server
CMD ["bun", "run", "apps/server/src/index.ts"]
