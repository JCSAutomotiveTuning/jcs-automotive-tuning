import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TechnicianWorkspace from "./TechnicianWorkspace";

export const dynamic = "force-dynamic";

export default async function TechnicianPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin") redirect("/admin/staff");
  if (profile?.role !== "technician") redirect("/dashboard");
  return <TechnicianWorkspace />;
}
