FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl fonts-wqy-zenhei && rm -rf /var/lib/apt/lists/* && npm install -g pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate
FROM base AS web-build
ENV API_INTERNAL_URL=http://api:3401
RUN pnpm --filter @metalflow/web build
FROM web-build AS web
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["pnpm","--filter","@metalflow/web","start"]
FROM base AS api
ENV NODE_ENV=production
ENV PDF_FONT_PATH=/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc
USER node
EXPOSE 3401
CMD ["pnpm","exec","tsx","apps/api/src/main.ts"]
FROM base AS worker
ENV NODE_ENV=production
USER node
CMD ["pnpm","exec","tsx","apps/worker/src/main.ts"]
