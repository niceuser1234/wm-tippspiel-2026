"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { TeamLabel } from "@/components/team-label";
import type { Match, MatchTip } from "@/types/database";

interface Props {
  match: Match;
  existingTip: MatchTip | null;
  onSaved?: (matchId: string) => void;
}

function formatKickoff(kickoffAt: string): string {
  const d = new Date(kickoffAt);
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).replace(",", "").replace(", ", " · ") + " Uhr";
}

function Countdown({ kickoffAt }: { kickoffAt: string }) {
  const diff = new Date(kickoffAt).getTime() - Date.now();
  if (diff <= 0 || diff > 3 * 60 * 60 * 1000) return null;
  const totalMins = Math.floor(diff / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <span className="text-xs font-medium text-amber-600">
      ⏰ schließt in {label}
    </span>
  );
}

function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="text-xl font-bold rounded-full"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`${label} verringern`}
        >
          −
        </Button>
        <span className="w-8 text-center text-2xl font-black tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="text-xl font-bold rounded-full"
          onClick={() => onChange(Math.min(20, value + 1))}
          aria-label={`${label} erhöhen`}
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function MatchTipCard({ match, existingTip, onSaved }: Props) {
  const [homeTip, setHomeTip] = useState(existingTip?.home_tip ?? 0);
  const [awayTip, setAwayTip] = useState(existingTip?.away_tip ?? 0);
  const [saving, setSaving] = useState(false);

  // Gespeicherter Tipp + Bearbeitungsmodus steuern die Ansicht.
  const [saved, setSaved] = useState<{ home: number; away: number } | null>(
    existingTip ? { home: existingTip.home_tip, away: existingTip.away_tip } : null
  );
  const [editing, setEditing] = useState(false);

  const showForm = saved === null || editing;

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("match_tips").upsert(
      {
        user_id: user.id,
        match_id: match.id,
        home_tip: homeTip,
        away_tip: awayTip,
      },
      { onConflict: "user_id,match_id" }
    );

    setSaving(false);

    if (error) {
      if (
        error.code === "42501" ||
        error.code === "PGRST301" ||
        error.message?.includes("row-level security")
      ) {
        toast.error("❌ Spiel bereits gestartet");
      } else {
        toast.error("❌ Fehler beim Speichern");
      }
      return;
    }

    setSaved({ home: homeTip, away: awayTip });
    setEditing(false);
    onSaved?.(match.id);
    toast.success("✅ Tipp gespeichert");
  }

  function handleCancel() {
    if (saved) {
      setHomeTip(saved.home);
      setAwayTip(saved.away);
    }
    setEditing(false);
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatKickoff(match.kickoff_at)}
          </span>
          <Countdown kickoffAt={match.kickoff_at} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex justify-end">
            <TeamLabel
              team={match.home_team}
              className="text-sm font-semibold leading-tight"
            />
          </div>
          <span className="text-muted-foreground font-bold">:</span>
          <div className="flex justify-start">
            <TeamLabel
              team={match.away_team}
              className="text-sm font-semibold leading-tight"
            />
          </div>
        </div>

        {showForm ? (
          <>
            <div className="flex justify-around items-center pt-1">
              <Stepper value={homeTip} onChange={setHomeTip} label="Heim" />
              <div className="text-2xl font-black text-muted-foreground">–</div>
              <Stepper value={awayTip} onChange={setAwayTip} label="Gast" />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#15803d] hover:bg-[#166534] text-white"
            >
              {saving
                ? "Speichern…"
                : saved
                ? "Änderung speichern"
                : "Tipp speichern"}
            </Button>

            {saved && !saving && (
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-muted-foreground underline underline-offset-4 mx-auto"
              >
                Abbrechen
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-center gap-2.5 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
              <span className="text-base leading-none">✅</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600">
                Dein Tipp
              </span>
              <span className="text-xl font-black tabular-nums text-night">
                {saved!.home} : {saved!.away}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
              className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Tipp ändern
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
