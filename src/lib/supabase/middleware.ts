import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Cookies auf dem Request setzen (für nachfolgende Server-Aufrufe)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Response neu erstellen, damit geänderte Cookies mitgehen
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser statt getSession — validiert den JWT serverseitig
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
