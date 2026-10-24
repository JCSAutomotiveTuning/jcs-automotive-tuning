import Link from "next/link";
import { redirect } from "next/navigation";
import { technicalUser } from "@/lib/technical-requests";
import TechnicalRequestsClient from "./TechnicalRequestsClient";
export const dynamic="force-dynamic";
export default async function Page(){const user=await technicalUser();if(!user)redirect("/login");return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav><section className="hero"><div className="eyebrow">VAG TECHNICAL INFORMATION</div><h1>Parts &amp; Wiring Requests</h1><p>£15 per request. Parts identification and wiring enquiries are charged separately.</p></section><TechnicalRequestsClient/></main>}
