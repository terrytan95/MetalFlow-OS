# MetalFlow OS

**The Intelligent Operating System for Metal Supply & Interior Projects**

面向铝材、不锈钢批发及室内装修行业的经营管理平台。

A self-hosted, tenant-isolated business application built with Next.js, NestJS, PostgreSQL, Prisma and Redis. This repository contains real persisted workflows, not a static dashboard demo.

Live: [terrytan.dev/metalflow](https://terrytan.dev/metalflow)

## Current release

- Seven persistent Morandi/neutral palettes, including black-white-gray, each with light and dark mode.
- Register, create organizations, invite teammates and enforce default roles.
- Manage customers, products, inquiries, quotations, approvals and sales orders.
- Export PDFs, reserve stock, partially fulfill orders and receive purchases.
- Track warehouses, adjustments, transfers and CSV imports.
- Calculate deterministic 1D cutting plans and create fabrication jobs.
- Manage projects, task boards, expenses and approved budget changes.
- Upload protected drawings, record verified takeoffs and export BOMs.
- Issue invoices, record idempotent partial payments and report real operational metrics.
- Organization-managed OpenAI/compatible providers, encrypted multi-key pools, usage-aware rotation, async inquiry extraction, document assistance and interior concepts.

This is an initial operational release. It does **not** implement every feature in the master specification. See [the acceptance matrix](docs/IMPLEMENTATION_ROADMAP.md) and [verified progress](docs/PROGRESS.md). Native CAD, 2D nesting, full accounting, custom roles and complete bilingual forms are not advertised as complete.

## Development

Node 24+, pnpm 11.25+, Docker Compose.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set private environment values; never commit .env.
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @metalflow/web build
```

For the complete stack, set `.env` then run `infrastructure/scripts/deploy.sh`. Access `/metalflow`. The first account creates its own organization owner; there is no public default password. Detailed VPS routing is in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

Demo seeding is explicit: set `DEMO_MODE=true`, `DEMO_EMAIL`, `DEMO_PASSWORD` and run `pnpm exec tsx scripts/seed-demo.ts` only in a separate demo environment. All demo names and prices are fictional. Production migrations do not seed customer data.

## Design

[baoyu-design](https://github.com/jimliu/baoyu-design) was installed and used for dashboard exploration, HTML prototypes, token compilation and design checks. Artifacts live in `designs/metalflow-os/`. Foundry is the selected neutral/teal direction. See `DESIGN_DECISION.md` for evaluation and tool compatibility notes.

Theme selector: sign in, then use the palette icon in the global header. Palette and light/dark mode are saved independently.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE_SCHEMA.md) · [API](docs/API_REFERENCE.md) · [Security](docs/SECURITY.md) · [Tests](docs/TESTING.md) · [Backup and restore](docs/BACKUP_RESTORE.md) · [Roadmap](docs/IMPLEMENTATION_ROADMAP.md)

## Operational limits

Configure SMTP before requiring email verification. Configure a dedicated OpenAI key and account-supported model IDs for AI; no model ID is guessed. Local backups alone do not protect against VPS loss. Arrange an independently recoverable off-VPS copy before storing irreplaceable customer data. This is operational finance, not jurisdiction-certified accounting or tax filing.
