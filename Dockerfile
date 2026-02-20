FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

FROM base AS build
WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY scripts/ ./scripts/

# Copy the server package and its workspace dependency
COPY apps/backgammon-server/package.json ./apps/backgammon-server/
COPY packages/backgammon-core/package.json ./packages/backgammon-core/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY apps/backgammon-server/ ./apps/backgammon-server/
COPY packages/backgammon-core/ ./packages/backgammon-core/

# Build server
WORKDIR /app/apps/backgammon-server
RUN pnpm build

FROM base AS runtime
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/patches/ ./patches/
COPY --from=build /app/scripts/ ./scripts/
COPY --from=build /app/apps/backgammon-server/package.json ./apps/backgammon-server/
COPY --from=build /app/packages/backgammon-core/package.json ./packages/backgammon-core/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# tsx is required at runtime because backgammon-core is a raw TypeScript
# workspace package with "main": "./src/index.ts" — Node cannot resolve it
# without a TypeScript-aware loader.
RUN pnpm add -g tsx@4

COPY --from=build /app/apps/backgammon-server/dist/ ./apps/backgammon-server/dist/
COPY --from=build /app/packages/backgammon-core/ ./packages/backgammon-core/

WORKDIR /app/apps/backgammon-server
EXPOSE 3001
ENV PORT=3001
CMD ["tsx", "dist/index.js"]
