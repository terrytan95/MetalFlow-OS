# Performance audit evidence

Fixture: isolated PostgreSQL test project, 10,000 products, 50,000 commercial documents, 100,000 inventory positions (10 warehouses), 1,000 customers. Synthetic data only; not production.

Previous analytics implementation loaded the tenant's complete records and repeatedly joined arrays. The benchmark did not finish before the test API reached its 768 MiB container memory ceiling and sustained about 200% CPU. The test container was restarted; no before latency or speedup ratio is claimed.

New API results are in 2026-10-29-api.json (three sequential requests, local Docker network, authenticated). Analytics median 184.3 ms and 10,850 response bytes. Inventory page 1 median 79.0 ms, page 2 83.4 ms, 25 records and 11,035 bytes each. The API memory snapshot after this workload and extended regression was 289.1 MiB; this is a process snapshot, not an isolated peak benchmark.

Reproduce: tests/performance-seed.ts creates the fixture; tests/performance-run.ts takes BENCH_ORG and exercises the real authenticated API. Never use the seed on production. Three runs are an engineering check, not a statistical p95 claim.

Cutting: scripts/benchmark-cutting.ts compares the prior linear first-fit capacity search with the indexed implementation on the same worst-case 5,000-piece fixture. Local Node 26, median of seven runs: 5.862 ms before, 0.718 ms after (~8.17x). 1,000 pieces: 0.237 vs 0.222 ms, little benefit at small size. Pattern equivalence is tested on 30 deterministic mixed fixtures.

Changes: database-side aggregation, bounded 50-row analytic drilldowns with separate full low-stock count, real inventory pagination, batched product validation/imports, grouped receipt totals, search indexes, stable list ordering, bounded query cache, debounced search, map-based lookup joins, lazy chart module, stopped polling for completed AI jobs, and object URL cleanup.

Limitations: deep offset pages remain O(offset) at the database; keyset pagination is a future API change. No internet latency, real-customer workload, multi-instance load, or p95 guarantee was measured.
