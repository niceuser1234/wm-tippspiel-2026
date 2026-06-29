import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { KnockoutBanner } from "@/components/knockout-banner";

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

  if (!profile || profile.display_name === "" || !profile.avatar_url) {
    redirect("/willkommen");
  }

  // Round signature for the knockout news banner: distinct open knockout stages.
  const { data: koMatches } = await supabase
    .from("matches")
    .select("stage")
    .gt("kickoff_at", new Date().toISOString())
    .in("stage", ["r32", "r16", "qf", "sf", "third_place", "final"]);
  const koSignature = [...new Set((koMatches ?? []).map((m) => m.stage))]
    .sort()
    .join(",");

  return (
    <div className="flex flex-col min-h-screen">
      <KnockoutBanner signature={koSignature} />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
