import {NextRequest,NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
import type {EmailOtpType} from "@supabase/supabase-js";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const token_hash=request.nextUrl.searchParams.get("token_hash");
 const code=request.nextUrl.searchParams.get("code");
 const type=request.nextUrl.searchParams.get("type");
 const url=new URL("/reset-password",request.url);
 if((!token_hash&&!code)||(token_hash&&(type!=="recovery"||token_hash.length>2048))){
  url.searchParams.set("error","invalid_link");
  return NextResponse.redirect(url,{status:303});
 }
 const response=NextResponse.redirect(url,{status:303});
 response.headers.set("Cache-Control","no-store");
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  cookies:{
   getAll(){return request.cookies.getAll();},
   setAll(cookiesToSet){for(const cookie of cookiesToSet){request.cookies.set(cookie.name,cookie.value);response.cookies.set(cookie.name,cookie.value,cookie.options);}}
  }
 });
 const {error}=token_hash
  ? await supabase.auth.verifyOtp({token_hash,type:"recovery" as EmailOtpType})
  : await supabase.auth.exchangeCodeForSession(code!);
 if(error){console.error("Recovery token verification rejected:",error.code||"invalid_or_expired");url.searchParams.set("error","invalid_link");return NextResponse.redirect(url,{status:303});}
 return response;
}
