
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function Login() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    setBusy(true);
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(
          "Unable to sign in with those details. Please check your email and password."
        );
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <nav className="nav">
        <Link className="brand" href="/">
          JCS <span>AUTOMOTIVE TUNING</span>
        </Link>
        <Link href="/register">Create account</Link>
      </nav>

      <section
        className="card"
        style={{ maxWidth: 520, margin: "45px auto" }}
      >
        <div className="eyebrow">Welcome back</div>
        <h1 style={{ fontSize: 44 }}>Customer login</h1>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              required
              autoComplete="current-password"
              disabled={busy}
            />

            <button
              type="button"
              className="btn"
              style={{ marginTop: 8 }}
              onClick={() => setShowPassword((current) => !current)}
              aria-pressed={showPassword}
              disabled={busy}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {message && (
          <p role="alert" aria-live="polite">
            {message}
          </p>
        )}

        <p>
          <small>
            Need help accessing your account? Contact JCS Automotive Tuning.
          </small>
        </p>

        <p>
          <small>
            New customer? <Link href="/register">Create an account</Link>
          </small>
        </p>
      </section>
    </main>
  );
}
