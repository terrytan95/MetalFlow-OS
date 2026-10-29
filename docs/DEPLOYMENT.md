# Single-VPS deployment
Existing domain HTTPS termination remains in place. MetalFlow routes through host Nginx to 127.0.0.1:3410. The Compose reverse proxy sends /metalflow/api to NestJS and /metalflow to Next.js. PostgreSQL and Redis are internal-only.

Source: /opt/metalflow/app. Environment: /opt/metalflow/app/.env (0600). Named volumes: metalflow_postgres, metalflow_redis, metalflow_uploads. Backups: /srv/metalflow/backups.

1. Install Docker + Compose. Copy source and create .env from .env.example. Generate AUTH_SECRET and POSTGRES_PASSWORD with a cryptographic random generator.
2. Set PUBLIC_URL to https://your-domain/metalflow. Set SMTP before requiring email verification. Set optional AI credentials and account-verified model IDs only when authorized.
3. Run infrastructure/scripts/deploy.sh. It builds, starts database/cache, initializes upload ownership, applies migrations and waits for health.
4. Add the supplied /metalflow location to the existing TLS-facing host route. Validate nginx -t before reload. Do not replace unrelated routes.
5. Verify /metalflow, /metalflow/api/v1/health, registration and a full workflow.

The first registered account creates its own organization and becomes that organization's owner. There is no public default admin password or platform-wide super-admin. Bootstrap via the browser over HTTPS.

Rollback: retain the previously deployed image tags before an upgrade, point Compose image references to those tags and run up -d --no-build. Do not assume older code supports newer schema. Restore a tested matching database backup only with explicit operator approval. This first deployment has no previous MetalFlow release to roll back to.

Test environment uses `docker compose -p metalflow-test -f docker-compose.yml -f docker-compose.test.yml`; port 3411 and separate volumes. Never point test scripts at production tenant data.

## Verified deployment notes (2026-10-29)
Production route returns HTTP 200 and health returns status=ok. Existing host Nginx reports duplicate server-name warnings from its pre-existing enabled configuration; syntax validation passes and MetalFlow routing works. No unrelated host configuration was removed. Five migrations applied to the fresh production database. No demo or QA tenant was seeded in production.
