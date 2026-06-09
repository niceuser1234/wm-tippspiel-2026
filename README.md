# ⚽ WM 2026 Tippspiel

Privates Tippspiel für Familie und Freunde zur FIFA Weltmeisterschaft 2026 (11. Juni – 19. Juli, USA/Kanada/Mexiko). Punkte-basiert, kein echtes Wetten. Symbolischer Topf – wer die meisten Punkte sammelt, gewinnt.

> **Stack:** Next.js · TypeScript · Tailwind CSS · Supabase (Auth + RLS) · Vercel

---

## Inhalt

- [Spielprinzip](#spielprinzip)
- [Punktesystem](#punktesystem)
- [Spielauswahl](#spielauswahl)
- [Sonderwetten](#sonderwetten)
- [Geldverteilung](#geldverteilung)
- [Datenmodell](#datenmodell)
- [RLS-Logik (Verdeckte Wetten)](#rls-logik-verdeckte-wetten)
- [UI-Struktur](#ui-struktur)
- [Ergebniseingabe](#ergebniseingabe)
- [MVP-Scope](#mvp-scope)

---

## Spielprinzip

- Jeder zahlt **20 € in den Topf** (manuell / Überweisung, nur ein `paid`-Häkchen in der App).
- Tipps für ausgewählte Spiele + einmalige Sonderwetten vor Turnierbeginn.
- **Verdeckte Wetten:** Tipps anderer Teilnehmer sind bis zur Deadline versteckt (nach Anpfiff sichtbar) – Reveal-Mechanik per Supabase RLS, kein Extra-Code.
- Ergebnisse werden manuell im Supabase Dashboard eingetragen.
- Teilnehmerzahl: ~10–20 Personen.

---

## Punktesystem

### Spieltipps (pro Spiel)

| Treffer | Punkte |
|---|---|
| Exaktes Ergebnis (z.B. 2:1 getippt, 2:1 real) | 4 |
| Richtige Tordifferenz (3:1 getippt, 2:0 real) | 3 |
| Richtige Tendenz (Sieger oder Remis korrekt) | 2 |
| Daneben | 0 |

> **Vereinfachung möglich:** Mittelstufe weglassen → nur Exakt 4 / Tendenz 1. Empfohlen bleibt die 3-Stufen-Variante, da sie Fußballwissen belohnt ohne Implementierungsaufwand zu erhöhen (eine if/else-Kaskade).

### Sonderwetten (Gewichtsklassen)

| Klasse | Punkte | Wann löst es auf? |
|---|---|---|
| Anker (spät) | 12–15 | Turnierende / Finale |
| Standard | 6–8 | Letzte K.o.-Runden |
| Leicht / Spaß | 5 | Gruppenphase / Turnierende |

**Warum dieses Gewicht?** Bei ~27 getippten Spielen liegt das realistisch erreichbare Spieltipp-Konto bei ca. 35–50 Punkten. Die Sonderwetten summieren sich auf ~59 Punkte – vergleichbar, aber **43 dieser 59 Punkte lösen erst im letzten Turnierdrittel auf** (Turniersieger 15 + Torschützenkönig 12 + Gesamttore 8 + Finalisten 8). Wer in der Gruppenphase abgehängt ist, kann durch einen richtigen Turniersieger-Tipp (≈ 4 perfekte Spieltipps) am Finaltag noch alles drehen.

---

## Spielauswahl

Das Turnier umfasst 104 Spiele (72 Gruppenphase, 32 K.o.). Alle zu tippen wäre ein Engagement-Killer. Empfohlen: **~27 kuratierte Spiele.**

### Gruppenphase (~12 Spiele)

- Alle **3 Deutschland-Spiele** (Gruppe E: Deutschland vs. Curaçao, Elfenbeinküste, Ecuador)
- ~9 handverlesene **Topspiele** der Gruppenphase (Partien der Titelkandidaten: Argentinien, Frankreich, Spanien, England, Brasilien + knackige Duelle)

### K.o.-Phase (~15 Spiele)

Ab **Achtelfinale** alle Spiele:

| Runde | Spiele | Zeitraum |
|---|---|---|
| Achtelfinale | 8 | 4.–7. Juli |
| Viertelfinale | 4 | 9.–12. Juli |
| Halbfinale | 2 | 14./15. Juli |
| Finale | 1 | 19. Juli |
| Spiel um Platz 3 | optional | 18. Juli |

> **Sechzehntelfinale (28.6.–4.7., 16 Spiele) weglassen** – häufig Mismatches, zu viele Spiele für einen Freundeskreis-Tipp.

### Praktische Umsetzung der K.o.-Spiele

K.o.-Paarungen stehen erst nach der Gruppenphase fest. Vorgehen: Match-Zeilen im Supabase Dashboard anlegen, sobald die Paarungen feststehen (ab ~28. Juni). Keine Speziallogik nötig – Deadline = Anpfiff, alles andere übernimmt RLS.

---

## Sonderwetten

7 Wetten, zu Turnierbeginn abgegeben und gesperrt. Auflösung über das gesamte Turnier verteilt.

| # | Wette | Punkte | Löst auf | Typ |
|---|---|---|---|---|
| 1 | **Turniersieger** | 15 | Finale (19.7.) | Team auswählen |
| 2 | **Torschützenkönig** | 12 | Turnierende | Spieler (Freitext/Liste) |
| 3 | **Gesamtanzahl Tore im Turnier** (nächste Schätzung gewinnt) | 8 | Turnierende | Zahl |
| 4 | **Beide Finalisten** (je 4 Pkt. pro richtigem Team) | 8 | nach Halbfinale | 2 Teams |
| 5 | **Deutschland – Aus in welcher Runde?** (oder Titel) | 6 | wenn DE ausscheidet | Runde auswählen |
| 6 | **Welches Team kassiert die meisten Roten Karten?** | 5 | Turnierende | Team |
| 7 | **Gruppensieger Gruppe E** (Deutschlands Gruppe) | 5 | nach Gruppenphase (27.6.) | Team |

**Gesamt: 59 Punkte aus Sonderwetten.**

### Bewusst ausgeschlossen

- *„Wer gewinnt, wenn nicht Deutschland?"* → praktisch identisch mit Turniersieger, hat einen hässlichen Sonderfall (DE gewinnt). Redundant.
- *„Erste große Überraschungs-Niederlage"* / *„Erste Schlagzeile"* → **nicht objektiv auswertbar** (wann ist eine Niederlage eine Überraschung? welche Schlagzeile zählt?). Führt zu WhatsApp-Streit. Objektive Alternative falls gewünscht: *„Welches der Top-6-Favoriten scheidet als erstes aus?"*

**Faustregel:** Wenn das Ergebnis nicht eindeutig aus dem offiziellen FIFA-Spielbericht ablesbar ist → raus.

### Optionale Blind Bet

Eine permanent verdeckte Sonderwette, die erst am Turnierende (19. Juli) aufgedeckt wird. Technisch: normales `special_bet`-Row mit `is_blind = true`. RLS übernimmt das Verstecken automatisch (siehe unten). Nur einbauen, wenn Zeit da ist.

---

## Geldverteilung

Empfohlen: **Top 3, aufgeteilt 60 / 30 / 10 %**

| Platz | Anteil (Beispiel 200 €) |
|---|---|
| 1. Platz | 60 % = 120 € |
| 2. Platz | 30 % = 60 € |
| 3. Platz | 10 % = 20 € |

Begründung: Hält das Mittelfeld bis zum Schluss motiviert. Winner-takes-all ist alternativ möglich, wenn die Gruppe maximale Stakes bevorzugt. Optional: Gag-Booby-Prize für die rote Laterne (Schnapsflasche o.Ä.).

---

## Datenmodell

### Tabellen

```sql
-- Nutzerprofile (extends auth.users)
profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users,
  display_name text NOT NULL,
  paid        boolean DEFAULT false,   -- Topf-Häkchen, manuell setzen
  is_admin    boolean DEFAULT false
)

-- Spiele (Gruppen + K.o.)
matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage       text NOT NULL,           -- 'group' | 'r16' | 'qf' | 'sf' | 'final'
  home_team   text NOT NULL,
  away_team   text NOT NULL,
  kickoff_at  timestamptz NOT NULL,    -- = Tipp-Deadline
  home_score  int,                     -- null bis Ergebnis eingetragen
  away_score  int
)

-- Spieltipps
match_tips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles,
  match_id    uuid NOT NULL REFERENCES matches,
  home_tip    int NOT NULL,
  away_tip    int NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, match_id)
)

-- Sonderwetten (Definition)
special_bets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  bet_type     text NOT NULL,          -- 'team' | 'number' | 'text' | 'two_teams' | 'round'
  options      jsonb,                  -- Auswahloptionen (Teams, Runden etc.), null bei Freitext
  points_value int NOT NULL,
  lock_at      timestamptz NOT NULL,   -- Tipps gesperrt ab hier (= Turnierbeginn 11.6.)
  correct_answer text,                 -- null bis Admin einträgt
  is_blind     boolean DEFAULT false   -- true = bis 19.7. verdeckt
)

-- Sonderwetten-Tipps
special_bet_tips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles,
  special_bet_id  uuid NOT NULL REFERENCES special_bets,
  answer          text NOT NULL,       -- jsonb-String für two_teams
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, special_bet_id)
)
```

### Rangliste als SQL-View (kein gespeicherter Punktestand)

Punkte werden **nicht** in einer Spalte gespeichert, sondern live aus Ergebnissen + Tipps berechnet. Ergebnis im Dashboard korrigieren → Rangliste stimmt sofort. Trigger-Logik entfällt komplett.

```sql
CREATE VIEW leaderboard AS
SELECT
  p.id,
  p.display_name,
  COALESCE(game_pts.total, 0) + COALESCE(special_pts.total, 0) AS total_points
FROM profiles p
LEFT JOIN (
  -- Spieltipp-Punkte
  SELECT mt.user_id,
    SUM(
      CASE
        WHEN mt.home_tip = m.home_score AND mt.away_tip = m.away_score THEN 4
        WHEN (mt.home_tip - mt.away_tip) = (m.home_score - m.away_score) THEN 3
        WHEN SIGN(mt.home_tip - mt.away_tip) = SIGN(m.home_score - m.away_score) THEN 2
        ELSE 0
      END
    ) AS total
  FROM match_tips mt
  JOIN matches m ON m.id = mt.match_id
  WHERE m.home_score IS NOT NULL
  GROUP BY mt.user_id
) game_pts ON game_pts.user_id = p.id
LEFT JOIN (
  -- Sonderwetten-Punkte
  SELECT sbt.user_id,
    SUM(CASE WHEN sbt.answer = sb.correct_answer THEN sb.points_value ELSE 0 END) AS total
  FROM special_bet_tips sbt
  JOIN special_bets sb ON sb.id = sbt.special_bet_id
  WHERE sb.correct_answer IS NOT NULL
  GROUP BY sbt.user_id
) special_pts ON special_pts.user_id = p.id
ORDER BY total_points DESC;
```

> Für Wette #3 (Gesamttore-Schätzung, nächste Zahl gewinnt) und Wette #4 (Finalisten, 2×4 Pkt.) ist in der `leaderboard`-View ein kleiner Sonderfall nötig – kann beim Implementieren direkt angepasst werden.

---

## RLS-Logik (Verdeckte Wetten)

Die Verdeckung wird auf **Datenbankebene** erzwungen – niemand kann fremde Tipps vor der Deadline über die API sehen, egal was im Browser passiert.

```sql
-- match_tips: SELECT
-- Eigene Tipps immer sichtbar; fremde erst nach Anpfiff
CREATE POLICY "reveal after kickoff" ON match_tips FOR SELECT
USING (
  user_id = auth.uid()
  OR now() >= (SELECT kickoff_at FROM matches WHERE id = match_id)
);

-- match_tips: INSERT / UPDATE
-- Nur eigene, nur vor Anpfiff
CREATE POLICY "tip before kickoff" ON match_tips FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND now() < (SELECT kickoff_at FROM matches WHERE id = match_id)
);

-- special_bet_tips: SELECT
-- Eigene immer; normale Wetten nach lock_at; Blind Bets erst ab Turnierende
CREATE POLICY "reveal special bets" ON special_bet_tips FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    (SELECT is_blind FROM special_bets WHERE id = special_bet_id) = false
    AND now() >= (SELECT lock_at FROM special_bets WHERE id = special_bet_id)
  )
  OR (
    (SELECT is_blind FROM special_bets WHERE id = special_bet_id) = true
    AND now() >= '2026-07-19 21:00:00+00'
  )
);

-- special_bet_tips: INSERT / UPDATE
-- Nur eigene, nur vor lock_at
CREATE POLICY "tip before lock" ON special_bet_tips FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND now() < (SELECT lock_at FROM special_bets WHERE id = special_bet_id)
);

-- matches / special_bets: alle lesen, nur Admin schreiben
CREATE POLICY "public read" ON matches FOR SELECT USING (true);
CREATE POLICY "admin write" ON matches FOR ALL
USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
```

---

## UI-Struktur

Vier Views, eine App. Kein Admin-Frontend – Ergebnisse und Konfiguration laufen über das Supabase Dashboard.

| Route | Inhalt |
|---|---|
| `/` (Login) | Magic-Link Auth via Supabase UI. Ersten Login → `display_name` setzen. |
| `/tippen` | Offene Spiele (vor Anpfiff) tippen + Sonderwetten ausfüllen. Kern der App. |
| `/uebersicht` | Alle Spiele. Bei abgelaufenen: Tipps aller Teilnehmer + Ergebnis + Punkte (Reveal). |
| `/rangliste` | `leaderboard`-View, absteigend. Das, was alle ständig neu laden. |

---

## Ergebniseingabe

**Empfehlung: manuell über Supabase Table Editor.** Keine API-Anbindung.

Gründe:
- football-data.org Free Tier deckt dauerhaft die großen europäischen Ligen ab – WM-Live-Coverage auf dem Free Tier ist unzuverlässig.
- API-Integration bedeutet: Auth, Polling/Cron, Mapping von externen IDs auf eigene Fixtures, Rate-Limit-Handling, Fehlerbehandlung bei nachträglichen Korrekturen. Zu viel Risiko für ein MVP.
- Manuell: nach jedem Spiel zwei Zahlen eintragen (~30 Sekunden), die View rechnet die Rangliste neu. Für 10–20 Personen und ~27 Spiele über 5 Wochen ist das trivial und bulletproof.

API-Anbindung = v2-Feature, falls das Tippspiel wiederholt wird.

---

## MVP-Scope

### Muss zum 11. Juni laufen

- [ ] Magic-Link-Login + `display_name`
- [ ] Spiele geseedet (mindestens erste Gruppenspiele + kuratierte Auswahl)
- [ ] Tippen für offene Spiele, Sperre bei Anpfiff (RLS)
- [ ] Sonderwetten anlegen + tippbar, Lock zu Turnierbeginn (11.6.)
- [ ] Reveal nach Deadline (RLS SELECT)
- [ ] Rangliste-View (`leaderboard`)
- [ ] Ergebniseingabe über Supabase Dashboard

> Reveal, RLS und Scoring-View müssen Tag 1 sitzen, da die ersten Spiele und der Sonderwetten-Lock direkt am 11. Juni stattfinden.

### Bewusst weggefallen (kein Over-Engineering)

| Feature | Warum weg |
|---|---|
| Admin-UI | Supabase Dashboard reicht vollständig |
| K.o.-Spiele zum Start | Paarungen stehen erst ab 28.6. fest – dann nachlegen |
| Blind Bet | Optional, `is_blind`-Flag bei Zeit nachbauen |
| Reminder-Mails | WhatsApp-Gruppe übernimmt das |
| Payment-Integration | Topf analog (Bar/Überweisung), `paid`-Häkchen genügt |
| API-Ergebnisimport | Manuell schneller und zuverlässiger (s.o.) |
| Charts, Avatare, Verlauf-Graphen | v2 |
| Push, PWA, Dark Mode | v2 |

---

## WM-Format auf einen Blick

| | Wert |
|---|---|
| Teams | 48 (12 Gruppen à 4) |
| Gesamtspiele | 104 |
| Gruppenphase | 72 Spiele, 11.–27. Juni |
| Sechzehntelfinale | 16 Spiele, 28. Juni – 4. Juli |
| Achtelfinale | 8 Spiele, 4.–7. Juli |
| Viertelfinale | 4 Spiele, 9.–12. Juli |
| Halbfinale | 2 Spiele, 14./15. Juli |
| Finale | 19. Juli, New York |
| Deutschland (Gruppe E) | vs. Curaçao, Elfenbeinküste, Ecuador |

---

*Privates Spaßprojekt – kein kommerzielles Produkt, kein echtes Quotenwetten.*
