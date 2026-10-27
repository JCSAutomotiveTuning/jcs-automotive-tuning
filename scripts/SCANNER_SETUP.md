# JCS production ClamAV file scanner

Files upload into a **private Supabase bucket** and remain `pending`. Every admin/technician/customer download must require `scan_status = clean`. The worker scans both tuning files and technical-request attachments; it uses your ordinary admin sign-in, **not** a Supabase service-role key.

## Required on a Windows PC that stays switched on

1. Install ClamAV and update the virus definition databases using `freshclam`. Confirm `clamscan --version` and that `clamscan <known-clean-file>` reports a nonzero `Known viruses` signature count.
2. Run `npm ci` in the portal's project directory.
3. Set `JCS_SCAN_SUPABASE_URL=https://tpvsebxdrluadefhboez.supabase.co` and `JCS_SCAN_SUPABASE_ANON_KEY` to the **production public anon/publishable key**. The worker may use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` already in your local `.env.local`, but will refuse a test-project URL.
4. In PowerShell from the project folder, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\start-scan-worker.ps1`. Enter your production admin email and password when prompted. If ClamAV is not in PATH, set `JCS_CLAMSCAN_PATH` to the full path of `clamscan.exe`.
5. Keep the worker running for every new upload. If it stops, files remain pending and inaccessible. This **does not** mean that the cloud portal is scanning files when the PC is offline.
6. Run a **non-production** EICAR detection check before allowing customers to upload, and verify that the API status becomes `blocked`; a known safe calibration file should become `clean`. Do not open an unscanned ZIP or execute any uploaded content.

### Important security notes

- This process retrieves customer data to your machine. Use a trusted, encrypted, access-controlled PC. Do not forward file URLs or allow another person to use the admin password.
- Scan results are accepted only from a verified admin's bearer token; they are never accepted from a customer or unknown user.
- A clean antivirus result does not prove an ECU file is safe to flash. Calibration and checksum verification remain separate steps.
- If the worker is not operating and the acceptance tests have not passed, **do not launch paid upload services**.
