# Product requirements
MetalFlow OS connects metal supply and interior-project operations: inquiry → reviewed requirements → quotation → approval → sales order → reservation / purchasing / fabrication → fulfillment → invoice → payment → reporting.

Primary users are aluminum/stainless distributors, fabrication workshops and renovation contractors. Tenant data isolation, deterministic financial calculations, commercial history and honest availability states take precedence over cosmetic breadth.

Required architecture: TypeScript pnpm workspace, Next.js App Router, NestJS REST API, PostgreSQL/Prisma, Redis/BullMQ, self-hosted Compose, protected local assets, optional OpenAI gateway. English and Simplified Chinese navigation, responsive desktop-first interface, dark/light themes.

This repository implements a first operational release. See IMPLEMENTATION_ROADMAP.md for the explicit distinction between working workflows and remaining master-spec features. The complete master prompt is the product target, not a claim that all functionality already ships.
