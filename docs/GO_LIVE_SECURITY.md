# JCS Automotive Tuning — production security and go-live checks

## Current security architecture (27 October 2026)
- Each tuning file is stored privately and registered as `pending`. Admin/technical downloads require `scan_status = clean`.
- File uploads are included in the confirmed service price. Wallet top-ups are paused and historical balances are preserved.
- Only trusted server APIs can create orders or insert tuning-file metadata. Customers cannot bypass service pricing with direct table inserts.
- The staff authorization helper is in `jcs_private.is_staff()`, outside the public Data API.
- Technical-request files and completed order files now have the database scan/approval columns expected by the API.
- Stripe checkout sessions are reserved/idempotent; signed webhook handling has regression tests. **A successful hosted sandbox checkout remains a required launch test.**

## Configure automated ClamAV scanning — REQUIRED
A scanning script and a GitHub Actions workflow are committed but are **not active as an end-to-end service until repository secrets are supplied and a workflow run passes**.

1. In GitHub, open this repository > Settings > Secrets and variables > Actions > New repository secret.
2. Add `JCS_SUPABASE_URL` = the production project's Supabase HTTPS URL.
3. Add `JCS_SUPABASE_SERVICE_ROLE_KEY` = the production server-side Supabase service-role API key. Copy directly between provider dashboards; **never put the key in source code, an issue, a chat, or workflow logs**.
4. Go to Actions > **Scan pending customer uploads (ClamAV)** > Run workflow. Confirm the run shows `PASS: ClamAV detected the EICAR test signature` and ends successfully.
5. Check in Supabase that a known harmless pending file changes to `clean`, and that unscannable/blocked files cannot be downloaded. Review logs and monitor the scheduled workflow.
6. Keep the repository branch protected and limit write permissions: scheduled workflows on this public repository can access those privileged GitHub Actions secrets. Uploaded customer tuning files will be processed on GitHub-hosted runners; account for this in data-handling/privacy disclosures.

The workflow schedules scanning every 15 minutes, but GitHub scheduled jobs may be delayed. No file is declared `clean` without successful ClamAV results. Failure/unknown engine status is `error`, not `clean`. Scan findings do not delete customer files; they remain quarantined.

Alternative: Run `npm ci` on a trusted machine with ClamAV installed, set `CLAMSCAN_PATH`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` securely in that machine's environment, run `node scripts/scan-pending-files.mjs --self-test`, and schedule `node scripts/scan-pending-files.mjs` yourself. Never commit the secret.

## Password protection
- Customer registration and reset now require 12 characters and use the Have I Been Pwned range API in the browser, sending only a partial SHA-1 hash.
- **This browser check is not authoritative.** Direct Supabase Auth API calls can bypass it.
- Supabase's official server-side leaked-password protection remains required for full protection. The linked project currently uses the **Supabase Free plan**; this capability is only available on **Supabase Pro and above**. Enable in Authentication > Sign In / Providers > Email after choosing a supported plan. Do not upgrade without owner billing approval.

## Stripe go-live test (do not use live money for verification)
1. Confirm Vercel Preview uses the *test* Stripe secret, test webhook signing secret, test Supabase database and non-production callback URL. Do not mix test and live keys.
2. Register a test customer, create a priced order (including add-ons-only quote), upload a harmless file, and confirm **no wallet debit** occurs.
3. Confirm the quote in admin, request payment, and create a **Stripe test-mode** Checkout Session using Stripe test card details.
4. Verify the paid test webhook changes precisely that order from `awaiting_payment/unpaid` to `paid/paid`, exactly once. Replay the test webhook and check idempotency.
5. Test wrong customer/session/amount events, cancelled/expired session, duplicate checkout attempts, failed payment, refund and dispute handling.
6. Verify file delivery needs a `clean` scan result and approved output, and that unrelated customers cannot access each other's files.
7. Verify Stripe live account charge/payout permissions and required emails/configuration before enabling unrestricted real payments.

**Do not mark live payments production-ready solely because CI and Vercel builds pass.** Runtime integration and webhook setup must be demonstrated.

## Code quality
GitHub Actions `Portal quality and payment-security checks` runs `npm ci`, lint, mocked regression tests, production build and TypeScript verification using synthetic environment variables. No live payments or production customer data are used by the CI job.

## Remaining operational review
- Confirm Vercel production notifications environment (CRON_SECRET, email sender, service key) and actual scheduled invocation before enabling customer notifications.
- Add production alerts for failed Stripe webhook confirmations, scanning failures, Stripe disputes and expired checkout reconciliation.
- Review retention/deletion, refunds, terms, UK GDPR obligations, backups, restore tests, staff MFA and account lockout/rate limiting.
- Keep private download restrictions intact while scanner is not operational.
