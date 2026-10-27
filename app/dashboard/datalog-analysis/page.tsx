import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DatalogAnalysisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase.from("orders")
    .select("id,vehicle_make,vehicle_model,status,payment_status,created_at,admin_notes,customer_notes,order_files(id,original_filename,scan_status)")
    .eq("user_id", user.id).eq("service_code", "log_review")
    .order("created_at", { ascending: false }).limit(30);

  return <main className="wrap">
    <nav className="nav"><Link className="brand" href="/dashboard">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav>
    <section className="jcs-workspace-hero">
      <div>
        <div className="eyebrow">Professional diagnostic services</div>
        <h1>Datalog <em>review.</em></h1>
        <p>Upload your VCDS, OBD or ECU/TCU log for a technician-reviewed assessment. We examine the available channels and provide written findings rather than automated guesses.</p>
        <div className="jcs-workspace-actions"><Link className="btn" href="/dashboard#upload-tuning-file">Request a £20 log review</Link><a className="btn secondary" href="#reviews">My review requests</a></div>
      </div>
      <div className="jcs-workspace-summary">
        <div className="jcs-summary-label">Fixed-price service</div>
        <div className="price">£20.00</div>
        <p>Per submitted review request. Select <strong>Diagnostic log / file review</strong> on the order form. Enter vehicle and engine details, paste relevant log readings into job notes, and attach your original CSV, LOG or TXT file.</p>
        <p>Any separate wallet submission charge shown during checkout is not included in this £20 service price.</p>
      </div>
    </section>
    <section className="card" style={{marginBottom:20}}>
      <h2>What you can request</h2>
      <div className="grid">
        <div><h3>ECU &amp; boost logs</h3><p>Requested versus actual boost, fuel pressure, lambda, airflow, ignition correction and operating conditions when logged.</p></div>
        <div><h3>DSG / TCU logs</h3><p>Shift behaviour, clutch pressure, slip and requested torque when the necessary channels are available.</p></div>
        <div><h3>Graphs &amp; feedback</h3><p>Channel plots and a written technician review. Dyno horsepower/torque graphs require actual dyno measurements; road logs alone are not a dyno test.</p></div>
      </div>
      <p><strong>Submission:</strong> Choose the £20 log review service, enter your symptoms and test conditions in Job notes, paste short log excerpts if useful, then upload your original file. Review findings are returned against your order after the applicable payment and safety checks.</p>
    </section>
    <section id="reviews" className="card" style={{scrollMarginTop:20}}>
      <h2>My log review requests</h2>
      {!orders?.length ? <p>No log reviews submitted yet. Use the button above to create your first request.</p> :
        <div className="stack">{orders.map(order => <article className="order-entry order-card" key={order.id}>
          <div className="row"><strong>{order.vehicle_make} {order.vehicle_model}</strong><span className="order-badge">{order.status.replaceAll("_"," ")}</span></div>
          <p>Order #{order.id.slice(0,8)} · {new Date(order.created_at).toLocaleDateString("en-GB")} · Payment: {order.payment_status}</p>
          <p>Uploaded files: {order.order_files?.length ?? 0}</p>
          {order.admin_notes && <div className="notice"><strong>JCS technician review / comments</strong><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{order.admin_notes}</p></div>}
          {!order.admin_notes && <p>Technician feedback will appear here once your review has been completed.</p>}
        </article>)}</div>}
    </section>
  </main>;
}
