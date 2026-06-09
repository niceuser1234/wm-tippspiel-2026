import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";

/**
 * Shared layout für alle geschützten Routen:
 * /tippen, /uebersicht, /rangliste
 *
 * Route Group (authed) — beeinflusst NICHT die URL-Pfade.
 * Wave-3-Agenten legen Pages hier ab:
 *   src/app/(authed)/tippen/page.tsx
 *   src/app/(authed)/uebersicht/page.tsx
 *   src/app/(authed)/rangliste/page.tsx
 */
export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback-Guard (Middleware sollte das bereits abfangen)
  if (!user) {
    redirect("/");
  }

  // Profil laden — display_name leer → Onboarding
  // .select("*") avoids the column-narrowing type path that can yield `never`
  // with hand-written Database types; all columns fit in 1 row anyway.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.display_name === "") {
    redirect("/willkommen");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
