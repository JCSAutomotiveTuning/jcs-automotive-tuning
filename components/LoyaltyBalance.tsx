import { createClient } from "@/lib/supabase/server";
export default async function LoyaltyBalance(){
 const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return null;
 const {data,error}=await s.from("jcs_loyalty_ledger").select("points").eq("user_id",user.id);
 if(error)return <section className="card"><h2>JCS Loyalty Points</h2><p>Rewards are being set up. Points will appear once the database migration is installed.</p></section>;
 const points=(data??[]).reduce((a,x)=>a+Number(x.points||0),0);
 return <section className="card" style={{marginTop:16}}><h2>JCS Loyalty Points</h2><p><strong>{points.toLocaleString("en-GB")} points</strong> earned from paid orders.</p><p>Earn 1 point for every full £1 paid on eligible orders. Redemptions are not yet available.</p></section>;
}
