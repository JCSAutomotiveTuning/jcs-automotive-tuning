# JCS production launch gate — 27 October 2026

**Current decision: NO-GO for unrestricted live payments or customer uploads until all release gates are evidenced.**

This checklist is a verification runbook, not evidence that checks have passed. CI uses test doubles and synthetic environment variables.

## Gate A — Stripe (blocking)
- [ ] Vercel production runs with live Stripe key and intended merchant account; Preview uses only test keys and test Supabase.
- [ ] Confirm Stripe account charges_enabled, payouts_enabled, verification requirements and webhook endpoint in the authenticated admin health endpoint. Do not copy keys into tickets or commits.
- [ ] Using Stripe test mode and a separately isolated test database, create one customer order and complete Checkout; confirm order, amount, currency, owner, session ID and payment status from the signed webhook.
- [ ] Replay identical and out-of-order events; verify only one paid transition.
- [ ] Test declined/expired/async-failed payments and reconciliation.
- [ ] Implement and test refund/chargeback lifecycle handling (currently no dedicated event handling), including access restrictions and staff notification.
- [ ] Reconcile historical wallet balances and legacy top-up events before making changes to stored credit.

## Gate B — Storage and authorization (blocking)
- [ ] Create customers A and B. Confirm A cannot access B's orders, technical requests, upload signing, files, invoices or download URLs; reverse and repeat.
- [ ] Confirm anonymous callers cannot access admin, staff, scanner, and signed-download endpoints.
- [ ] Verify pending/error/blocked file downloads fail closed; ClamAV EICAR must block, harmless file must pass, and scanned results must persist in production database.
- [ ] Check that an altered upload size/name/path cannot be registered and that files over 16 MiB are rejected.
- [ ] Ensure private Supabase Storage buckets and RLS policies match production migrations; audit SECURITY DEFINER routines and their execute permissions.

## Gate C — Accounts and operations (blocking)
- [ ] Enforce MFA for admin/staff; enable server-side leaked-password protections where available or document alternative controls.
- [ ] Verify registration, reset, session invalidation, throttling and bot/abuse protection.
- [ ] Configure actionable alerts for scan failures, webhook failures, new disputes and payment inconsistencies; verify delivery to an owner.
- [ ] Test backups and restore in a separate environment.
- [ ] Confirm production notification cron and transactional sender work and won't send test messages to customers.
- [ ] Publish and review UK-facing privacy notice, retention/deletion policy, terms, refund policy and support contact.
- [ ] Verify vehicle/software compatibility and lawful service descriptions before order acceptance.

## Gate D — Clean release (required)
- [ ] Review/remove tracked source backup and temporary files (they remain in Git history until purged separately).
- [ ] Confirm dependency audit, lint, tests, typecheck and build on the exact candidate commit.
- [ ] Confirm production deploy matches candidate commit, and perform smoke tests on real site.
- [ ] Have a rollback plan and record the person approving the release.

## Read-only technical indicators
- Admin authenticated endpoint: `/api/admin/launch-health` returns Stripe environment indicators, pending scan queues, scan errors, payment status anomalies, refunds/disputes and notification configuration presence.
- GitHub Actions: `Portal quality and payment-security checks` and `Scan pending customer uploads (ClamAV)`.
- These indicators do **not** replace end-to-end payments, authorization, backup and incident-response tests.

## Notes
- Wallet top-ups are currently disabled in the API, but legacy wallet credits and webhook handling remain; do not delete historical balances.
- Release gates that require Stripe/Vercel/Supabase dashboard access must be independently verified; a repository PR cannot prove production account settings.
- Do not merge security-sensitive payment handlers without isolation and tested migration rollback.
