# Soziales Profil-Feature — Design

**Datum:** 2026-06-14
**Status:** Genehmigt (Ansatz A)
**Kontext:** WM Tippspiel 2026 (Next.js + Supabase + Vercel). WM läuft seit 11.06., Fenster ~5 Wochen — Umfang bewusst klein gehalten.

## Ziel

Eine Spieler-Profil-Seite als "soziales Herzstück" der App: man sieht Avatar, Rang, Punkte und Tipps der anderen in groß und kann auf einzelne Tipps mit Emojis und Kommentaren reagieren (Geläster). Das eigene Profil ist nachträglich editierbar.

## Ansatz

**A — Profil als Hub, Interaktion ohne Realtime.** Reaktionen/Kommentare hängen an einzelnen Spieltipps, werden serverseitig gerendert, neue per optimistischem Client-Update + `router.refresh()`. Kein Supabase-Realtime in v1. Datenmodell so gebaut, dass Realtime und Geläster in der Übersicht später ohne Migration nachrüstbar sind.

## Scope

### In Scope
- Route `/spieler/[id]` — fremdes Profil (read-only)
- Route `/profil` — eigenes Profil + Bearbeiten + Feature-Request-Button, als 5. Bottom-Nav-Tab
- Klickbare Namen/Avatare in der Rangliste → Profil
- Reaktionen (festes Emoji-Set) + Kommentare auf Spieltipps, gated nach Anpfiff
- Eigenes Profil bearbeiten (Name + Avatar), Upload-Logik aus Onboarding wiederverwendet
- Feature-Request-Button → speichert in DB-Tabelle

### Out of Scope (YAGNI, später ohne Schema-Bruch nachrüstbar)
- Supabase Realtime
- Push/Benachrichtigung bei neuem Kommentar
- Reaktionen/Kommentare auf Sonderwetten (`special_bet_tips`)
- Head-to-Head-Duell zweier Spieler
- Admin-Moderation von Kommentaren, Admin-UI für Feature-Requests

## Routen & Navigation

| Route | Zweck | Zugang |
|---|---|---|
| `/spieler/[id]` | Fremdes Profil, read-only | Klick auf Name/Avatar in Rangliste |
| `/profil` | Eigenes Profil, Bearbeiten, Feature-Request | 5. Bottom-Nav-Tab 👤 |

- Bottom-Nav wird auf 5 Tabs erweitert: Tippen ⚽, Übersicht 📋, Rangliste 🏆, Profil 👤, Regeln 📖.
- 5 Tabs auf Mobile (375px) sind noch vertretbar. Falls zu eng: Regeln in die Profil-Seite verschieben. Entscheidung beim Bauen, wenn das Layout sichtbar ist.
- `/profil` redirectet intern auf die eigene Profil-Ansicht (gleiche Komponente wie `/spieler/[id]`), zusätzlich mit Edit-Affordances.

## Profil-Inhalt (für jeden Spieler)

- Großer Avatar (z.B. 96–128px), Name, paid-Indikator 💰
- Rang + Gesamtpunkte
- Aufschlüsselung: Spieltipps, Sonderwetten, **Volltreffer** (`exact_count`), **Trefferquote**
  - Trefferquote = Tipps mit Punkten / abgegebene Tipps zu bereits gewerteten Spielen
- Tipp-Liste: Spiel, Tipp, Ergebnis, erzielte Punkte
  - **Fremdes Profil:** nur Tipps zu Spielen mit `kickoff_at < now()` (RLS-gesichert)
  - **Eigenes Profil:** auch kommende Tipps sichtbar

### Rang-Logik (DRY-Verbesserung)
Die Gleichstand-Rang-Berechnung steckt aktuell in `leaderboard-table.tsx`. Sie wird in `src/lib/rank.ts` ausgelagert und von Rangliste **und** Profil-Seite genutzt, damit der Rang nicht doppelt (und potenziell abweichend) berechnet wird.

## Interaktion — Reaktionen + Kommentare

Hängen an einzelnen Spieltipps (`match_tips`). Sichtbar und erstellbar **erst nach Anpfiff** des zugehörigen Spiels.

- **Reaktionen:** festes Emoji-Set `😂 🔥 👀 😱 👏`. Toggle. Ein Eintrag pro (Tipp, User, Emoji). Anzeige: Counts pro Emoji + wer reagiert hat (auf Tap).
- **Kommentare:** max 200 Zeichen, mit Autor + Zeitstempel. Eigene löschbar. Kein Threading, kein Edit.
- Reaktion/Kommentar auf eigenen Tipp ist erlaubt (harmlos).
- Kein Tipp vorhanden (z.B. Spiel verpennt) → nichts zum Reagieren.

## Datenmodell

Neue Migration `supabase/migrations/0008_social.sql` (Nummer beim Bauen prüfen — höchste vorhandene ist 0007).

```sql
create table tip_reactions (
  id            uuid primary key default gen_random_uuid(),
  match_tip_id  uuid not null references match_tips(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  emoji         text not null check (emoji in ('😂','🔥','👀','😱','👏')),
  created_at    timestamptz not null default now(),
  unique (match_tip_id, user_id, emoji)
);

create table tip_comments (
  id            uuid primary key default gen_random_uuid(),
  match_tip_id  uuid not null references match_tips(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 200),
  created_at    timestamptz not null default now()
);

create table feature_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index on tip_reactions (match_tip_id);
create index on tip_comments (match_tip_id);
```

Hand-geschriebene Typen in `src/types/database.ts` für die drei neuen Tabellen ergänzen (Row/Insert/Update), Quelle der Wahrheit bleibt die Migration.

## RLS-Policies

Reveal-Gate per Subquery: Reaktionen/Kommentare nur für Tipps zu bereits angepfiffenen Spielen.

```sql
alter table tip_reactions enable row level security;
alter table tip_comments enable row level security;
alter table feature_requests enable row level security;

-- Hilfsbedingung (in jeder Policy inline): zugehöriges Match ist angepfiffen
-- exists (select 1 from match_tips mt join matches m on m.id = mt.match_id
--         where mt.id = match_tip_id and m.kickoff_at < now())

-- tip_reactions
create policy reactions_select on tip_reactions for select
  using (exists (select 1 from match_tips mt join matches m on m.id = mt.match_id
                 where mt.id = match_tip_id and m.kickoff_at < now()));
create policy reactions_insert on tip_reactions for insert
  with check (user_id = auth.uid()
              and exists (select 1 from match_tips mt join matches m on m.id = mt.match_id
                          where mt.id = match_tip_id and m.kickoff_at < now()));
create policy reactions_delete on tip_reactions for delete
  using (user_id = auth.uid());

-- tip_comments (analog, author_id = auth.uid())
create policy comments_select on tip_comments for select
  using (exists (select 1 from match_tips mt join matches m on m.id = mt.match_id
                 where mt.id = match_tip_id and m.kickoff_at < now()));
create policy comments_insert on tip_comments for insert
  with check (author_id = auth.uid()
              and exists (select 1 from match_tips mt join matches m on m.id = mt.match_id
                          where mt.id = match_tip_id and m.kickoff_at < now()));
create policy comments_delete on tip_comments for delete
  using (author_id = auth.uid());

-- feature_requests: jeder darf eigene anlegen + lesen, Admin liest alle
create policy fr_insert on feature_requests for insert
  with check (user_id = auth.uid());
create policy fr_select on feature_requests for select
  using (user_id = auth.uid()
         or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
```

> Hinweis: Genaue Policy-Syntax/Bestand gegen die vorhandenen RLS-Migrationen (`0002_rls.sql`) abgleichen, gleiche Konventionen übernehmen.

## Eigenes Profil bearbeiten

- `/profil` zeigt zusätzlich "Bearbeiten": Name (≤30) + Avatar tauschen.
- Die Resize-zu-WebP- + Storage-Upload-Logik aus `src/app/willkommen/page.tsx` (`resizeToSquareWebp`, Upload in Bucket `avatars`, `profiles.avatar_url` setzen) wird in einen gemeinsamen Helper `src/lib/avatar-upload.ts` extrahiert und von Onboarding und Edit genutzt. Kein Copy-Paste.

## Feature-Request-Button (wird implementiert)

- Button im Profil-Tab (`/profil`). Öffnet kleinen Dialog → Textarea → speichert in `feature_requests`.
- Erfolgsbestätigung im UI ("Danke, ist angekommen!").
- Auslesen v1: Admin liest direkt in Supabase. Kleine Admin-Liste = späteres Fast-Follow.

## Komponenten-Aufriss

| Datei | Art | Zweck |
|---|---|---|
| `src/app/(authed)/spieler/[id]/page.tsx` | Server | Fremdes Profil laden + rendern |
| `src/app/(authed)/profil/page.tsx` | Server | Eigenes Profil (gleiche Profil-Komponente + Edit/FR) |
| `src/components/profile-header.tsx` | Server | Avatar groß, Name, Rang, Punkte-Aufschlüsselung |
| `src/components/profile-tip-list.tsx` | Server | Tipp-Liste mit Ergebnis + Punkten + Interaktion |
| `src/components/tip-reactions.tsx` | Client | Emoji-Toggle, optimistisch |
| `src/components/tip-comments.tsx` | Client | Kommentare lesen/schreiben/löschen |
| `src/components/profile-edit.tsx` | Client | Name + Avatar bearbeiten |
| `src/components/feature-request-button.tsx` | Client | Dialog + Insert |
| `src/lib/rank.ts` | Util | Rang-Berechnung (aus leaderboard-table extrahiert) |
| `src/lib/avatar-upload.ts` | Util | Resize + Upload (aus willkommen extrahiert) |
| `src/components/bottom-nav.tsx` | Edit | 5. Tab "Profil" |
| `src/components/leaderboard-table.tsx` | Edit | Namen/Avatare als Links zu `/spieler/[id]` |
| `src/types/database.ts` | Edit | 3 neue Tabellen-Typen |
| `supabase/migrations/0008_social.sql` | Neu | Tabellen + RLS |

## Implementierungs-Hinweise

- **AGENTS.md beachten:** dieses Next.js hat Breaking Changes. Vor dem Schreiben von Code den relevanten Guide in `node_modules/next/dist/docs/` lesen (Routing, Server/Client Components, Server Actions).
- Bestehende Muster übernehmen: Server Components für Daten-Fetch, shadcn-ui (Card/Button/Input/Label/Dialog) + custom CSS-Klassen (`wm-table`, `display-heading`, `text-night`, `score-nums`), `createClient` aus `@/lib/supabase/server` bzw. `client`.
- Mutationen (Reaktion/Kommentar/FR/Profil-Edit) bevorzugt als Server Actions oder via Supabase-Client analog zu `willkommen`.

## Test-Überlegungen

- RLS: fremde Tipps/Reaktionen/Kommentare zu noch nicht angepfiffenen Spielen sind weder lesbar noch beschreibbar (auch bei Umgehung der UI).
- Trefferquote bei 0 abgegebenen Tipps → keine Division durch 0.
- Rang-Gleichstand identisch zwischen Rangliste und Profil (gemeinsamer `lib/rank.ts`).
- Avatar-Edit überschreibt alte URL korrekt; Upload-Fehler wird sauber angezeigt.
- Kommentar > 200 Zeichen wird abgelehnt (Client + DB-Check).
