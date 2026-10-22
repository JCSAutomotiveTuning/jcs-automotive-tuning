"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function Login() {
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const fd = new FormData(e.currentTarget);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const {error} = await supabase.auth.signInWithPassword({email:String(fd.get("email")),password:String(fd.get("password"))});
    setBusy(false);
    if(error) setMessage(error.message); else location.href="/dashboard";
  }
  return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>AUTOMOTIVE TUNING</span></Link><Link href="/register">Create account</Link></nav><section className="card" style={{maxWidth:520,margin:"45px auto"}}><div className="eyebrow">Welcome back</div><h1 style={{fontSize:44}}>Customer login</h1><form onSubmit={submit}><div className="field"><label>Email address</label><input type="email" name="email" required autoComplete="email"/></div><div className="field"><label>Password</label><input type="password" name="password" required autoComplete="current-password"/></div><button className="btn" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form>{message&&<p role="alert">{message}</p>}<p><small>Password reset can be added before public launch.</small></p></section></main>;
}
