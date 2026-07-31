"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { field, type SaveState, type SchedulePayload } from "./editor";
import {
  allPairings,
  buildGroupViews,
  buildKnockout,
  pairingKey,
  type Knockout,
  type KnockoutScore,
  type Pairing,
  type Result,
  type SeedRef,
} from "./tournament";
import { getTournament } from "./tournament-data";
import { writeTournamentJson } from "./tournament-json";

/** Sentinel for "something was typed, but it isn't a valid hook count". */
const INVALID = Symbol("invalid");

function readHooks(
  formData: FormData,
  name: string,
): number | undefined | typeof INVALID {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) return INVALID;
  return value;
}

function readText(formData: FormData, name: string): string | undefined {
  const raw = formData.get(name);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * One match's score + video, validated together: both hook counts or neither,
 * and a video link that actually looks like a link.
 */
function readMatch(
  formData: FormData,
  names: { aHooks: string; bHooks: string; video: string },
  label: string,
  problems: string[],
): { aHooks?: number; bHooks?: number; video?: string } {
  const aHooks = readHooks(formData, names.aHooks);
  const bHooks = readHooks(formData, names.bHooks);
  const video = readText(formData, names.video);

  if (aHooks === INVALID || bHooks === INVALID) {
    problems.push(`${label}: hooks must be whole numbers of 0 or more.`);
    return {};
  }
  if ((aHooks === undefined) !== (bHooks === undefined)) {
    problems.push(`${label}: enter both hook counts, or clear both.`);
    return {};
  }
  if (video && !/^https?:\/\//i.test(video)) {
    problems.push(`${label}: the video link must start with http:// or https://.`);
    return { aHooks, bHooks };
  }

  return { aHooks, bHooks, video };
}

/**
 * Turn one group's submitted layout into rounds of pairings.
 *
 * The submitted keys are only ever *positions*: every pairing comes back out of
 * the group's own killer list, so an unknown or repeated key is dropped rather
 * than trusted. Match-ups the layout didn't mention stay unscheduled, and empty
 * rounds are dropped since they carry nothing.
 */
function readSchedule(
  formData: FormData,
  groupIndex: number,
  killers: string[],
  groupName: string,
  problems: string[],
): { rounds: Pairing[][]; unscheduled: Pairing[] } {
  const pairings = new Map(
    allPairings(killers).map((pairing) => [pairingKey(...pairing), pairing]),
  );

  let payload: SchedulePayload | undefined;
  const raw = formData.get(field.groupSchedule(groupIndex));
  if (typeof raw === "string" && raw !== "") {
    try {
      const parsed = JSON.parse(raw) as SchedulePayload;
      if (Array.isArray(parsed?.rounds)) payload = parsed;
    } catch {
      // Fall through to the message below.
    }
  }
  if (!payload) {
    problems.push(`${groupName}: couldn't read the round layout.`);
    return { rounds: [], unscheduled: [...pairings.values()] };
  }

  const taken = new Set<string>();
  const take = (keys: unknown): Pairing[] =>
    (Array.isArray(keys) ? keys : []).flatMap((key) => {
      if (typeof key !== "string" || taken.has(key)) return [];
      const pairing = pairings.get(key);
      if (!pairing) return [];
      taken.add(key);
      return [pairing];
    });

  const rounds = payload.rounds.map(take).filter((round) => round.length > 0);
  const unscheduled = [...pairings]
    .filter(([key]) => !taken.has(key))
    .map(([, pairing]) => pairing);

  return { rounds, unscheduled };
}

/** The authored first-round pairings, checked against the positions on offer. */
function readSeeds(
  formData: FormData,
  valid: Set<SeedRef>,
  problems: string[],
): Array<[SeedRef, SeedRef]> | undefined {
  const raw = formData.get(field.seeds);
  if (typeof raw !== "string" || raw === "") return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    problems.push("Knockout: couldn't read the seeding.");
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;

  const seeds: Array<[SeedRef, SeedRef]> = [];
  parsed.forEach((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2) return;
    const [a, b] = pair as [unknown, unknown];
    if (typeof a !== "string" || typeof b !== "string") return;
    if (!valid.has(a) || !valid.has(b)) {
      problems.push(`Knockout match ${i + 1}: unknown qualifying position.`);
      return;
    }
    seeds.push([a, b]);
  });

  const used = new Map<SeedRef, number>();
  seeds.flat().forEach((ref) => used.set(ref, (used.get(ref) ?? 0) + 1));
  for (const [ref, count] of used) {
    if (count > 1) {
      problems.push(
        `Knockout: ${ref} is seeded into ${count} slots — each position can only qualify once.`,
      );
    }
  }

  return seeds;
}

/** Every qualifying position that can be seeded this year. */
function seedRefs(t: {
  groups: Array<{ name: string }>;
  advancePerGroup?: number;
  bestThirdPlace?: number;
}): SeedRef[] {
  const refs: SeedRef[] = [];
  for (const group of t.groups) {
    for (let place = 1; place <= (t.advancePerGroup ?? 2); place++) {
      refs.push(`${group.name}:${place}`);
    }
  }
  for (let n = 1; n <= (t.bestThirdPlace ?? 0); n++) refs.push(`best3:${n}`);
  return refs;
}

/**
 * Write the scores, the round each match is played in, and the knockout seeding
 * from the editor form into `data/<year>.json`.
 *
 * Local development only — the page that calls this doesn't exist in a
 * production build (see `next.config.ts`), but the guard below means a stray
 * POST can never rewrite data on a deployed server either.
 */
export async function saveTournament(
  year: number,
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (process.env.NODE_ENV === "production") {
    return {
      status: "error",
      message: "The score editor only runs locally, via `npm run dev`.",
    };
  }

  const tournament = getTournament(year);
  if (!tournament) {
    return { status: "error", message: `No data file for ${year}.` };
  }

  const problems: string[] = [];
  const killerName = (id: string) =>
    tournament.killers.find((k) => k.id === id)?.name ?? id;

  // --- Group stage: the round layout, plus a result per match-up that has ----
  // --- both hook counts. ----------------------------------------------------
  const schedules = tournament.groups.map((group, gi) =>
    readSchedule(formData, gi, group.killers, group.name, problems),
  );

  const results: Result[] = [];
  tournament.groups.forEach((group, gi) => {
    const { rounds, unscheduled } = schedules[gi];
    for (const [a, b] of [...rounds.flat(), ...unscheduled]) {
      const key = pairingKey(a, b);
      const label = `${group.name}, ${killerName(a)} v ${killerName(b)}`;

      const { aHooks, bHooks, video } = readMatch(
        formData,
        {
          aHooks: field.groupHooks(gi, key, "a"),
          bHooks: field.groupHooks(gi, key, "b"),
          video: field.groupVideo(gi, key),
        },
        label,
        problems,
      );

      if (aHooks === undefined || bHooks === undefined) {
        if (video) {
          problems.push(`${label}: enter the score to save the video link.`);
        }
        continue; // No score recorded — stays an upcoming fixture.
      }

      results.push({ group: group.name, a, b, aHooks, bHooks, video });
    }
  });

  // --- Knockout: the seeding is authored, the rest follows the results. ------
  let knockout: Knockout | undefined;
  if (tournament.knockout) {
    // The bracket as it stands tells us which match positions exist to score.
    const bracket = buildKnockout(tournament, buildGroupViews(tournament));
    const seeds =
      readSeeds(formData, new Set(seedRefs(tournament)), problems) ??
      tournament.knockout.seeds;

    const scores: KnockoutScore[] = [];
    bracket.forEach((round, ri) => {
      round.matches.forEach((_, mi) => {
        const [roundNo, matchNo] = [ri + 1, mi + 1];
        const label = `${round.name}, match ${matchNo}`;
        const { aHooks, bHooks, video } = readMatch(
          formData,
          {
            aHooks: field.knockoutHooks(roundNo, matchNo, "a"),
            bHooks: field.knockoutHooks(roundNo, matchNo, "b"),
            video: field.knockoutVideo(roundNo, matchNo),
          },
          label,
          problems,
        );

        if (aHooks === undefined || bHooks === undefined) {
          if (video) {
            problems.push(`${label}: enter the score to save the video link.`);
          }
          return;
        }

        scores.push({ round: roundNo, match: matchNo, aHooks, bHooks, video });
      });
    });

    knockout = { seeds, ...(scores.length > 0 ? { scores } : {}) };
  }

  if (problems.length > 0) {
    return {
      status: "error",
      message: "Nothing was saved — fix these and try again:",
      problems,
    };
  }

  const file = path.join(process.cwd(), "data", `${year}.json`);
  try {
    const original = fs.readFileSync(file, "utf8");
    fs.writeFileSync(
      file,
      writeTournamentJson(original, {
        groups: tournament.groups.map((group, gi) => ({
          ...group,
          rounds: schedules[gi].rounds,
        })),
        results,
        knockout,
      }),
    );
  } catch (error) {
    return {
      status: "error",
      message: `Couldn't write data/${year}.json: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  revalidatePath(`/${year}`);

  const total = tournament.groups.reduce(
    (sum, g) => sum + (g.killers.length * (g.killers.length - 1)) / 2,
    0,
  );
  const unscheduled = schedules.reduce((n, s) => n + s.unscheduled.length, 0);
  return {
    status: "saved",
    message:
      `Saved to data/${year}.json — ${results.length} of ${total} group matches played` +
      (unscheduled > 0 ? `, ${unscheduled} not in a round yet.` : "."),
  };
}
