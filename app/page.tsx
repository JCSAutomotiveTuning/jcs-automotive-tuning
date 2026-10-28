import Image from "next/image";
import Link from "next/link";

const services = [
  {
    name: "Stage 1 ECU File Service",
    price: "£55",
    desc: "Stage 1 file service for supported ECU software and standard hardware configurations.",
    tag: "STAGE 1",
  },
  {
    name: "DSG / TCU Calibration Review",
    price: "£70",
    desc: "Calibration review for supported DSG and TCU software versions.",
    tag: "TRANSMISSION",
  },
  {
    name: "ECU / TCU File Check & Review",
    price: "£20",
    desc: "Diagnostic log and file review with a clear technician assessment.",
    tag: "DIAGNOSTICS",
  },
  {
    name: "Datalog Analysis — Technician Review",
    price: "£20",
    desc: "Technician assessment of uploaded vehicle diagnostic logs, with actionable findings.",
    tag: "DATALOG",
  },
  {
    name: "DPF / EGR Diagnostics",
    price: "£30",
    desc: "Emissions-system fault diagnosis and lawful repair assessment.",
    tag: "REPAIR",
  },
  {
    name: "Custom ECU Tuning",
    price: "From £195",
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

function WhatsAppIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
      <path d="M9 9c.5 2.5 2.5 4.5 5 5l1.5-1.2 2 1.1c-.4 2-2 2.4-3.5 2-3.4-.8-6.1-3.5-6.9-6.9-.4-1.5 0-3.1 2-3.5l1.1 2L9 9Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V3m0 0L7 8m5-5 5 5" />
      <path d="M4 16v4h16v-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="jcs-home">
      <style>{`
        .jcs-home {
          --jcs-bg: #0b1119;
          --jcs-panel: #131f2b;
          --jcs-line: #2a4052;
          --jcs-blue: #8ed9ff;
          --jcs-muted: #a8bdcd;
          min-height: 100vh;
          padding: 0 26px 34px;
          background: radial-gradient(ellipse at 85% 0%, rgba(39, 119, 166, .12), transparent 36%), var(--jcs-bg);
          color: #f4f8fc;
          font-family: inherit;
        }
        .jcs-home *, .jcs-home *::before, .jcs-home *::after { box-sizing: border-box; }
        .jcs-home .shell { width: 100%; max-width: 1180px; margin: 0 auto; }
        .jcs-home a { text-decoration: none; }
        .jcs-home a:focus-visible { outline: 3px solid var(--jcs-blue); outline-offset: 4px; }
        .jcs-home .topbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 22px; padding: 18px 0 20px; border-bottom: 1px solid rgba(120, 170, 205, .18);
        }
        .jcs-home .identity { display: flex; align-items: center; gap: 15px; min-width: 0; }
        .jcs-home .brand-mark {
          width: 74px; height: 74px; flex: 0 0 74px;
          display: grid; place-items: center; overflow: hidden;
          border: 1px solid rgba(139, 215, 255, .2);
          border-radius: 18px; background: linear-gradient(150deg, #1b303e, #0f1823);
          box-shadow: 0 10px 30px rgba(0, 0, 0, .2), inset 0 1px rgba(255, 255, 255, .06);
        }
        .jcs-home .brand-mark img { display: block; width: 100%; height: 100%; padding: 4px; object-fit: contain; }
        .jcs-home .brand-copy { min-width: 0; }
        .jcs-home .brand-name { font-size: clamp(14px, 1.5vw, 18px); font-weight: 850; line-height: 1.2; letter-spacing: -.45px; }
        .jcs-home .brand-name span { color: var(--jcs-blue); }
        .jcs-home .brand-sub { margin-top: 6px; color: #96b2c4; font-size: 10px; font-weight: 700; letter-spacing: 1.65px; }
        .jcs-home .contacts { display: flex; gap: 8px; margin-left: 7px; }
        .jcs-home .icon-link {
          width: 39px; height: 39px; display: grid; place-items: center;
          color: #a4dfff; border: 1px solid #345063; border-radius: 12px;
          background: #172735; transition: background .2s, transform .2s, border-color .2s;
        }
        .jcs-home .icon-link.wa { color: #78e4a3; }
        .jcs-home .icon-link:hover { background: #233f51; border-color: #619ac0; transform: translateY(-2px); }
        .jcs-home .account-links { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
        .jcs-home .link-muted { color: #d5e3ee; font-size: 13px; font-weight: 700; padding: 11px 6px; }
        .jcs-home .link-muted:hover { color: var(--jcs-blue); }
        .jcs-home .outline-btn {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 42px; padding: 11px 17px; border-radius: 12px;
          color: #f4faff; background: #192c3b; border: 1px solid #4a718a;
          font-size: 13px; font-weight: 800; white-space: nowrap; transition: background .2s, border-color .2s;
        }
        .jcs-home .outline-btn:hover { background: #254257; border-color: var(--jcs-blue); }
        .jcs-home .hero-panel {
          position: relative; isolation: isolate; overflow: hidden;
          margin-top: 28px; padding: clamp(30px, 5.5vw, 70px);
          border: 1px solid #355266; border-radius: 24px;
          background: radial-gradient(ellipse at 94% 23%, rgba(37, 126, 176, .24) 0%, transparent 47%), linear-gradient(130deg, #182c3c 0%, #111c28 59%, #101923 100%);
          box-shadow: 0 22px 70px rgba(0, 0, 0, .15), inset 0 1px rgba(255, 255, 255, .035);
        }
        .jcs-home .hero-panel::after {
          content: ""; position: absolute; right: -110px; top: -150px; width: 440px; height: 440px;
          border: 1px solid rgba(137, 216, 255, .08); border-radius: 50%;
          box-shadow: 0 0 0 70px rgba(137, 216, 255, .025), 0 0 0 140px rgba(137, 216, 255, .015);
          z-index: -1; pointer-events: none;
        }
        .jcs-home .eyebrow {
          display: inline-flex; align-items: center; gap: 9px;
          color: #a4e2ff; font-size: 11px; font-weight: 800; letter-spacing: 1.9px; text-transform: uppercase;
        }
        .jcs-home .eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #78d6ff; box-shadow: 0 0 14px rgba(120, 214, 255, .6); }
        .jcs-home h1 { max-width: 800px; margin: 23px 0 20px; font-size: clamp(38px, 5.6vw, 68px); line-height: 1.055; font-weight: 850; letter-spacing: -2.25px; }
        .jcs-home h1 em { color: var(--jcs-blue); font-style: normal; }
        .jcs-home .intro { max-width: 690px; margin: 0; color: #bfd0dd; font-size: clamp(15px, 1.55vw, 17px); line-height: 1.8; }
        .jcs-home .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 31px; }
        .jcs-home .primary-btn, .jcs-home .secondary-btn {
          display: inline-flex; justify-content: center; align-items: center; gap: 11px; min-height: 49px;
          border-radius: 12px; padding: 14px 21px; font-size: 14px; font-weight: 800;
          transition: transform .2s, background .2s, border-color .2s, box-shadow .2s;
        }
        .jcs-home .primary-btn { color: #09202d; background: #91dcff; box-shadow: 0 8px 24px rgba(55, 170, 227, .2); }
        .jcs-home .primary-btn:hover { background: #b5eaff; box-shadow: 0 12px 30px rgba(55, 170, 227, .27); transform: translateY(-2px); }
        .jcs-home .secondary-btn { color: #eff8ff; border: 1px solid #59788b; background: rgba(14, 27, 39, .46); }
        .jcs-home .secondary-btn:hover { background: #243b4b; border-color: #9fdbfb; transform: translateY(-2px); }
        .jcs-home .secure-note { display: flex; align-items: center; gap: 10px; margin-top: 20px; color: #a5bdcc; font-size: 12px; line-height: 1.6; }
        .jcs-home .secure-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: #7fd8b7; }
        .jcs-home .section-heading { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin: 47px 0 20px; }
        .jcs-home .section-heading h2 { margin: 0; font-size: clamp(24px, 3vw, 30px); font-weight: 820; letter-spacing: -.85px; }
        .jcs-home .section-heading p { margin: 0; color: #9eb3c1; font-size: 13px; line-height: 1.5; }
        .jcs-home .service-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .jcs-home .service-card {
          position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 266px;
          padding: 25px; border: 1px solid #2b4354; border-radius: 18px;
          background: linear-gradient(160deg, #182735, #131f2b 73%);
          box-shadow: inset 0 1px rgba(255, 255, 255, .025);
          transition: transform .22s, border-color .22s, box-shadow .22s;
        }
        .jcs-home .service-card:hover { transform: translateY(-4px); border-color: #598db0; box-shadow: 0 18px 35px rgba(0,0,0,.18); }
        .jcs-home .tag { width: fit-content; padding: 6px 9px; border: 1px solid #345870; border-radius: 6px; background: #1b3546; color: #a5e2ff; font-size: 10px; font-weight: 800; letter-spacing: 1.05px; }
        .jcs-home .service-card h3 { margin: 18px 0 9px; font-size: 18px; line-height: 1.38; letter-spacing: -.3px; }
        .jcs-home .price { font-size: 24px; font-weight: 850; line-height: 1.25; letter-spacing: -.5px; color: #f1faff; }
        .jcs-home .service-card p { flex: 1; margin: 14px 0 22px; color: #b1c3d1; font-size: 13px; line-height: 1.75; }
        .jcs-home .card-link { display: inline-flex; align-items: center; gap: 8px; width: fit-content; color: var(--jcs-blue); font-size: 13px; font-weight: 800; }
        .jcs-home .card-link:hover { color: #c4edff; }
        .jcs-home .card-link svg { transition: transform .2s; }
        .jcs-home .card-link:hover svg { transform: translateX(3px); }
        .jcs-home .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
        .jcs-home .info-card { padding: 27px; border: 1px solid #283f50; border-radius: 18px; background: #12202c; }
        .jcs-home .info-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .jcs-home .info-number { display: grid; place-items: center; width: 31px; height: 31px; flex: 0 0 31px; border-radius: 9px; background: #203c50; color: #a9e6ff; font-weight: 850; font-size: 11px; }
        .jcs-home .info-card h3 { margin: 0; font-size: 17px; letter-spacing: -.3px; }
        .jcs-home .info-card p { margin: 0; color: #aec1cf; font-size: 13px; line-height: 1.75; }
        .jcs-home footer { margin-top: 46px; padding: 23px 0 0; border-top: 1px solid #2b4050; color: #91aabd; font-size: 12px; line-height: 1.8; }
        @media (max-width: 1030px) {
          .jcs-home .topbar { flex-wrap: wrap; }
          .jcs-home .account-links { margin-left: auto; }
        }
        @media (max-width: 850px) {
          .jcs-home .service-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .jcs-home .section-heading { flex-direction: column; align-items: flex-start; }
          .jcs-home .hero-panel::after { opacity: .5; }
        }
        @media (max-width: 580px) {
          .jcs-home { padding: 0 15px 25px; }
          .jcs-home .topbar { gap: 14px; padding: 15px 0 18px; }
          .jcs-home .identity { gap: 10px; flex-wrap: wrap; width: 100%; }
          .jcs-home .brand-mark { width: 60px; height: 60px; flex-basis: 60px; border-radius: 15px; }
          .jcs-home .brand-name { font-size: 14px; }
          .jcs-home .brand-sub { font-size: 9px; letter-spacing: 1.05px; }
          .jcs-home .contacts { margin: 2px 0 0; width: 100%; padding-left: 70px; }
          .jcs-home .icon-link { width: 36px; height: 36px; }
          .jcs-home .account-links { width: 100%; margin-left: 0; justify-content: flex-start; gap: 12px; }
          .jcs-home .hero-panel { margin-top: 18px; padding: 32px 22px; border-radius: 19px; }
          .jcs-home .hero-panel::after { right: -280px; }
          .jcs-home .eyebrow { font-size: 9px; letter-spacing: 1.2px; }
          .jcs-home h1 { margin: 20px 0 16px; font-size: clamp(35px, 9vw, 45px); letter-spacing: -1.5px; }
          .jcs-home .intro { font-size: 14px; line-height: 1.75; }
          .jcs-home .actions a { width: 100%; }
          .jcs-home .secure-note { align-items: flex-start; }
          .jcs-home .secure-dot { margin-top: 7px; }
          .jcs-home .section-heading { margin-top: 36px; }
          .jcs-home .service-grid, .jcs-home .info-grid { grid-template-columns: 1fr; }
          .jcs-home .service-card { min-height: 0; padding: 23px; }
          .jcs-home .info-card { padding: 23px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jcs-home *, .jcs-home *::before, .jcs-home *::after { transition: none !important; scroll-behavior: auto !important; }
        }
        /* JCS logo alignment fix v2 */
        .jcs-home .topbar {
          min-height: 114px;
          gap: 20px;
        }
        .jcs-home .identity {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }
        .jcs-home .identity .brand-mark,
        .jcs-home .identity .mark {
          box-sizing: border-box;
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 0 0 104px;
          width: 104px;
          height: 104px;
          min-width: 104px;
          padding: 0;
          margin: 0;
          overflow: hidden;
          border: 1px solid rgba(142, 217, 255, .16);
          border-radius: 18px;
          background: #111820;
          box-shadow: 0 9px 25px rgba(0,0,0,.18);
          text-decoration: none;
        }
        .jcs-home .identity .brand-mark img,
        .jcs-home .identity .mark img {
          display: block;
          box-sizing: border-box;
          width: 100% !important;
          height: 100% !important;
          max-width: none;
          padding: 0 !important;
          margin: 0;
          border: 0;
          border-radius: 16px !important;
          object-fit: contain !important;
        }
        .jcs-home .brand-copy { min-width: 0; }
        @media (max-width: 580px) {
          .jcs-home .topbar { min-height: 0; }
          .jcs-home .identity { gap: 12px; }
          .jcs-home .identity .brand-mark,
          .jcs-home .identity .mark {
            flex: 0 0 80px;
            width: 80px;
            height: 80px;
            min-width: 80px;
            border-radius: 15px;
          }
          .jcs-home .identity .brand-mark img,
          .jcs-home .identity .mark img { border-radius: 13px !important; }
          .jcs-home .brand-name { font-size: 14px; line-height: 1.3; }
          .jcs-home .brand-sub { font-size: 9px; letter-spacing: .8px; }
          .jcs-home .contacts { padding-left: 0; margin-left: 0; }
        }
      `}</style>

      <div className="shell">
        <header className="topbar">
          <div className="identity">
            <Link href="/" className="brand-mark" aria-label="JCS Automotive Tuning homepage">
              <Image src="/jcs-automotive-logo.webp" alt="JCS Automotive Tuning logo" width={74} height={74} priority />
            </Link>
            <div className="brand-copy">
              <div className="brand-name">JCS <span>AUTOMOTIVE TUNING</span></div>
              <div className="brand-sub">ECU · TCU · FILE SERVICES</div>
            </div>
            <div className="contacts">
              <a className="icon-link wa" href="https://wa.me/447501941328" target="_blank" rel="noopener noreferrer" aria-label="Chat with JCS Automotive Tuning on WhatsApp" title="WhatsApp">
                <WhatsAppIcon />
              </a>
              <a className="icon-link" href="mailto:tuningatjcs@gmail.com" aria-label="Email JCS Automotive Tuning" title="Email">
                <MailIcon />
              </a>
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
          <p className="intro">
            ECU file services, DSG / TCU calibration reviews and custom tuning for supported vehicles.
            Upload your original file, tell us what you need and track your order securely in one place.
          </p>
          <div className="actions">
            <Link className="primary-btn" href="/dashboard#upload-tuning-file">
              <UploadIcon /> Upload Tuning File <ArrowIcon />
            </Link>
            <Link className="secondary-btn" href="/register">Create customer account</Link>
          </div>
          <div className="secure-note">
            <span className="secure-dot" aria-hidden="true" />
            Account sign-in required before uploading · Compatibility reviewed before acceptance
          </div>
        </section>

        <div className="section-heading" id="services">
          <h2>ECU &amp; TCU Services</h2>
          <p>Clear starting prices. Individual quotes where needed.</p>
        </div>
        <section className="service-grid" aria-label="Tuning services">
          {services.map((service) => (
            <article className="service-card" key={service.name}>
              <div className="tag">{service.tag}</div>
              <h3>{service.name}</h3>
              <div className="price">{service.price}</div>
              <p>{service.desc}</p>
              <Link className="card-link" href="/register">Request a quote <ArrowIcon /></Link>
            </article>
          ))}
        </section>

        <section className="info-grid" aria-label="How our portal works">
          <article className="info-card">
            <div className="info-card-top"><span className="info-number" aria-hidden="true">01</span><h3>Pricing that fits the job</h3></div>
            <p>Prices are starting points where stated. Final costs depend on the ECU or TCU, software version, file requirements, supplier costs and job complexity. We confirm the agreed price before work begins.</p>
          </article>
          <article className="info-card">
            <div className="info-card-top"><span className="info-number" aria-hidden="true">02</span><h3>Secure file handling</h3></div>
            <p>Keep vehicle details, submitted files, order status and technician updates together in your customer account. Compatibility is reviewed before work is accepted.</p>
          </article>
        </section>

        <footer>
          JCS Automotive Tuning · Prices may vary by vehicle, control unit and requirements. All work is subject to compatibility review. Emissions services are limited to diagnostics and lawful repairs.
        </footer>
      </div>
    </main>
  );
}
