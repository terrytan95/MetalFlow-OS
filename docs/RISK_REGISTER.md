# Risk register
| Risk | Mitigation / current status |
|---|---|
| Tenant data access | Session membership + tenant predicates + referenced-entity ownership checks; API isolation regressions. RLS/composite business foreign keys remain additional hardening. |
| Double stock/payment mutation | Serializable transactions, retry backoff, database nonnegative checks, idempotency records for fulfillment/receiving/payment/transfer/import. |
| Incomplete pricing/cost data | Decimal calculations, explicit units, no guessed prices; catalog cost snapshots marked incomplete for custom lines. |
| AI uncertainty | Disabled without credentials; structured extraction, human review, no mutating tools; provider execution not verified without a project key. |
| Single-VPS loss | Local consistent backup and isolated restore drill; independent off-VPS recovery still required. |
| Email identity/recovery | SMTP absent; reset/verification delivery unavailable until configured. No shared public admin account. |
| Scope mismatch | Master specification is larger than this first release; explicit acceptance matrix documents remaining features. |
| Upload content risk | Signature/size allowlist and authenticated access; malware scanning and content disarm not implemented. |
| Heavy tenant data | Paginated operational lists, indexes; analytics currently aggregates bounded-SMB datasets in application memory and needs SQL aggregation before large-scale tenants. |
