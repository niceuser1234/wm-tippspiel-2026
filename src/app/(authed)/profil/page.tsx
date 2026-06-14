import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/profile-view";

export const metadata: Metadata = { title: "Profil | WM 2026 Tippspiel" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <ProfileView targetId={user.id} viewerId={user.id} />;
}
