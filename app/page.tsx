import Link from "next/link";

const services = [
  {
    name: "Custom ECU Files",
    price: "From £180",
    desc: "Bespoke engine ECU file service, with compatibility checks and calibration requirements reviewed for your vehicle.",
    tag: "ENGINE",
  },
  {
    name: "Custom TCU / DSG Files",
    price: "From £180",
    desc: "Custom transmission calibration for supported TCU and DSG control units, tailored to your gearbox and requirements.",
    tag: "TRANSMISSION",
  },
  {
    name: "Log & File Review",
    price: "£15",
    desc: "Diagnostic log and file review with a clear technician report.",
    tag: "DIAGNOSTICS",
  },
  {
    name: "DPF / EGR Diagnosis",
    price: "£25",
    desc: "Fault diagnosis and lawful emissions-system repair assessment.",
    tag: "REPAIR",
  },
];

export default function Home() {
  return (
    <main className="wrap">
      <nav className="nav">
        <div className="brand">
          JCS <span>AUTOMOTIVE TUNING</span>
        </div>
        <div className="row">
          <Link className="pill" href="/login">Customer login</Link>
          <Link className="btn" href="/register">Create account</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">ECU · DSG · CUSTOM CALIBRATION</div>
        <h1>
          Calibration work.<br />
          <em>Handled properly.</em>
        </h1>
        <p>
          Custom ECU and TCU file services starting from £180.
          Submit your requirements, track your order through your
          customer account and securely access completed work
          once it has been approved.
        </p>
        <div
          className="row"
          style={{
            justifyContent: "flex-start",
            flexWrap: "wrap",
            marginTop: 22,
          }}
        >
          <Link className="btn" href="/register">Start an order →</Link>
          <Link className="btn secondary" href="/login">Sign in</Link>
        </div>
      </section>

      <section className="grid">
        {services.map((s) => (
          <article className="card" key={s.name}>
            <div className="status">{s.tag}</div>
            <h2 style={{ marginTop: 14 }}>{s.name}</h2>
            <div className="price">{s.price}</div>
            <p>{s.desc}</p>
            <Link href="/register">Request a quote →</Link>
          </article>
        ))}
      </section>

      <section className="two" style={{ marginTop: 22 }}>
        <article className="card">
          <h2>Pricing that fits the job</h2>
          <p>
            Custom ECU and TCU services start at £180. Additional
            charges may apply depending on the control unit, file
            requirements, supplier costs and complexity. The final
            price will be confirmed before work begins.
          </p>
        </article>
        <article className="card">
          <h2>Secure file handling</h2>
          <p>
            Keep your vehicle details, submitted files, order status
            and technician updates together in your customer account.
            File compatibility and suitability are reviewed before
            work is accepted.
          </p>
        </article>
      </section>

      <footer>
        JCS Automotive Tuning · Custom ECU and TCU services from £180.
        Additional costs depend on the job and will be confirmed
        before work begins. All work is subject to compatibility
        review. Emissions services are limited to diagnostics and
        lawful repairs.
      </footer>
    </main>
  );
}
