import { test } from "node:test";
import assert from "node:assert";
import {
  normalize,
  mapTeam,
  mapRoundToStage,
  parseEspnEvents,
  type EspnEvent,
} from "./espn.ts";

test("normalize strips diacritics, case, punctuation", () => {
  assert.equal(normalize("Curaçao"), "curacao");
  assert.equal(normalize("Côte d'Ivoire"), "cote d ivoire");
  assert.equal(normalize("Bosnia-Herzegovina"), "bosnia herzegovina");
});

test("mapTeam resolves English ESPN names to German DB names", () => {
  assert.equal(mapTeam("Germany"), "Deutschland");
  assert.equal(mapTeam("Paraguay"), "Paraguay");
  assert.equal(mapTeam("Ivory Coast"), "Elfenbeinküste");
  assert.equal(mapTeam("Congo DR"), "DR Kongo");
  assert.equal(mapTeam("Winner Group A"), undefined); // TBD placeholder
});

test("mapRoundToStage maps knockout headlines, ignores group stage", () => {
  assert.equal(mapRoundToStage("round-of-32"), "r32");
  assert.equal(mapRoundToStage("round-of-16"), "r16");
  assert.equal(mapRoundToStage("quarterfinals"), "qf");
  assert.equal(mapRoundToStage("semifinals"), "sf");
  assert.equal(mapRoundToStage("3rd-place-match"), "third_place");
  assert.equal(mapRoundToStage("final"), "final");
  assert.equal(mapRoundToStage("group-stage"), null);
  assert.equal(mapRoundToStage(null), null);
});

test("parseEspnEvents flattens scheduled + finished events", () => {
  const json = {
    events: [
      {
        date: "2026-06-29T20:30Z",
        season: { slug: "round-of-32" },
        competitions: [{
          notes: [],
          status: { type: { completed: false } },
          competitors: [
            { homeAway: "home", score: "0", team: { displayName: "Germany" } },
            { homeAway: "away", score: "0", team: { displayName: "Paraguay" } },
          ],
        }],
      },
      {
        date: "2026-06-14T17:00Z",
        season: { slug: "group-stage" },
        competitions: [{
          notes: [],
          status: { type: { completed: true } },
          competitors: [
            { homeAway: "home", score: "3", team: { displayName: "Germany" } },
            { homeAway: "away", score: "1", team: { displayName: "Curacao" } },
          ],
        }],
      },
    ],
  };
  const out: EspnEvent[] = parseEspnEvents(json);
  assert.equal(out.length, 2);
  assert.deepEqual(
    { stage: out[0].stage, completed: out[0].completed, home: out[0].homeName, away: out[0].awayName },
    { stage: "r32", completed: false, home: "Germany", away: "Paraguay" },
  );
  assert.equal(out[1].stage, null);
  assert.equal(out[1].completed, true);
  assert.equal(out[1].homeScore, 3);
});
