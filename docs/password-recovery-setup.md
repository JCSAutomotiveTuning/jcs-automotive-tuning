# Password recovery (Supabase SSR PKCE-independent email link)

The recovery email MUST use Supabase's token hash instead of the default ConfirmationURL PKCE code. Otherwise customers using a different browser/device will still get "PKCE code verifier not found in storage".

## Configure both Supabase projects

In **Authentication → Email Templates → Reset Password**, replace the old reset link with:

```html
<h2>Reset your JCS password</h2>
<p>We received a request to reset your password.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>
<p>If you did not request this, ignore this email.</p>
```

Do not use `{{ .ConfirmationURL }}` or `{{ .Token }}` as the link, and do not include a plaintext password. The URL uses the `redirectTo` from `app/forgot-password/page.tsx`, currently `https://<portal-domain>/auth/confirm`.

Configure Supabase Authentication URL Configuration: allow `https://jcs-automotive-tuning.vercel.app/auth/confirm` (and known test/preview domains for testing). Redirect domains must be trusted and should not use broad production wildcards.

`GET /auth/confirm?token_hash=...&type=recovery` verifies the single-use recovery token with `verifyOtp` in the server context, persists the resulting session to cookies, and redirects to the existing password change form. Cross-device flows no longer depend on a verifier cookie from the browser that requested the email.

## End-to-end acceptance

1. Apply email template and allowlist to test Supabase project before live.
2. Request recovery for a test-only account and open its email on a different browser/device; choose a new password, and sign in.
3. Reopen same token to verify the link fails safely; request a fresh link.
4. Verify invalid token returns a friendly message, never an internal PKCE trace.
5. Confirm normal sign-in and other Supabase auth flows still work.
6. Repeat for production after test and template configuration.

Existing password-reset emails issued BEFORE changing the template remain PKCE links; request a new one after deployment.
