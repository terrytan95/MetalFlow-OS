# MetalFlow OS
Build a tenant-isolated metal supply and renovation SaaS. Modular monolith: Next.js web, NestJS API, BullMQ worker, PostgreSQL/Prisma, Redis. All services deploy under /metalflow.

Money uses decimal.js and PostgreSQL Decimal. Never use floating-point money calculations. All business queries require a verified organization membership. Enforce permissions at API and service boundaries. Never return product cost to roles without cost:read.

Use serializable transactions for reservation, receiving, payment and conversion. Validate all referenced records belong to the same organization. Do not silently change units of stocked products. AI is optional, read/draft only, requires configured keys and verified model IDs. No credentials in Git.

Commands: pnpm db:generate; pnpm typecheck; pnpm test; pnpm --filter @metalflow/web build; pnpm test:e2e. Database integration runs against a dedicated test database. Never run destructive tests against production.

Design: designs/metalflow-os/DESIGN_DECISION.md. Follow Foundry tokens, compact tables, accessible Radix dialogs, clear error/empty states. Synthetic data only in explicit demo seed.

Read docs/PROGRESS.md and docs/IMPLEMENTATION_ROADMAP.md before resuming. Update them after meaningful milestones. Do not claim unfinished modules complete. Worker agents are read-only; lead owns edits and verification.
