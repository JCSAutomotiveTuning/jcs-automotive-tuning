
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isKnownCompromisedPassword, passwordStrengthError, MIN_PASSWORD_LENGTH } from "@/lib/password-security";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Checking your reset link...");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyResetLink() {
      const url = new URL(window.location.href);
      const failed = url.searchParams.get("error");
      if (failed === "invalid_link") { if (active) setMessage("This password reset link has expired or was already used. Request a fresh link."); return; }
      const supabase = createClient();
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(
        url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
      );
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;

          // Remove the one-time code from the visible URL.
          window.history.replaceState({}, "", url.pathname);
        } else if (
          type === "recovery" &&
          accessToken &&
          refreshToken
        ) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          window.history.replaceState({}, "", url.pathname);
        } else {
          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session) {
            throw new Error(
              "This reset link is invalid or has expired. Request a new one."
            );
          }
        }

        if (active) {
          setReady(true);
          setMessage("");
        }
      } catch (error) {
        console.error("Reset link verification failed:", error);

        if (active) {
          setReady(false);
          setMessage(
            error instanceof Error
              ? (/code verifier|pkce/i.test(error.message) ? "This older reset link was opened in a different browser or its verification cookie has been lost. Request a new password reset email." : error.message)
              : "Unable to verify the reset link. Request a new one."
          );
        }
      }
    }

    void verifyResetLink();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const strengthError = passwordStrengthError(password);
    if (strengthError) {
      setMessage(strengthError);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (await isKnownCompromisedPassword(password)) {
        setMessage("That password appears in a known data breach. Choose a different, unique password.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Password updated successfully. You can now sign in with your new password."
      );
      setPassword("");
      setConfirmPassword("");
    } catch {
      setMessage("Password security check or reset could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 text-gray-600">
        Enter and confirm your new password below.
      </p>

      {ready ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border p-3"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block font-medium"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded border p-3"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      ) : (
        <div><p role="status" className="text-sm text-gray-600">{message}</p><a href="/forgot-password" className="mt-3 inline-block underline">Request a new reset link</a></div>
      )}

      {ready && message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
    </main>
  );
}
