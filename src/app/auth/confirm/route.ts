import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const code = searchParams.get("code");

  // Alle URL-Parameter für Debugging erfassen
  const allParams = Object.fromEntries(searchParams.entries());

  // PKCE-Flow: exchangeCodeForSession wenn 'code' vorhanden
  if (code) {
    const response = NextResponse.redirect(new URL("/tippen", origin));
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    return NextResponse.redirect(new URL(`/?error=auth&detail=code_exchange_failed`, origin));
  }

  // OTP-Flow: verifyOtp mit token_hash
  if (token_hash) {
    const response = NextResponse.redirect(new URL("/tippen", origin));
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      }
    );
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return response;
    // Fehlerdetail in URL für Debugging
    return NextResponse.redirect(
      new URL(`/?error=auth&detail=${encodeURIComponent(error.message)}&code=${error.status}`, origin)
    );
  }

  // Kein Token — alle Parameter loggen
  return NextResponse.redirect(
    new URL(`/?error=auth&detail=no_token&params=${encodeURIComponent(JSON.stringify(allParams))}`, origin)
  );
}
