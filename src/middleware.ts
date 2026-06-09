import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routen, die eingeloggte User erfordern
const PROTECTED_PATHS = ["/tippen", "/uebersicht", "/rangliste", "/willkommen"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Nicht eingeloggt + geschützte Route → Login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Eingeloggt + Login-Seite → Tippen
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/tippen";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Alle Pfade außer:
     * - _next/static (statische Dateien)
     * - _next/image (Bildoptimierung)
     * - favicon.ico
     * - public-Assets (svg, png, jpg, ico, webp)
     * - /auth/* (Magic-Link-Callback, darf nicht geblockt werden)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)|auth/).*)",
  ],
};
