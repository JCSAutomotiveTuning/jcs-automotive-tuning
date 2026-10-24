import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StaffManager from "./StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffManagementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");
  return <StaffManager />;
}
