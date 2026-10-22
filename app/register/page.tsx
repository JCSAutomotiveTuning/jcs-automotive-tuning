"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function Register() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const fd = new FormData(e.currentTarget);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signUp({ email: String(fd.get("email")), password: String(fd.get("password")), options: { emailRedirectTo: `${location.origin}/dashboard` } });
    setBusy(false);
    setMessage(error ? error.message : "Account request submitted. Check your email if email confirmation is enabled.");
  }
  return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>AUTOMOTIVE TUNING</span></Link><Link href="/login">Already registered? Sign in</Link></nav><section className="card" style={{maxWidth:520,margin:"45px auto"}}><div className="eyebrow">Customer account</div><h1 style={{fontSize:44}}>Create account</h1><p>Register to submit tuning files and track your jobs.</p><form onSubmit={submit}><div className="field"><label>Email address</label><input type="email" name="email" required autoComplete="email"/></div><div className="field"><label>Password (minimum 10 characters)</label><input type="password" name="password" minLength={10} required autoComplete="new-password"/></div><button className="btn" disabled={busy}>{busy?"Creating…":"Create account"}</button></form>{message&&<p role="status">{message}</p>}</section></main>;
}
