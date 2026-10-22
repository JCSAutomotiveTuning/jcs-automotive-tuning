import Link from "next/link";

const services = [
  { name: "ECU Stage 1", price: "£45", desc: "File intake, software identification and supported calibration workflow.", tag: "ECU" },
  { name: "DSG / TCU", price: "£60", desc: "Gearbox file review and supported TCU calibration workflow.", tag: "TRANSMISSION" },
  { name: "Log & File Review", price: "£15", desc: "Diagnostic log review with a clear technician report.", tag: "DIAGNOSTICS" },
  { name: "DPF / EGR Diagnosis", price: "£25", desc: "Fault diagnosis and lawful emissions-system repair assessment.", tag: "REPAIR" }
];

export default function Home() {
  return <main className="wrap">
    <nav className="nav"><div className="brand">JCS <span>AUTOMOTIVE TUNING</span></div><div className="row"><Link className="pill" href="/login">Customer login</Link><Link className="btn" href="/register">Create account</Link></div></nav>
    <section className="hero"><div className="eyebrow">ECU · DSG · Diagnostics</div><h1>Calibration work.<br/><em>Handled properly.</em></h1><p>Submit your ECU or gearbox file, track the job from your customer account and securely access completed work when it has been approved.</p><div className="row" style={{justifyContent:"flex-start",flexWrap:"wrap",marginTop:22}}><Link className="btn" href="/register">Start an order →</Link><Link className="btn secondary" href="/login">Sign in</Link></div></section>
    <section className="grid">{services.map(s=><article className="card" key={s.name}><div className="status">{s.tag}</div><h2 style={{marginTop:14}}>{s.name}</h2><div className="price">{s.price}</div><p>{s.desc}</p><Link href="/register">Choose service →</Link></article>)}</section>
    <section className="two" style={{marginTop:22}}><article className="card"><h2>Track every job</h2><p>Keep your vehicle details, submitted files, order status and technician updates together in your account.</p></article><article className="card"><h2>Secure by design</h2><p>Private file storage, account-based access and a manual review step for unsupported software versions.</p></article></section>
    <footer>JCS Automotive Tuning · Prices shown are starter examples and must be confirmed before launch. ECU/TCU work is subject to compatibility review. Emissions services are limited to diagnostics and lawful repairs.</footer>
  </main>;
}
