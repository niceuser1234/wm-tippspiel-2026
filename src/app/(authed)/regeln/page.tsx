import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SpecialBet } from "@/types/database";

export const metadata: Metadata = {
  title: "Regeln | WM 2026 Tippspiel",
};

const GROUP_PREFIX = "Gruppensieger Gruppe ";

function betRuleNote(bet: SpecialBet): string | null {
  if (bet.bet_type === "number") return "Nächste Schätzung gewinnt (bei Gleichstand alle)";
  if (bet.bet_type === "two_teams") return "Pro richtigem Team die Hälfte der Punkte";
  return null;
}

export default async function RegelnPage() {
  const supabase = await createClient();

  const { data: betsRaw } = await supabase
    .from("special_bets")
    .select("*")
    .order("points_value", { ascending: false });

  const bets: SpecialBet[] = betsRaw ?? [];
  const mainBets = bets.filter((b) => !b.title.startsWith(GROUP_PREFIX));
  const groupBets = bets.filter((b) => b.title.startsWith(GROUP_PREFIX));
  const groupPoints = groupBets[0]?.points_value ?? 3;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="display-heading text-2xl text-night">📖 Regeln</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Wie Punkte vergeben werden — und wer gewinnt.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* ---- Spieltipps ---- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h2 className="text-base font-bold text-night mb-1">⚽ Spieltipps</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tippe das Ergebnis. Pro Spiel gibt es:
          </p>

          <div className="flex flex-col gap-2.5">
            <RuleRow points="7" color="gold" title="Exaktes Ergebnis" desc="Du hast die genaue Tor­anzahl beider Teams richtig." />
            <RuleRow points="5" color="green" title="Am nächsten dran" desc="Nur bei richtiger Tendenz: unter den Tipps mit richtigem Sieger/Unentschieden der mit der kleinsten Abweichung. Bei Gleichstand bekommen alle die 5." />
            <RuleRow points="3" color="lightgreen" title="Richtige Tendenz" desc="Sieger bzw. Unentschieden richtig getippt, aber nicht exakt und nicht am nächsten dran." />
            <RuleRow points="0" color="gray" title="Daneben" desc="Falsche Tendenz — auch wenn das Ergebnis rechnerisch nah dran war." />
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            ⏱ Abgabe bis zum Anpfiff des jeweiligen Spiels. Bis dahin sind die
            Tipps der anderen verdeckt.
          </p>
        </section>

        {/* ---- Sonderwetten ---- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h2 className="text-base font-bold text-night mb-1">🎯 Sonderwetten</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Einmalige Tipps aufs ganze Turnier. Punkte gibt es nur bei richtigem
            Tipp:
          </p>

          <div className="flex flex-col divide-y divide-slate-100">
            {mainBets.map((bet) => {
              const note = betRuleNote(bet);
              return (
                <div key={bet.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-night">{bet.title}</p>
                    {note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 whitespace-nowrap">
                    {bet.points_value} Pkt
                  </span>
                </div>
              );
            })}

            {groupBets.length > 0 && (
              <div className="flex items-start justify-between gap-3 py-2.5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-night">
                    Gruppensieger ({groupBets.length} Gruppen, A–L)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pro Gruppe einzeln tippbar
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 whitespace-nowrap">
                  je {groupPoints} Pkt
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            🔒 Tipps der anderen sind bis zur jeweiligen Abgabe-Deadline verdeckt.
            Danach werden alle aufgedeckt.
          </p>
        </section>

        {/* ---- Gewinner ---- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h2 className="text-base font-bold text-night mb-3">🏆 Wer gewinnt</h2>
          <ol className="flex flex-col gap-2.5 text-sm text-night list-decimal list-inside">
            <li>
              <span className="font-medium">Meiste Gesamtpunkte</span> aus
              Spieltipps + Sonderwetten gewinnt.
            </li>
            <li>
              Bei <span className="font-medium">Gleichstand</span> zählt, wer mehr
              exakte Ergebnis-Tipps (7-Punkte-Tipps) hat.
            </li>
            <li>
              Bleibt es gleich, wird der <span className="font-medium">Topf geteilt</span>.
            </li>
          </ol>
        </section>

        <p className="text-center text-xs text-muted-foreground pb-2">
          Viel Glück — Tippspiel Haberstroh &amp; Friends ⚽
        </p>
      </div>
    </div>
  );
}

function RuleRow({
  points,
  color,
  title,
  desc,
}: {
  points: string;
  color: "gold" | "green" | "lightgreen" | "gray";
  title: string;
  desc: string;
}) {
  const badge = {
    gold: "bg-[var(--gold-soft)] text-[var(--gold-deep)] border-[#fcd34d]",
    green: "bg-[#dcfce7] text-[#166534] border-[#86efac]",
    lightgreen: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
    gray: "bg-slate-50 text-slate-400 border-slate-200",
  }[color];

  return (
    <div className="flex items-start gap-3">
      <span
        className={`shrink-0 w-9 text-center text-sm font-black rounded-lg border py-1 ${badge}`}
      >
        {points}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-night">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
