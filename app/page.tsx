import Link from "next/link";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

const services = [
  {
    name: "Stage 1 ECU File Service",
    price: "£45",
    desc: "Stage 1 file service for supported ECU software and standard hardware configurations.",
    tag: "STAGE 1",
  },
  {
    name: "DSG / TCU Calibration Review",
    price: "£60",
    desc: "Calibration review for supported DSG and TCU software versions.",
    tag: "TRANSMISSION",
  },
  {
    name: "Diagnostic Log / File Review",
    price: "£15",
    desc: "Diagnostic log and file review with a clear technician assessment.",
    tag: "DIAGNOSTICS",
  },
  {
    name: "DPF / EGR Diagnostics",
    price: "£25",
    desc: "Emissions-system fault diagnosis and lawful repair assessment.",
    tag: "REPAIR",
  },
  {
    name: "Custom ECU Tuning",
    price: "From £180",
    desc: "Bespoke ECU calibration for compatible vehicles, subject to software and hardware checks.",
    tag: "CUSTOM ECU",
  },
  {
    name: "Custom DSG / TCU Tuning",
    price: "From £180",
    desc: "Custom transmission calibration for supported control units and requirements.",
    tag: "CUSTOM TCU",
  },
  {
    name: "Custom ECU + DSG / TCU Package",
    price: "Quote required",
    desc: "Combined ECU and transmission calibration. Receive a confirmed price before payment or work begins.",
    tag: "COMBINED PACKAGE",
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
          <Link className="pill" href="/login">
            Customer login
          </Link>
          <Link className="btn" href="/register">
            Create account
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">ECU · DSG · PERFORMANCE CALIBRATION</div>
        <h1>
          Calibration work.
          <br />
          <em>Handled properly.</em>
        </h1>
        <p>
          ECU file services from £45, DSG / TCU calibration reviews from
          £60, and custom ECU or TCU tuning from £180. Combined ECU and
          transmission packages are quoted individually. Submit your
          requirements, track your order and access approved work through
          your customer account.
        </p>
        <div
          className="row"
          style={{
            justifyContent: "flex-start",
            flexWrap: "wrap",
            marginTop: 22,
          }}
        >
          <Link className="btn" href="/register">
            Start an order →
          </Link>
          <Link className="btn secondary" href="/login">
            Sign in
          </Link>
        </div>
      </section>

      <section className="grid">
        {services.map((service) => (
          <article className="card" key={service.name}>
            <div className="status">{service.tag}</div>
            <h2 style={{ marginTop: 14 }}>{service.name}</h2>
            <div className="price">{service.price}</div>
            <p>{service.desc}</p>
            <Link href="/register">Request a quote →</Link>
          </article>
        ))}
      </section>

      <section className="two" style={{ marginTop: 22 }}>
        <article className="card">
          <h2>Pricing that fits the job</h2>
          <p>
            Prices are starting points where stated. Final costs depend
            on the ECU or TCU, software version, file requirements,
            supplier costs and job complexity. We confirm the agreed
            price before work begins.
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
        JCS Automotive Tuning · Prices may vary by vehicle, control unit
        and requirements. All work is subject to compatibility review.
        Emissions services are limited to diagnostics and lawful repairs.
      </footer>
    </main>
  );
}
