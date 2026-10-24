import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DtcLookup from "@/components/DtcLookup";
export const dynamic = "force-dynamic";
export default async function Page(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect("/login");return <main className="min-h-screen bg-[#090d14] p-6 text-white"><div className="mx-auto max-w-5xl"><Link className="text-sky-300" href="/dashboard">← Dashboard</Link><h1 className="my-6 text-3xl font-black">JCS DTC Lookup</h1><DtcLookup/></div></main>}
