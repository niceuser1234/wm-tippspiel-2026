# K.-o.-Paarungen automatisch ziehen + Neuigkeits-Banner

**Datum:** 2026-06-29
**Status:** Approved (Design)
**Autor:** Jonathan + AIOS

## Problem

Die Gruppenphase ist durch, die K.-o.-Runde beginnt (heute z.B. Deutschland-Paraguay,
22:30 MESZ). Aktuell sind nur 12 kuratierte Gruppenspiele in der DB. Für jede K.-o.-Runde
muss bisher jede Paarung von Hand eingetragen werden, sonst kann niemand tippen. Das ist
manuelle Arbeit pro Runde (R32, R16, Viertel, Halb, Finale) und fehleranfällig.

## Ziel

1. **Sofort:** Die bereits feststehenden K.-o.-Spiele (16x R32) sind heute vor Anpfiff
   bewettbar, inkl. Deutschland-Paraguay.
2. **Dauerhaft:** Ein automatisiertes System zieht neue K.-o.-Paarungen selbst, sobald sie
   feststehen (R32 -> R16 -> QF -> SF -> Finale). Keine Handarbeit mehr pro Runde.
3. **Sichtbarkeit:** Wer die App öffnet, sieht einen wegklickbaren Hinweis oben rechts, dass
   neue Wetten offen sind. Pro Runde genau einmal.

## Nicht-Ziele (YAGNI)

- Keine Stage-Labels im UI (Stage ist heute schon unsichtbar, reine Metadaten).
- Keine Sonderwetten für K.-o.-Runden.
- Keine Änderung an Wettlogik, Scoring, Sperre oder Reveal. Bleibt 1:1 gleich.
- Kein geräteübergreifendes Dismiss (localStorage reicht für den Freundeskreis-Pool).

## Kernidee

Die Tippen-Seite (`src/app/(authed)/tippen/page.tsx`) listet jede Zeile aus `matches` mit
`kickoff_at > now()`, ohne Stage-Filter und ohne Stage-Label. Daraus folgt:

> Eine neue K.-o.-Zeile in `matches` einfügen = sofort bewettbar, lockt bei Anpfiff,
> Reveal nach Anpfiff. Scoring, Kommentare, Reaktionen funktionieren ohne Änderung.

Das Feature reduziert sich damit auf: **K.-o.-Paarungen automatisch als `matches`-Zeilen
einfügen**, exakt gespiegelt zur bestehenden `sync-scores`-Funktion. Eine Funktion zieht
Ergebnisse (Update), die neue zieht Paarungen (Insert).

## Datenquelle

Derselbe ESPN-Feed, den `sync-scores` schon nutzt (kein API-Key):

```
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=400
```

Verifiziert am 2026-06-29: der Feed liefert pro Event ein sauberes Runden-Label in
`competitions[0].notes[0].headline` und konkrete Teamnamen, sobald die Paarung feststeht.
Heute sind alle 16 R32-Paarungen bereits konkret (z.B. `Germany` vs `Paraguay`, 20:30Z).
Spätere Runden (R16+) stehen noch auf TBD und sind im Feed noch nicht konkret.

ESPN-Label -> DB-Stage:

| ESPN `headline`   | DB `stage`    |
|-------------------|---------------|
| `round-of-32`     | `r32`         |
| `round-of-16`     | `r16`         |
| `quarterfinals`   | `qf`          |
| `semifinals`      | `sf`          |
| `3rd-place-match` | `third_place` |
| `final`           | `final`       |

Hinweis Benennung: Das 48er-Format hat eine Runde vor dem Achtelfinale. ESPN/FIFA labeln das
heutige Deutschland-Paraguay als `round-of-32`. Da Stage im UI unsichtbar ist, ist das reine
Datenhygiene. Wir nehmen die echten Labels.

## Architektur

Drei neue Backend-Teile (spiegeln `sync-scores` + dessen Cron), plus ein UI-Banner.

### 1. `supabase/functions/_shared/espn.ts` (neu)

Gemeinsamer Code, der heute in `sync-scores/index.ts` inline steckt:

- `ESPN_URL`
- `TEAM_MAP` (EN -> DE, ~80 Zeilen)
- `normalize(s)` (lowercase, Diakritika/Interpunktion strippen)
- `mapTeam(apiName)`
- `fetchEspnEvents()` -> liefert pro Event ein flaches Objekt:
  `{ round, stage, completed, homeName, awayName, homeScore, awayScore, date }`
  wobei `stage` über die obige Tabelle gemappt ist (oder `null` bei Gruppenphase/unbekannt).

`sync-scores` wird auf dieses Modul umgestellt (verhaltensgleicher Refactor). Nach dem
Refactor wird `sync-scores` **einmal manuell aufgerufen** und die Summary mit einem Lauf von
vorher verglichen, damit der Live-Scorer garantiert nicht bricht.

Begründung: vermeidet Duplikation der 80-Zeilen-Teamtabelle. Eine Quelle der Wahrheit für
Teamnamen-Mapping über beide Funktionen.

### 2. `supabase/functions/sync-fixtures/index.ts` (neu)

Eigene Edge Function (nicht `sync-scores` erweitern -> getrennte Verantwortung, Insert-Logik
bleibt vom Score-Update getrennt, kleinerer Blast-Radius für den Live-Scorer).

Ablauf:

1. ESPN-Events laden (`fetchEspnEvents()`).
2. Filter auf K.-o.-Runden: `stage in (r32, r16, qf, sf, third_place, final)`.
3. Nur Kandidaten, bei denen **beide** Teamnamen via `mapTeam()` auflösen (= konkret, kein
   TBD). Unauflösbare -> als `not_yet_concrete` / `unmapped` in der Summary, kein Insert.
4. Bestehende `matches` einmal laden, Dedup-Index per Schlüssel `stage | sortiertes
   normalisiertes Team-Paar` bauen (gleiche Idee wie `sync-scores`).
5. Pro Kandidat: existiert der Schlüssel schon -> `skipped_existing`. Sonst INSERT:
   `{ stage, home_team, away_team, kickoff_at }` (kickoff aus `date`, Orientierung = ESPN
   home/away unverändert).
6. **Nur Insert, nie Update.** Kann keine Scores oder manuellen Korrekturen überschreiben.

**Service-Role:** Schreibt mit dem auto-injizierten `SUPABASE_SERVICE_ROLE_KEY` (RLS-Bypass),
identisch zu `sync-scores`.

**Dry-Run:** `?dry=true` (oder `?dry=1`) rechnet alles, schreibt aber nichts, und gibt die
Summary zurück. Für die erste manuelle Prüfung vor dem echten Lauf.

**Summary (JSON-Antwort):**

```json
{
  "ok": true,
  "source": "espn:fifa.world",
  "dry": false,
  "knockout_events": 0,
  "inserted": [{ "stage": "r32", "home": "Deutschland", "away": "Paraguay", "kickoff_at": "..." }],
  "skipped_existing": 0,
  "not_yet_concrete": [{ "round": "round-of-16", "home": "TBD", "away": "TBD" }],
  "unmapped": [],
  "errors": []
}
```

### 3. `supabase/migrations/0012_cron_sync_fixtures.sql` (neu)

Spiegelt `0010_cron_sync_scores.sql`: pg_cron + pg_net, POST an `sync-fixtures` alle 30 Min.
Jobname `sync-wm-fixtures` (analog zu `sync-wm-scores`). Re-runnable (dropt den Job vorher).
Bearer-Token wird zur Laufzeit aus Vault gelesen.

**Reuse:** nutzt denselben Vault-Secret `sync_scores_service_role_key` wie 0010 (gleicher
Service-Role-Key). Kein neues Secret nötig.

Takt-Begründung: K.-o.-Paarungen werden nur wenige Male über ~3 Wochen gesetzt (nach jeder
Runde). 30 Min Latenz ist unkritisch (Spiele liegen ~24h auseinander) und spiegelt den
bestehenden Cron. Inserts sind idempotent über den Dedup-Check, mehrfaches Laufen schadet nicht.

### 4. UI: Neuigkeits-Banner `<KnockoutBanner />`

**Server-Teil (in `src/app/(authed)/layout.tsx`):** zusätzliche Query nach offenen
K.-o.-Matches:

```sql
select stage from matches
where kickoff_at > now()
  and stage in ('r32','r16','qf','sf','third_place','final')
```

Daraus eine **Signatur** = distinct offene K.-o.-Stages, sortiert, joined (z.B. `"r32"`).
An die Client-Komponente als Prop übergeben. Keine offenen K.-o.-Matches -> Signatur leer.

**Client-Teil (`src/components/knockout-banner.tsx`, `"use client"`):**

- Rendert serverseitig nichts (kein Hydration-Mismatch): `mounted`-State, in `useEffect`
  setzen + `localStorage` lesen.
- Liest `localStorage["ko-bets-dismissed"]`. Wenn == aktuelle Signatur -> nicht zeigen.
- Sonst: fixe Karte oben rechts (`fixed top-4 right-4 z-50`, max-width, rounded-2xl, weiß,
  shadow-sm, slate-Border, Stil wie `feature-request-button`). Text z.B. „🏆 Neu: K.-o.-Wetten
  sind offen. Jetzt tippen!", klickbar -> `/tippen`, plus X-Button.
- Signatur leer -> rendert nichts.
- X klicken: `localStorage["ko-bets-dismissed"] = signatur`, Banner weg.

**Rundenverhalten:** Dismiss speichert die aktuelle Signatur. Öffnet später eine neue Runde
(z.B. R16), ändert sich die Signatur, das Banner kommt **einmal** wieder. Pro Runde genau ein
Hinweis, nie für immer tot.

**Trade-off:** Dismiss liegt in localStorage (pro Gerät/Browser), nicht pro User über Geräte.
Für den Freundeskreis-Pool bewusst gewählt (kein DB-Overhead). Geräteübergreifend wäre ein
DB-Feld nötig, ist hier nicht das Ziel.

## Datenfluss (Ende zu Ende)

```
ESPN-Feed
  -> sync-fixtures (Filter K.-o. + konkret + Dedup)   [Cron alle 30 Min]
    -> INSERT in matches
      -> tippen-Seite (kickoff_at > now) zeigt Match  -> User tippt
        -> Anpfiff: Sperre + Reveal (bestehend)
          -> sync-scores füllt Score (bestehend)      [Cron alle 30 Min]
            -> Scoring (bestehend)

Beim App-Öffnen:
  authed-Layout berechnet Signatur offener K.-o.-Stages
    -> KnockoutBanner zeigt Hinweis (falls nicht weggeklickt für diese Signatur)
```

## Progressive Bracket-Auflösung (der elegante Teil)

R16/QF/SF/Finale stehen jetzt auf TBD und werden geskippt (`not_yet_concrete`). Sobald eine
Runde durch ist und ESPN die nächste Paarung konkret macht, fügt der nächste Cron-Lauf sie
automatisch ein. Kein manueller Eingriff, für keine Runde. Der Dedup-Check sorgt dafür, dass
jede Paarung genau einmal eingefügt wird.

## Sofort-Fix (heute, vor 20:30Z)

Kein separates Seed-Skript. Nach Deploy von `sync-fixtures`:

1. `?dry=true` aufrufen, Summary prüfen (16 R32-Paarungen, alle Namen deutsch korrekt).
2. Echt aufrufen -> 16 R32-Zeilen werden eingefügt, inkl. Deutschland-Paraguay.
3. Tippen-Seite zeigt sie sofort, bewettbar bis Anpfiff.

Der erste echte Lauf der Automatik IST der Sofort-Fix.

## Fehlerbehandlung

- **Unmapped Team:** skip + in Summary (`unmapped`). Fällt auf, falls ein Name in `TEAM_MAP`
  fehlt. (Alle 16 R32-Teams sind gegengecheckt vorhanden.)
- **ESPN down / HTTP-Fehler:** 500 + Fehler-Summary, Cron versucht nächsten Tick. Inserts sind
  unabhängig, keine halben Zustände.
- **Duplikate:** JS-Dedup gegen bestehende Zeilen per `(stage, sortiertes Paar)`. Optional
  härtbar über einen Unique-Index, hier aber konsistent zu `sync-scores` per JS gelöst.
- **Nie Update:** Insert-only, kann Scores und manuelle Korrekturen nicht anfassen.

## Verifikation / Test

1. **Shared-Refactor sicher:** `sync-scores` nach Umstellung einmal manuell aufrufen, Summary
   gegen einen Lauf von vorher vergleichen (gleiche `updated`/`skipped`-Zahlen).
2. **Dry-Run:** `sync-fixtures?dry=true` -> 16 R32-Paarungen, deutsche Namen, korrekte
   kickoff-Zeiten, leeres `unmapped`.
3. **Echter Lauf:** 16 Zeilen eingefügt, zweiter Lauf -> alle `skipped_existing`, kein Duplikat.
4. **UI:** Tippen-Seite zeigt die neuen Spiele; Banner erscheint oben rechts, lässt sich
   wegklicken, kommt nach Reload nicht wieder (gleiche Signatur).
5. **Cron:** `select jobid, jobname, schedule, active from cron.job where jobname =
   'sync-wm-fixtures';` plus ein `cron.job_run_details`-Check nach dem ersten Tick.

## Rollout-Reihenfolge

1. `_shared/espn.ts` anlegen, `sync-scores` darauf umstellen + verifizieren.
2. `sync-fixtures` bauen, deployen, Dry-Run, echter Lauf (Sofort-Fix heute).
3. `KnockoutBanner` + Layout-Query bauen, deployen.
4. Migration `0012_cron_sync_fixtures.sql` anwenden (Cron scharf schalten).

Schritte 1-2 sind zeitkritisch (vor Anpfiff heute). 3-4 können direkt danach.

## Risiken

- **Refactor bricht den Live-Scorer:** gemindert durch verhaltensgleichen Refactor + manuelle
  Verifikation vor Verlass auf den Cron.
- **ESPN ändert Feldnamen/Labels:** gleiche Abhängigkeit wie heute schon bei `sync-scores`. Die
  `not_yet_concrete`/`unmapped`-Summaries machen Abweichungen sichtbar.
- **Falsche Paarung eingefügt:** Insert-only + Dry-Run-Vorabprüfung; im Notfall manuell per SQL
  löschen, solange noch keine Tipps dranhängen.
