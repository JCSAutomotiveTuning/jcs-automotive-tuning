# JCS portal integrated upgrade plan (30 October 2026)

**Do not add duplicate dashboards or replace working payment workflows.** Extend the existing pages, APIs, and database. This is the ordered engineering backlog; only stages marked implemented in their own PR are live.

| Area | Existing surface | Improvements / acceptance requirements |
|---|---|---|
| ECU File Identification Pro | `/dashboard/file-identification`, private original-file library | Local HW/SW/part-number candidate extraction; later verified ECU-specific binary signatures and original-file matching, with explicit confidence; never assume a filename proves compatibility |
| Datalog Analysis Pro | `/dashboard/datalog-analysis`, `LogChartClient` | Local graphs + export (current PR), later VCDS header/unit support, requested-vs-actual matching by unit, warnings with tune/vehicle context and human review |
| Admin Orders 2.0 | `/admin/orders`, existing orders API | Assignment queue, revisions, payment gate, release/QA statuses, delivery/audit trail; preserve customer ownership and never release unscanned files |
| Tool/ECU search | `/dashboard/tool-compatibility`, `/dashboard/vehicle-ecu-search` | Exact HW/SW and licensed protocol evidence, recovery/write type distinctions, source timestamps; retain shared 5/day customer quota |
| Wallet and Stripe | `/admin/wallet`, deposit wallet and Stripe webhook | Reconciliation, deposit reservations, refunds/disputes, secure ledger; do not mutate a live balance without tested SQL constraints and Stripe webhook idempotency |
| Support and notifications | `/dashboard/support`, support tickets | Order-linked discussion, in-portal unread status, optional notification preferences; no unsolicited email spam |
| Technician workspace | `/admin/staff`, assigned orders | Access-limited staff role, review assignment and separate QA approval; test cross-account access denial |
| Dealer pricing | Existing profiles, customer pricing and billing | Dealer account lifecycle and tier approvals, priced server-side with logged quote and payment amount; do not add a UI-only discount |
| Security / readiness | Auth, uploads, CI, Stripe, Supabase RLS | Automated ownership tests, anti-virus scanner fail-closed checks, secure order downloads, webhook reconciliation, backups and error monitoring |

## Release gates

1. No production migration or payment/role changes without a reviewed, reversible plan.
2. Review existing schemas and permissions before staff/dealer changes.
3. Add tests for happy path, unauthorized access, concurrency and negative cases; GitHub checks and Vercel preview must be green.
4. Production deploy only after confirmed test results; smoke-test signed-in normal customer and administrator views.
5. Sensitive operations (payments, wallet debits, finished file release) must be idempotent and auditable.

Current PR improves the existing File Identification and Datalog Analysis pages only. All other rows are planned work, not completed or guaranteed live.
