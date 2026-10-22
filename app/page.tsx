
import Link from "next/link";

const services = [
  {
    name: "Stage 1 ECU File",
    price: "From £45",
    desc: "Stage 1 calibration for supported ECU software and standard hardware configurations.",
    tag: "STAGE 1",
  },
  {
    name: "Stage 2 ECU File",
    price: "From £80",
    desc: "Performance calibration for suitable modified vehicles, subject to hardware and software checks.",
    tag: "STAGE 2",
  },
  {
    name: "Stage 1 DSG / TCU File",
    price: "From £60",
    desc: "Gearbox calibration for supported DSG and TCU software versions.",
    tag: "TRANSMISSION",
  },
  {
    name: "Custom ECU Files",
    price: "From £180",
    desc: "Bespoke ECU file development and calibration work, subject to compatibility and requirements.",
    tag: "CUSTOM ECU",
  },
  {
    name: "Custom TCU / DSG Files",
    price: "From £180",
    desc: "Custom transmission calibration for supported control units and specific requirements.",
    tag: "CUSTOM TCU",
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
        <div className="eyebrow">ECU · DSG · PERFORMANCE CALIBRATION</div>
        <h1>
          Calibration work.<br />
          <em>Handled properly.</em>
        </h1>
        <p>
          Stage 1 ECU files from £45, Stage 2 from £80,
          and custom ECU and TCU development from £180.
          Submit your requirements, track your order and
          access approved work through your customer account.
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
            Prices are starting points. Final costs depend on the ECU
            or TCU, software version, file requirements, supplier costs
            and job complexity. We confirm the price before work begins.
          </p>
        </article>
        <article className="card">
          <h2>Secure file handling</h2>
          <p>
            Keep vehicle details, submitted files, order status and
            technician updates together in your customer account.
            Compatibility is reviewed before work is accepted.
          </p>
        </article>
      </section>

      <footer>
        JCS Automotive Tuning · Prices are starting prices and may vary
        by vehicle, control unit and requirements. All work is subject
        to compatibility review. Emissions services are limited to
        diagnostics and lawful repairs.
      </footer>
    </main>
  );
}
