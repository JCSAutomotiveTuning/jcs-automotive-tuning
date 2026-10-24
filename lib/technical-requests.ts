import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const technicalServices = { parts: "VAG Parts Identification", wiring: "VAG Wiring Diagram Request" } as const;
export async function technicalUser() {
 const client = await createClient();
 const { data: { user } } = await client.auth.getUser();
 return user;
}
export async function technicalAdmin(userId: string) {
 const admin = createAdminClient();
 const { data, error } = await admin.from("profiles").select("role").eq("id",userId).maybeSingle();
 return !error && data?.role === "admin";
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
