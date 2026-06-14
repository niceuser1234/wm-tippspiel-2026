# ⚽ WM 2026 Tippspiel

A private prediction game for friends and family during the FIFA World Cup 2026 (June 11 – July 19, USA/Canada/Mexico). Points-based, no real betting involved.

**Live:** [project-4jhi8.vercel.app](https://project-4jhi8.vercel.app)

---

## Features

- **Magic Link Auth** — passwordless login via email, no registration form
- **Match Tips** — predict scores for 12 curated group-stage games + all knockout rounds
- **Special Bets** — 7 tournament-wide predictions (winner, top scorer, total goals, finalists, etc.)
- **Hidden Tips** — RLS-enforced: other players' tips stay hidden until kickoff
- **Live Leaderboard** — calculated live from a SQL view, no stored scores
- **Reveal View** — post-kickoff overview with point badges (+6/+3/0) per tip
- **Mobile-first** — designed for checking the leaderboard on your phone mid-game

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Magic Link + `@supabase/ssr` |
| Email | Resend |
| Hosting | Vercel |

## Scoring

| Match Tips | Points |
|---|---|
| Exact score | 4 |
| Correct goal difference | 3 |
| Correct outcome (win/draw/loss) | 2 |
| Wrong | 0 |

Special bets are worth 5–15 points each (59 total), with the biggest bets resolving in the final stages to keep everyone in the game until the end.

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── (authed)/           # Protected routes (session-guarded layout)
│   │   │   ├── tippen/         # Tip entry for open matches + special bets
│   │   │   ├── uebersicht/     # All matches with reveal after kickoff
│   │   │   └── rangliste/      # Live leaderboard
│   │   ├── auth/confirm/       # Magic link callback (OTP exchange)
│   │   ├── willkommen/         # Display name onboarding
│   │   └── page.tsx            # Login page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── match-tip-card.tsx  # Score stepper with upsert
│   │   ├── special-bet-card.tsx
│   │   ├── match-reveal-card.tsx
│   │   └── leaderboard-table.tsx
│   ├── lib/
│   │   ├── supabase/           # Browser + server + middleware clients
│   │   ├── scoring.ts          # 4/3/2/0 logic for UI badges
│   │   └── teams.ts            # WM 2026 teams with flag emojis
│   └── types/
│       └── database.ts         # Hand-written Supabase types
├── supabase/
│   └── migrations/
│       ├── 0001_schema.sql     # 5 tables with constraints
│       ├── 0002_rls.sql        # 12 RLS policies + signup trigger
│       └── 0003_leaderboard_view.sql  # Live scoring view
└── seed/
    ├── matches.ts              # 12 curated group-stage matches
    └── special-bets.ts         # 7 special bets with options
```

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/niceuser1234/wm-tippspiel-2026.git
cd wm-tippspiel-2026
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Run migrations
supabase link --project-ref <your-project-ref>
supabase db push

# 4. Seed data
npx tsx scripts/seed.ts

# 5. Start dev server
npm run dev
```

## Database Setup

Migrations in `supabase/migrations/` can be applied via:
- **Supabase CLI:** `supabase db push`
- **Dashboard:** Paste each file into the SQL Editor (0001 → 0002 → 0003)

The leaderboard is a live SQL view — no stored scores. Correcting a result in the dashboard instantly updates all rankings.

## Entering Results (Admin)

Results are entered manually via the **Supabase Table Editor** after each match:

1. Go to Supabase Dashboard → Table Editor → `matches`
2. Find the match and set `home_score` and `away_score`
3. The leaderboard recalculates automatically

For special bets, set `correct_answer` in the `special_bets` table when the bet resolves.

## Adding Knockout Matches

Knockout pairings become known from June 28 onward. Add them via:

```sql
INSERT INTO matches (stage, home_team, away_team, kickoff_at)
VALUES ('r16', 'Deutschland', 'Spanien', '2026-07-04T20:00:00Z');
```

Or use the Supabase Table Editor.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Local only | For running `scripts/seed.ts` — never deploy this |

## License

Private project — not for commercial use.
