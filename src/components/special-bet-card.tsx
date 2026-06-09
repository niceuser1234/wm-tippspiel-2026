"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { SpecialBet } from "@/types/database";

const FREE_TEXT_SENTINEL = "__freitext__";

interface Props {
  bet: SpecialBet;
  existingAnswer: string | null;
}

function formatDeadline(lockAt: string): string {
  const d = new Date(lockAt);
  return (
    "bis " +
    d.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    }).replace(", ", " · ") + " Uhr"
  );
}

function parseTwoTeams(answer: string | null): [string, string] {
  if (!answer) return ["", ""];
  try {
    const arr = JSON.parse(answer);
    if (Array.isArray(arr) && arr.length === 2) return [arr[0], arr[1]];
  } catch {
    // ignore malformed
  }
  return ["", ""];
}

export function SpecialBetCard({ bet, existingAnswer }: Props) {
  const initialFreeText =
    bet.bet_type === "text" &&
    existingAnswer !== null &&
    (bet.options ?? []).includes(existingAnswer) === false
      ? existingAnswer
      : "";

  const initialSelectValue =
    bet.bet_type === "text" &&
    existingAnswer !== null &&
    (bet.options ?? []).includes(existingAnswer) === false
      ? FREE_TEXT_SENTINEL
      : (existingAnswer ?? "");

  const [twoTeams, setTwoTeams] = useState<[string, string]>(
    bet.bet_type === "two_teams" ? parseTwoTeams(existingAnswer) : ["", ""]
  );
  const [selectValue, setSelectValue] = useState(
    bet.bet_type === "two_teams" ? "" : initialSelectValue
  );
  const [freeText, setFreeText] = useState(initialFreeText);
  const [numberValue, setNumberValue] = useState(
    bet.bet_type === "number" && existingAnswer !== null ? existingAnswer : ""
  );
  const [saving, setSaving] = useState(false);

  function buildAnswer(): string | null {
    switch (bet.bet_type) {
      case "team":
      case "round":
        return selectValue || null;
      case "text": {
        if (selectValue === FREE_TEXT_SENTINEL) {
          return freeText.trim() || null;
        }
        return selectValue || null;
      }
      case "number":
        return numberValue !== "" ? numberValue : null;
      case "two_teams": {
        const [a, b] = twoTeams;
        if (!a || !b) return null;
        return JSON.stringify([a, b].sort());
      }
    }
  }

  async function handleSave() {
    const answer = buildAnswer();
    if (!answer) {
      toast.warning("Bitte erst eine Antwort eingeben");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("special_bet_tips").upsert(
      {
        user_id: user.id,
        special_bet_id: bet.id,
        answer,
      },
      { onConflict: "user_id,special_bet_id" }
    );

    setSaving(false);

    if (error) {
      if (
        error.code === "42501" ||
        error.code === "PGRST301" ||
        error.message?.includes("row-level security")
      ) {
        toast.error("❌ Wette ist bereits gesperrt");
      } else {
        toast.error("❌ Fehler beim Speichern");
      }
    } else {
      toast.success("✅ Tipp gespeichert");
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug">{bet.title}</h3>
          <Badge
            className="shrink-0 bg-amber-100 text-amber-700 border-amber-200"
            variant="outline"
          >
            {bet.points_value} Pkt.
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDeadline(bet.lock_at)}
        </p>

        {(bet.bet_type === "team" || bet.bet_type === "round") && (
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Auswählen…" />
            </SelectTrigger>
            <SelectContent>
              {(bet.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {bet.bet_type === "number" && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Deine Schätzung</Label>
            <Input
              type="number"
              min={0}
              max={999}
              value={numberValue}
              onChange={(e) => setNumberValue(e.target.value)}
              placeholder="z.B. 142"
              className="w-full"
            />
          </div>
        )}

        {bet.bet_type === "text" && (
          <div className="flex flex-col gap-2">
            <Select value={selectValue} onValueChange={setSelectValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {(bet.options ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
                <SelectItem value={FREE_TEXT_SENTINEL}>
                  Anderer Spieler…
                </SelectItem>
              </SelectContent>
            </Select>
            {selectValue === FREE_TEXT_SENTINEL && (
              <Input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Spielername eingeben"
              />
            )}
          </div>
        )}

        {bet.bet_type === "two_teams" && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Team 1</Label>
            <Select
              value={twoTeams[0]}
              onValueChange={(v) => setTwoTeams([v, twoTeams[1]])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {(bet.options ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs">Team 2</Label>
            <Select
              value={twoTeams[1]}
              onValueChange={(v) => setTwoTeams([twoTeams[0], v])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {(bet.options ?? []).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#15803d] hover:bg-[#166534] text-white"
        >
          {saving ? "Speichern…" : "Tipp speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
