import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminArea } from "@/app/admin/_components/AdminArea";
import DtcLookup from "@/components/DtcLookup";
export const dynamic = "force-dynamic";
export default async function Page(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect("/login");const {data:p}=await s.from("profiles").select("role").eq("id",user.id).maybeSingle();if(p?.role!=="admin")redirect("/dashboard");return <AdminArea active="dtc" title="DTC Lookup" description="Generic OBD-II and selected VAG diagnostic fault codes"><DtcLookup/></AdminArea>}
