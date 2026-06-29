import { test } from "node:test";
import assert from "node:assert";
import { planFixtureInserts, type ExistingMatch } from "./fixtures.ts";
import { type EspnEvent } from "./espn.ts";

const NOW = "2026-06-29T00:00:00Z"; // before the default ev() kickoff

function ev(partial: Partial<EspnEvent>): EspnEvent {
  return {
    round: "round-of-32", stage: "r32", completed: false,
    homeName: "Germany", awayName: "Paraguay",
    homeScore: 0, awayScore: 0, date: "2026-06-29T20:30Z",
    ...partial,
  };
}

test("inserts a concrete knockout pairing not yet in DB", () => {
  const plan = planFixtureInserts([ev({})], [], NOW);
  assert.equal(plan.inserts.length, 1);
  assert.deepEqual(plan.inserts[0], {
    stage: "r32", home_team: "Deutschland", away_team: "Paraguay",
    kickoff_at: "2026-06-29T20:30Z",
  });
});

test("skips a pairing already present in DB (idempotent re-run)", () => {
  const existing: ExistingMatch[] = [
    { stage: "r32", home_team: "Deutschland", away_team: "Paraguay" },
  ];
  const plan = planFixtureInserts([ev({})], existing, NOW);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_existing, 1);
});

test("matches DB row regardless of home/away orientation", () => {
  const existing: ExistingMatch[] = [
    { stage: "r32", home_team: "Paraguay", away_team: "Deutschland" },
  ];
  const plan = planFixtureInserts([ev({})], existing, NOW);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_existing, 1);
});

test("ignores group-stage events", () => {
  const plan = planFixtureInserts([ev({ stage: null, round: "group-stage" })], [], NOW);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_existing, 0);
});

test("TBD/unmapped team is not_yet_concrete, never inserted", () => {
  const plan = planFixtureInserts(
    [ev({ stage: "r16", round: "round-of-16", homeName: "Winner Group A", awayName: "Germany" })],
    [],
    NOW,
  );
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.not_yet_concrete.length, 1);
  assert.deepEqual(plan.unmapped, ["Winner Group A"]);
});

test("missing kickoff date -> not_yet_concrete (NOT NULL guard)", () => {
  const plan = planFixtureInserts([ev({ date: null })], [], NOW);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.not_yet_concrete.length, 1);
});

test("already-kicked-off pairing is skipped_past, never inserted", () => {
  const plan = planFixtureInserts([ev({ date: "2026-06-28T19:00Z" })], [], NOW);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.skipped_past, 1);
});

test("dedups identical pairings within one feed", () => {
  const plan = planFixtureInserts([ev({}), ev({})], [], NOW);
  assert.equal(plan.inserts.length, 1);
});
