import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import VehicleSearchClient from "./VehicleSearchClient";
export const dynamic="force-dynamic";
export default async function VehicleSearchPage(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/login");
 return <main className="wrap">
  <nav className="nav"><Link className="brand" href="/dashboard">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav>
  <section className="hero"><div className="eyebrow">Calibration reference library</div>
   <h1>Vehicle &amp; ECU <em>finder.</em></h1>
   <p>Find candidate engine ECUs by make, model, engine code or ECU family. Check separately documented OBD, bench and boot connections before selecting a tool.</p>
  </section>
  <VehicleSearchClient/>
 </main>;
}
