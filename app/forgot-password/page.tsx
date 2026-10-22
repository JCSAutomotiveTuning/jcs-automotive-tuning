
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (error) {
        console.error("Password reset error:", error.message);
        setMessage("Unable to send the reset email. Please try again.");
      } else {
        setMessage(
          "If an account exists for that email, a reset link will be sent. Please check your inbox."
        );
      }
    } catch (error) {
      console.error("Password reset failed:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-bold">
        Reset your password
      </h1>

      <p className="mb-6 text-gray-600">
        Enter the email address associated with your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block font-medium"
          >
            Email address
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border p-3"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
    </main>
  );
}