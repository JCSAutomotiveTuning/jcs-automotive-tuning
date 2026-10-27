// Browser-side defence in depth for JCS account passwords.
// This does not replace Supabase Auth's server-side leaked-password protection.
export const MIN_PASSWORD_LENGTH = 12;

export function passwordStrengthError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }
  if (password.length > 128) {
    return "Use a password shorter than 129 characters.";
  }
  return null;
}

export async function isKnownCompromisedPassword(password: string): Promise<boolean> {
  // Have I Been Pwned's k-anonymity range API: only the first 5 SHA-1 hex digits are sent.
  // No raw password or complete hash leaves the browser.
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    cache: "no-store",
    headers: { "Add-Padding": "true" },
  });
  if (!response.ok) throw new Error("Password reputation check is temporarily unavailable.");
  const text = await response.text();
  return text.split(/\r?\n/).some((line) => line.split(":")[0].trim().toUpperCase() === suffix);
}
