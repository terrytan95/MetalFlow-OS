#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
test -f .env
compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
"${compose[@]}" build
"${compose[@]}" up -d postgres redis
"${compose[@]}" run --rm --user root api sh -c 'mkdir -p /data/uploads && chown node:node /data/uploads'
"${compose[@]}" run --rm api pnpm db:migrate
"${compose[@]}" up -d --wait
curl --fail --silent http://127.0.0.1:3410/metalflow/api/v1/health
