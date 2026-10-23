# JCS Automotive Tuning Portal — Starter Project

This is a development starter for the JCS Automotive Tuning customer portal. It is **not production-ready until you configure credentials, complete payment integration, test security, and deploy it**.

## What is included
- Next.js + TypeScript app shell with JCS black/blue/yellow styling
- Supabase email authentication
- Customer dashboard and order list
- Server-side order creation with server-controlled prices
- Private Supabase Storage upload via short-lived signed upload URL
- PostgreSQL schema and Row Level Security (RLS) policies
- Admin order workflow API (role checked on the server)
- Payment integration design notes for Stripe and PayPal
- Environment variable template

## Prerequisites
Install Node.js LTS and VS Code:
- https://nodejs.org/
- https://code.visualstudio.com/

Create a Supabase project:
- https://supabase.com/

## Setup
1. Extract this ZIP.
2. Open the extracted folder in VS Code.
3. Open a terminal in that folder and run:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and keys from your Supabase project settings.
5. In Supabase SQL Editor, run `supabase/schema.sql`.
6. In Supabase Storage, create a **private** bucket named `tuning-files`. Do not make it public.
7. Start the app:

   ```bash
   npm run dev
   ```

8. Open http://localhost:3000

## Important configuration notes
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_` and never expose it in client code.
- The starter stores uploads in a private bucket using a generated object path. The client receives a short-lived signed upload URL.
- Set up a real transactional email provider before public launch.
- Admin access is granted using the `profiles.role` field. Change a profile to `admin` only through the Supabase SQL Editor or a trusted server-side administrative process. Never expose an admin role editor to customers.
- The payment route is deliberately not marked paid by a browser redirect. Implement and test provider-verified Stripe and PayPal webhooks before taking live payments.
- This starter does not automatically modify calibration binaries. It creates a controlled manual-review workflow. Add automatic processing only for explicitly validated and supported software versions.
- Emissions-related offerings should be diagnostics and lawful repairs, not emissions-control defeat.

## Before launch
Complete `DEPLOYMENT_CHECKLIST.md`. Do not use real customer ECU/TCU files until security, access control, backups, retention and incident handling have been reviewed and tested.
Stripe test branch deployment
