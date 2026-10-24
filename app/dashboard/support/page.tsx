import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupportCentre from "./SupportCentre";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default async function SupportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id,service_name,vehicle_make,vehicle_model,engine_code"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Support page order lookup failed:", error.message);
  }

  return (
    <main className="wrap">
      <nav className="nav">
        <Link className="brand" href="/">
          JCS <span>PORTAL</span>
        </Link>

        <div className="row">
          <Link className="btn secondary" href="/dashboard">
            Dashboard
          </Link>

          <span className="pill">{user.email}</span>

          <form action="/auth/signout" method="post">
            <button className="btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">JCS CUSTOMER CARE</div>
        <h1 style={{ fontSize: 54 }}>
          Support <em>centre.</em>
        </h1>
        <p>
          Need help with a tuning file, order, diagnostic issue or payment?
          Open a support ticket and keep your request in one place.
        </p>
      </section>

      <SupportCentre orders={orders ?? []} />

      <footer>JCS Automotive Tuning · Customer Support</footer>
    </main>
  );
}
