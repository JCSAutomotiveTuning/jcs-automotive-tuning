# Deployment checklist

## Before running locally
- [ ] Install Node.js LTS.
- [ ] Create a Supabase project.
- [ ] Run `supabase/schema.sql` in the SQL Editor.
- [ ] Create private Storage bucket `tuning-files`.
- [ ] Copy `.env.example` to `.env.local`; fill in Supabase values.
- [ ] Run `npm install`, then `npm run dev`.

## Before any public launch
- [ ] Configure password reset and transactional email.
- [ ] Add request rate limiting and bot/abuse protection.
- [ ] Add malware scanning/quarantine worker; `scan_status=pending` must not be treated as clean.
- [ ] Validate uploaded object size and metadata against actual stored object; don't trust browser-reported size or filename.
- [ ] Add server-verified Stripe webhooks and PayPal webhooks; test signature verification, duplicate events, refunds and disputes.
- [ ] Implement payment checkout sessions created server-side from order IDs and database prices.
- [ ] Add secure download route that checks order ownership, verified paid status, approved output status and technician/admin release.
- [ ] Add admin workflow endpoints with role checks and audit logging for status changes and output-file release.
- [ ] Add password reset, MFA for staff, session controls and rate limits.
- [ ] Add privacy notice, terms, refund policy, file-retention/deletion policy and UK GDPR review.
- [ ] Configure backups and test a restore.
- [ ] Add monitoring, error alerts and incident-response process.
- [ ] Run dependency/security review and cross-account access tests.
- [ ] Verify calibration workflows only process explicitly supported software versions.
- [ ] Keep emissions work limited to diagnosis and lawful repairs.

## Important current limitations
This starter creates orders and supports a basic private upload flow. It does not yet take payments, scan files for malware, process calibration files, or release downloads. Do not accept live payments or sensitive customer files until the checklist is completed and tested.
