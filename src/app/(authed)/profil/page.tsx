import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/profile-view";
import { ProfileEdit } from "@/components/profile-edit";

export const metadata: Metadata = { title: "Profil | WM 2026 Tippspiel" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).single();

  return (
    <div className="space-y-3">
      <ProfileView targetId={user.id} viewerId={user.id} />
      <div className="px-4 max-w-lg mx-auto">
        <ProfileEdit userId={user.id} initialName={profile?.display_name ?? ""} />
      </div>
    </div>
  );
}
