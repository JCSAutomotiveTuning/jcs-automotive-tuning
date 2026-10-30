import Link from "next/link";
import LogChartClient from "./LogChartClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DatalogAnalysisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase.from("orders")
    .select("id,vehicle_make,vehicle_model,status,payment_status,created_at,order_files(id,original_filename,scan_status)")
    .eq("user_id", user.id).eq("service_code", "datalog_analysis")
    .order("created_at", { ascending: false }).limit(30);

  return <main className="wrap">
    <nav className="nav"><Link className="brand" href="/dashboard">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav>
    <section className="jcs-workspace-hero">
      <div>
        <div className="eyebrow">Professional diagnostic services</div>
        <h1>Datalog <em>analysis.</em></h1>
        <p>Upload your VCDS, OBD or ECU/TCU log for a technician-reviewed assessment. We examine the available channels and provide written findings rather than automated guesses.</p>
        <div className="jcs-workspace-actions"><Link className="btn" href="/dashboard?service=datalog_analysis#upload-tuning-file">Request £20 Datalog Analysis</Link><a className="btn secondary" href="#reviews">My review requests</a></div>
      </div>
      <div className="jcs-workspace-summary">
        <div className="jcs-summary-label">Fixed-price service</div>
        <div className="price">£20.00</div>
        <p>Per submitted review request. Select <strong>Datalog analysis</strong> on the order form (the request button selects it for you). Enter vehicle and engine details, paste relevant log readings into job notes, and attach your original CSV, LOG or TXT file.</p>
        <p>File submission is included in the service price. A separate wallet top-up is not required. Payment is requested only after JCS checks the uploaded file.</p>
      </div>
    </section>
    <LogChartClient />
    <section className="card" style={{marginBottom:20}}>
      <h2>What you can request</h2>
      <div className="grid">
        <div><h3>ECU &amp; boost logs</h3><p>Requested versus actual boost, fuel pressure, lambda, airflow, ignition correction and operating conditions when logged.</p></div>
        <div><h3>DSG / TCU logs</h3><p>Shift behaviour, clutch pressure, slip and requested torque when the necessary channels are available.</p></div>
        <div><h3>Graphs &amp; feedback</h3><p>Channel plots and a written technician review. Dyno horsepower/torque graphs require actual dyno measurements; road logs alone are not a dyno test.</p></div>
      </div>
      <p><strong>Submission:</strong> Choose the £20 Datalog Analysis service, enter your symptoms, logger and test conditions, then upload a CSV, LOG or TXT recording. Review findings are returned against your order after payment and file safety checks. For an existing ECU/TCU tuning job, select the optional £20 <strong>Diagnostic → Datalog analysis</strong> add-on and attach the separate log file.</p>
    </section>
    <section id="reviews" className="card" style={{scrollMarginTop:20}}>
      <h2>My datalog analysis requests</h2>
      {!orders?.length ? <p>No log reviews submitted yet. Use the button above to create your first request.</p> :
        <div className="stack">{orders.map(order => <article className="order-entry order-card" key={order.id}>
          <div className="row"><strong>{order.vehicle_make} {order.vehicle_model}</strong><span className="order-badge">{order.status.replaceAll("_"," ")}</span></div>
          <p>Order #{order.id.slice(0,8)} · {new Date(order.created_at).toLocaleDateString("en-GB")} · Payment: {order.payment_status}</p>
          <p>Uploaded files: {order.order_files?.length ?? 0}</p>
          <p>For the written technician review, use your order updates and Support Centre. Internal workshop notes are not published to customers.</p>
        </article>)}</div>}
    </section>
  </main>;
}
