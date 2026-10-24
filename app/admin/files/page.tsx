import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FilesManager from "./FilesManager";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") redirect("/dashboard");
  return <FilesManager />;
}
