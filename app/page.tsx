import Link from "next/link";

const services = [
  { name: "Stage 1 ECU File Service", price: "£45", desc: "Stage 1 file service for supported ECU software and standard hardware configurations.", tag: "STAGE 1" },
  { name: "DSG / TCU Calibration Review", price: "£60", desc: "Calibration review for supported DSG and TCU software versions.", tag: "TRANSMISSION" },
  { name: "Diagnostic Log / File Review", price: "£15", desc: "Diagnostic log and file review with a clear technician assessment.", tag: "DIAGNOSTICS" },
  { name: "DPF / EGR Diagnostics", price: "£25", desc: "Emissions-system fault diagnosis and lawful repair assessment.", tag: "REPAIR" },
  { name: "Custom ECU Tuning", price: "From £180", desc: "Bespoke ECU calibration for compatible vehicles, subject to software and hardware checks.", tag: "CUSTOM ECU" },
  { name: "Custom DSG / TCU Tuning", price: "From £180", desc: "Custom transmission calibration for supported control units and requirements.", tag: "CUSTOM TCU" },
  { name: "Custom ECU + DSG / TCU Package", price: "Quote required", desc: "Combined ECU and transmission calibration. Receive a confirmed price before payment or work begins.", tag: "COMBINED PACKAGE" },
];

function WhatsAppIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M9 9c.5 2.5 2.5 4.5 5 5l1.5-1.2 2 1.1c-.4 2-2 2.4-3.5 2-3.4-.8-6.1-3.5-6.9-6.9-.4-1.5 0-3.1 2-3.5l1.1 2L9 9Z"/></svg>;
}
function MailIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
}
function UploadIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 16v4h16v-4"/></svg>;
}

export default function Home() {
  return (
    <main className="jcs-home">
      <style>{`
        .jcs-home { min-height:100vh; background:#0e151d; color:#f4f8fb; padding:0 24px 30px; font-family:inherit; }
        .jcs-home * { box-sizing:border-box; }
        .jcs-home .shell { max-width:1180px; margin:0 auto; }
        .jcs-home a { text-decoration:none; }
        .jcs-home .topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:24px 0; border-bottom:1px solid #263747; }
                /* JCS responsive logo */
        .jcs-home .identity .mark {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          min-width: 80px;
          padding: 0;
          overflow: hidden;
          border: 0;
          border-radius: 14px;
          background: transparent;
          box-shadow: none;
        }
        .jcs-home .identity .mark img {
          display: block;
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          border-radius: 12px;
        }
        @media (max-width: 580px) {
          .jcs-home .identity .mark {
            width: 60px;
            height: 60px;
            min-width: 60px;
          }
        }
        .jcs-home .identity { display:flex; align-items:center; gap:12px; min-width:0; }
        .jcs-home .mark { display:grid; place-items:center; width:44px; height:44px; flex-shrink:0; border-radius:12px; background:#142f40; color:#8ed9ff; font-size:18px; font-weight:900; letter-spacing:-1px; }
        .jcs-home .brand-name { font-weight:850; font-size:18px; line-height:1.1; letter-spacing:-.5px; }
        .jcs-home .brand-name span { color:#8ed9ff; }
        .jcs-home .brand-sub { font-size:10px; letter-spacing:1.9px; color:#8ca7b8; margin-top:5px; }
        .jcs-home .contacts { display:flex; align-items:center; gap:7px; margin-left:5px; }
        .jcs-home .icon-link { display:grid; place-items:center; width:36px; height:36px; border:1px solid #345063; border-radius:10px; color:#a4dfff; background:#152531; transition:background .15s,transform .15s; }
        .jcs-home .icon-link:hover { background:#214053; transform:translateY(-1px); }
        .jcs-home .icon-link.wa { color:#6fe2a0; }
        .jcs-home .account-links { display:flex; align-items:center; gap:10px; }
        .jcs-home .link-muted { color:#c7d5df; font-weight:650; font-size:13px; padding:10px; }
        .jcs-home .outline-btn { border:1px solid #4d687b; color:#eaf7ff; border-radius:10px; padding:11px 15px; font-size:13px; font-weight:700; white-space:nowrap; }
        .jcs-home .hero-panel { margin-top:36px; border:1px solid #30485a; border-radius:22px; padding:clamp(26px,5vw,64px); background:radial-gradient(circle at 90% 20%,#1c4258 0,transparent 48%),linear-gradient(125deg,#14212d,#101a23); position:relative; overflow:hidden; }
        .jcs-home .eyebrow { color:#8ed9ff; font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; }
        .jcs-home h1 { font-size:clamp(34px,5.4vw,64px); line-height:1.06; letter-spacing:-2px; margin:20px 0; max-width:750px; }
        .jcs-home h1 em { font-style:normal; color:#8ed9ff; }
        .jcs-home .intro { max-width:690px; color:#b4c6d3; font-size:16px; line-height:1.75; }
        .jcs-home .actions { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-top:30px; }
        .jcs-home .primary-btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; background:#8ed9ff; color:#0b2433; border-radius:11px; padding:15px 22px; font-weight:850; font-size:14px; }
        .jcs-home .secondary-btn { display:inline-flex; align-items:center; justify-content:center; padding:14px 20px; border:1px solid #527084; color:#edf7ff; border-radius:11px; font-weight:700; font-size:14px; }
        .jcs-home .secure-note { display:flex; align-items:center; gap:8px; margin-top:18px; font-size:12px; color:#91aaba; }
        .jcs-home .section-heading { display:flex; justify-content:space-between; gap:14px; align-items:end; margin:45px 0 19px; }
        .jcs-home h2 { font-size:25px; letter-spacing:-.7px; margin:0; }
        .jcs-home .section-heading p { color:#92a9b9; font-size:13px; margin:0; }
        .jcs-home .service-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .jcs-home .service-card { background:#15212b; border:1px solid #2a3c4b; border-radius:16px; padding:23px; display:flex; flex-direction:column; min-height:230px; }
        .jcs-home .tag { font-size:10px; font-weight:800; letter-spacing:1.2px; color:#8ed9ff; }
        .jcs-home .service-card h3 { font-size:17px; line-height:1.4; margin:13px 0 9px; }
        .jcs-home .service-card .price { font-size:21px; font-weight:800; color:#e7f8ff; }
        .jcs-home .service-card p { color:#a9bdca; font-size:13px; line-height:1.6; margin:12px 0 18px; flex:1; }
        .jcs-home .service-card a { color:#8ed9ff; font-size:13px; font-weight:750; }
        .jcs-home .info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:18px; }
        .jcs-home .info-card { background:#13202a; border:1px solid #2a3c4b; border-radius:16px; padding:25px; }
        .jcs-home .info-card h3 { margin:0 0 9px; font-size:17px; }
        .jcs-home .info-card p { margin:0; color:#a9bdca; font-size:13px; line-height:1.7; }
        .jcs-home footer { border-top:1px solid #2a3c4b; color:#8ca4b5; margin-top:40px; padding-top:22px; font-size:12px; line-height:1.7; }
        @media(max-width:850px) { .jcs-home .service-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .jcs-home .section-heading { align-items:start; flex-direction:column; } }
        @media(max-width:580px) { .jcs-home { padding:0 15px 24px; } .jcs-home .topbar { flex-wrap:wrap; padding:18px 0; } .jcs-home .account-links { width:100%; justify-content:flex-end; } .jcs-home .hero-panel { margin-top:18px; padding:27px 20px; } .jcs-home h1 { letter-spacing:-1px; } .jcs-home .intro { font-size:14px; } .jcs-home .actions a { width:100%; } .jcs-home .service-grid,.jcs-home .info-grid { grid-template-columns:1fr; } .jcs-home .brand-name { font-size:15px; } .jcs-home .brand-sub { font-size:9px; } }
      `}</style>
      <div className="shell">
        <header className="topbar">
          <div className="identity">
            <Link href="/" className="mark" aria-label="JCS Automotive Tuning homepage">
  <img
    src="/jcs-automotive-logo.webp"
    alt="JCS Automotive Tuning logo"
    width={76}
    height={76}
    style={{ width: "76px", height: "76px", objectFit: "contain", borderRadius: "10px" }}
  />
</Link>
            <div>
              <div className="brand-name">JCS <span>AUTOMOTIVE TUNING</span></div>
              <div className="brand-sub">ECU · TCU · FILE SERVICES</div>
            </div>
            <div className="contacts">
              <a className="icon-link wa" href="https://wa.me/447501941328" target="_blank" rel="noopener noreferrer" aria-label="Chat with JCS Automotive Tuning on WhatsApp" title="WhatsApp"><WhatsAppIcon /></a>
              <a className="icon-link" href="mailto:tuningatjcs@gmail.com" aria-label="Email JCS Automotive Tuning" title="Email"><MailIcon /></a>
            </div>
          </div>
          <nav className="account-links" aria-label="Customer account">
            <Link className="link-muted" href="/login">Sign in</Link>
            <Link className="outline-btn" href="/register">Create account</Link>
          </nav>
        </header>

        <section className="hero-panel" id="jcs-home-upload">
          <div className="eyebrow">JCS Automotive Tuning · Customer File Portal</div>
          <h1>Precision tuning.<br /><em>One simple portal.</em></h1>
          <p className="intro">ECU file services, DSG / TCU calibration reviews and custom tuning for supported vehicles. Upload your original file, tell us what you need and track your order securely in one place.</p>
          <div className="actions">
            <Link className="primary-btn" href="/dashboard#upload-tuning-file"><UploadIcon /> Upload Tuning File <span aria-hidden="true">→</span></Link>
            <Link className="secondary-btn" href="/register">Create customer account</Link>
          </div>
          <div className="secure-note">▣ Account sign-in required before uploading · Compatibility reviewed before acceptance</div>
        </section>

        <div className="section-heading"><h2>ECU &amp; TCU Services</h2><p>Clear starting prices. Individual quotes where needed.</p></div>
        <section className="service-grid" aria-label="Tuning services">
          {services.map((service) => <article className="service-card" key={service.name}>
            <div className="tag">{service.tag}</div>
            <h3>{service.name}</h3>
            <div className="price">{service.price}</div>
            <p>{service.desc}</p>
            <Link href="/register">Request a quote →</Link>
          </article>)}
        </section>

        <section className="info-grid" aria-label="How our portal works">
          <article className="info-card"><h3>Pricing that fits the job</h3><p>Prices are starting points where stated. Final costs depend on the ECU or TCU, software version, file requirements, supplier costs and job complexity. We confirm the agreed price before work begins.</p></article>
          <article className="info-card"><h3>Secure file handling</h3><p>Keep vehicle details, submitted files, order status and technician updates together in your customer account. Compatibility is reviewed before work is accepted.</p></article>
        </section>
        <footer>JCS Automotive Tuning · Prices may vary by vehicle, control unit and requirements. All work is subject to compatibility review. Emissions services are limited to diagnostics and lawful repairs.</footer>
      </div>
    </main>
  );
}
