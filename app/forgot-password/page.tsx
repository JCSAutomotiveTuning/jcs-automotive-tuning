
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (loading) return;
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm`,
        });

      if (error) {
        console.error("Password recovery request failed:", error.message);
        setMessage("Could not process the request right now. Please try again shortly.");
      } else {
        setMessage("If an account exists for that email, a password reset link will be sent. Check your inbox and spam folder.");
      }
    } catch (error) {
      console.error("Password reset failed:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="wrap">
      <nav className="nav">
        <Link className="brand" href="/">JCS <span>AUTOMOTIVE TUNING</span></Link>
        <Link href="/login">Back to sign in</Link>
      </nav>
      <section className="card" style={{ maxWidth: 520, margin: "45px auto" }}>
        <div className="eyebrow">Account recovery</div>
        <h1 style={{ fontSize: 36 }}>Forgot your password?</h1>
        <p>Enter your registered email address. If an account exists, we’ll email you a secure reset link.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="recovery-email">Email address</label>
            <input id="recovery-email" name="email" type="email" autoComplete="email"
              autoCapitalize="none" spellCheck={false} maxLength={254} required
              value={email} onChange={(event) => setEmail(event.target.value)}
              disabled={loading} placeholder="you@example.com" />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Sending reset link..." : "Email password reset link"}
          </button>
        </form>
        {message && <p role="status" aria-live="polite">{message}</p>}
        <p><small>Remembered your password? <Link href="/login">Sign in</Link>.</small></p>
      </section>
    </main>
  );
}
