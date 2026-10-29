#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source_dir=${1:?Pass a verified backup directory}
[[ ${CONFIRM_RESTORE:-} == YES ]] || { echo 'Set CONFIRM_RESTORE=YES. Restore replaces the target database and uploads.' >&2; exit 2; }
test -s "$source_dir/database.dump"
tar -tzf "$source_dir/uploads.tgz" > /dev/null
compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
if [[ -n ${COMPOSE_OVERRIDE:-} ]]; then compose+=(-f "$COMPOSE_OVERRIDE"); fi
"${compose[@]}" stop api worker
"${compose[@]}" exec -T postgres pg_restore -U metalflow -d metalflow --clean --if-exists --no-owner --exit-on-error < "$source_dir/database.dump"
"${compose[@]}" run --rm --no-deps --user root api sh -c 'find /data/uploads -mindepth 1 -delete'
"${compose[@]}" run --rm --no-deps -T --user root api tar -C /data/uploads -xzf - < "$source_dir/uploads.tgz"
"${compose[@]}" run --rm --no-deps --user root api chown -R node:node /data/uploads
"${compose[@]}" start api worker
"${compose[@]}" up -d --wait
curl -fsS http://127.0.0.1:3410/metalflow/api/v1/health
