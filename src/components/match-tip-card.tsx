"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { teamLabel } from "@/lib/teams";
import type { Match, MatchTip } from "@/types/database";

interface Props {
  match: Match;
  existingTip: MatchTip | null;
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

export function MatchTipCard({ match, existingTip }: Props) {
  const [homeTip, setHomeTip] = useState(existingTip?.home_tip ?? 0);
  const [awayTip, setAwayTip] = useState(existingTip?.away_tip ?? 0);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (home: number, away: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from("match_tips").upsert(
          {
            user_id: user.id,
            match_id: match.id,
            home_tip: home,
            away_tip: away,
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
        } else {
          toast.success("✅ Tipp gespeichert");
        }
      }, 500);
    },
    [match.id]
  );

  function handleHome(v: number) {
    setHomeTip(v);
    save(v, awayTip);
  }

  function handleAway(v: number) {
    setAwayTip(v);
    save(homeTip, v);
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
          <span className="text-sm font-semibold text-right leading-tight">
            {teamLabel(match.home_team)}
          </span>
          <span className="text-muted-foreground font-bold">:</span>
          <span className="text-sm font-semibold leading-tight">
            {teamLabel(match.away_team)}
          </span>
        </div>

        <div className="flex justify-around items-center pt-1">
          <Stepper value={homeTip} onChange={handleHome} label="Heim" />
          <div className="text-2xl font-black text-muted-foreground">–</div>
          <Stepper value={awayTip} onChange={handleAway} label="Gast" />
        </div>

        {saving && (
          <p className="text-xs text-center text-muted-foreground animate-pulse">
            Speichern…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
