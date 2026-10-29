# Organization AI providers and key pools

Organization owners/admins configure **Settings & integrations → AI providers & API keys**. Credentials belong to that organization, not the platform globally.

## Provider setup

1. Add OpenAI (fixed `https://api.openai.com/v1`, Responses API), or a public HTTPS OpenAI-compatible endpoint.
2. Enter model IDs available on that provider account. Text supports Responses or Chat Completions. Images require a compatible Images API and a configured image model. Native Anthropic/Gemini wire protocols are not implemented; use their compatible gateways if provided.
3. Add named API keys. Only the final four characters are shown afterward. Add optional daily request and token thresholds.
4. Run the explicit test request if desired. It submits a small real AI job and may incur provider charges. Results appear in AI Assistant and the key-attempt log.

The lowest-priority-number configured provider is the default for new jobs. A job is pinned to one provider/model; failover does not send its data to an unrelated provider. Endpoint and protocol are immutable after creation so stored credentials cannot be silently redirected. Disable an old provider and create a new one when changing endpoint.

## Selection and automatic switching

Eligible keys must be enabled, not invalid/exhausted, outside cooldown, below configured daily limits, and not leased by another request. Selection uses the lowest observed daily utilization ratio, then least recently used, then creation order. At most twenty distinct keys are attempted per job, within a four-minute retry window.

| Response | Action |
|---|---|
| Success | Record returned token usage; release lease. If remaining requests/tokens is zero, honor reset headers. |
| HTTP 429 rate limit | Cool down for Retry-After (at least 60 seconds); try another key. |
| HTTP 402 / HTTP 429 insufficient quota | Mark quota exhausted; skip until an administrator repairs the account and resets health. |
| HTTP 401 | Mark invalid; try another key. |
| HTTP 403 | Cool down for 10 minutes; try another key. |
| HTTP 5xx | Cool down for 60 seconds and stop the job because completion/billing may be ambiguous. |
| HTTP 400 / other request errors | Fail the job; do not burn through other keys for a malformed request. |
| Network error / timeout | Stop instead of automatically replaying a possibly processed, billable request. |
| No eligible keys | Explicit NO_AVAILABLE_KEY; no unbounded retry loop. |

Daily counters reset at 00:00 UTC. Requests count attempted calls, including failures. Tokens reflect usage returned to this application, not all usage on the provider account and not a verified balance. A token threshold is checked before a call and can be crossed by that call's eventual usage; it is not a hard provider billing cap. Unknown usage is not fabricated. Keys on the same provider project may share upstream limits, so rotation cannot create additional quota.

The execution lease serializes access to a key, and usage/attempt records are persisted transactionally. An expired lease can be reclaimed after a worker failure. Redelivered RUNNING jobs are marked INTERRUPTED_PROVIDER_STATUS_UNKNOWN instead of being replayed or left running forever. Usage returned with invalid output is still recorded.

## Security and recovery

Set `AI_KEY_ENCRYPTION_KEY` to a cryptographically random 32-byte hex key (64 hex characters) on API and worker. Credentials use AES-256-GCM with tenant/provider authenticated context. Store the master key separately from the database, preserve it with recovery configuration, and never regenerate it while encrypted keys exist. Database-only restoration cannot decrypt credentials without the matching key. Master-key rotation needs an explicit re-encryption procedure; it is not an exposed UI action.

Provider hosts must be public HTTPS on port 443. DNS is checked at configuration and socket connection; private/link-local/loopback ranges and redirects are blocked. The isolated test overlay permits one explicit mock origin only when the configured public URL is loopback; it is not included in production Compose.

API reads return metadata and suffixes only. Raw provider error messages are not stored or shown, because providers can echo credentials. Deleting a stored key does not revoke it upstream. Disabled keys are not selected for new calls; an already running call may finish.

Existing environment OpenAI configuration remains a legacy fallback only for organizations with no database providers. Once an organization has provider records, disabled or exhausted configuration never silently falls back to the shared environment key.

## Verification

- `pnpm test`: encryption, tamper detection, tenant binding, URL/address rejection, ranking, limits, cooldown parsing and error classification.
- `tests/ai-provider-integration.ts`: dedicated PostgreSQL/Redis/mock-provider end-to-end test using fake keys; no real API charges.
- `tests/e2e/ai-settings.spec.ts`: owner settings flow, OpenAI/custom setup, masked multiple keys, limits, automatic failover, enable/disable/delete, persistence and mobile layout.
- Provider-account behavior with real keys is not claimed until the operator supplies credentials and runs the explicit test request.

The existing organization job cap (`AI_DAILY_JOB_LIMIT`, default 30 jobs per rolling 24 hours) remains an additional server-side control. Per-key thresholds do not override that organization cap.

References: [OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits) and [API error codes](https://developers.openai.com/api/docs/guides/error-codes). Retry-After and rate-limit metadata are used when the provider returns them; no account-balance endpoint is assumed.
