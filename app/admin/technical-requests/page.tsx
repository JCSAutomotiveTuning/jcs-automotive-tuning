import Link from "next/link";
import {redirect} from "next/navigation";
import {technicalAdmin,technicalUser} from "@/lib/technical-requests";
import TechnicalAdminClient from "./TechnicalAdminClient";
export const dynamic="force-dynamic";
export default async function Page(){const user=await technicalUser();if(!user)redirect("/login");if(!await technicalAdmin(user.id))redirect("/dashboard");return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>ADMIN</span></Link><Link className="btn secondary" href="/admin">Admin dashboard</Link></nav><section className="hero"><div className="eyebrow">JCS WORKSHOP</div><h1>Technical request tickets</h1><p>Manage £15 parts and wiring enquiries.</p></section><TechnicalAdminClient/></main>}
