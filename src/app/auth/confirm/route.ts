import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  // type aus URL nutzen falls vorhanden, sonst 'email' als Fallback für magic links
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;

  if (!token_hash) {
    return NextResponse.redirect(new URL("/?error=auth", origin));
  }

  // Route Handler: Cookies auf der Response setzen, nicht nur auf dem Request.
  // createClient() aus server.ts schreibt in next/headers cookieStore,
  // der in Route Handlers zwar writable ist, aber die gesetzten Cookies
  // nicht automatisch in NextResponse.redirect() überträgt.
  // Deshalb hier manuell mit Response-Cookies arbeiten.
  const response = NextResponse.redirect(new URL("/tippen", origin));

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(new URL("/?error=auth", origin));
  }

  return response;
}
