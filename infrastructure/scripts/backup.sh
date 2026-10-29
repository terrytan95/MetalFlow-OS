#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
umask 077
backup_root=${BACKUP_ROOT:-/srv/metalflow/backups}
retention_days=${RETENTION_DAYS:-14}
[[ $retention_days =~ ^[0-9]+$ ]] || exit 2
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dest="$backup_root/$stamp"
mkdir -p "$dest"
compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
if [[ -n ${COMPOSE_OVERRIDE:-} ]]; then compose+=(-f "$COMPOSE_OVERRIDE"); fi
# Pause writers so database and assets describe the same point in time.
"${compose[@]}" stop api worker
trap '"${compose[@]}" start api worker' EXIT
"${compose[@]}" exec -T postgres pg_dump -U metalflow -d metalflow -Fc > "$dest/database.dump"
"${compose[@]}" run --rm --no-deps -T --user root api tar -C /data/uploads -czf - . > "$dest/uploads.tgz"
tar -czf "$dest/config.tgz" .env docker-compose.yml docker-compose.prod.yml infrastructure/nginx
"${compose[@]}" exec -T postgres pg_restore --list < "$dest/database.dump" > "$dest/database.contents"
tar -tzf "$dest/uploads.tgz" > /dev/null
tar -tzf "$dest/config.tgz" > /dev/null
printf '%s\n' "Verified local backup: $dest"
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20*T*Z' -mtime "+$retention_days" -exec rm -rf -- {} +
