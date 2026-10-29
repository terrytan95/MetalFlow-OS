# Security
- Better Auth manages password hashing, sessions, verification tokens and authentication rate limits. Secure cookies in HTTPS mode, HttpOnly, SameSite=Lax, path=/metalflow.
- Business writes enforce Origin; tenant ID is never accepted without a membership check. All business references are tenant-validated. Role checks are enforced server-side, and product cost is removed for roles without cost:read.
- Parameterized Prisma access; Zod allowlisted request fields; React output escaping; no raw HTML rendering.
- Upload signatures are detected from bytes; PDF/PNG/JPEG/WebP only, 15 MiB maximum, random internal filenames, private storage, authenticated download. Antivirus/content disarm is not implemented.
- API request IDs, bounded body size, throttling, audit logs. Database/Redis are not bound to host public ports. Services run as node, no-new-privileges.
- AI input is untrusted content, not instructions. Jobs are permission-checked again at execution. No mutating tools. Daily submission cap and bounded output; no provider calls without explicit project configuration.
- SMTP is not configured by default. Require verified email before customer production onboarding once SMTP exists. Share invitation links only with intended recipients.
- Production secrets are generated on the VPS, mode 0600, ignored by Git. Never publish .env, customer exports or backups.

Not a universal accounting or tax compliance product. Security controls do not replace operational review, offsite recovery, monitoring or independent penetration testing.

Organization-managed AI keys: AES-256-GCM, random IV, tenant/provider AAD, server-only master key. Provider origin/protocol cannot be altered while retaining keys. All configured endpoints require public HTTPS, all DNS answers are checked, socket DNS is checked again and redirects are refused. Production does not load the mock-provider Compose overlay. Error logs store normalized codes rather than raw upstream bodies. Real credentials are neither seeded nor used in automated tests.
