"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { field, type SaveState } from "./editor";
import {
  buildGroupViews,
  getTournament,
  type KnockoutRound,
  type Result,
} from "./tournament";
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

/** A killer id from a `<select>`, or undefined for the "not decided yet" slot. */
function readKiller(
  formData: FormData,
  name: string,
  known: Set<string>,
): string | undefined {
  const id = readText(formData, name);
  return id && known.has(id) ? id : undefined;
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
 * Write the scores and video links from the editor form into
 * `data/<year>.json`.
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
  const knownKillers = new Set(tournament.killers.map((k) => k.id));

  // --- Group stage: one result per fixture that has both hook counts. -------
  const results: Result[] = [];
  buildGroupViews(tournament).forEach((group, gi) => {
    group.fixtures.forEach((fixture, fi) => {
      const { aHooks, bHooks, video } = readMatch(
        formData,
        {
          aHooks: field.groupHooks(gi, fi, "a"),
          bHooks: field.groupHooks(gi, fi, "b"),
          video: field.groupVideo(gi, fi),
        },
        `${group.name}, ${fixture.a.name} v ${fixture.b.name}`,
        problems,
      );

      if (aHooks === undefined || bHooks === undefined) {
        if (video) {
          problems.push(
            `${group.name}, ${fixture.a.name} v ${fixture.b.name}: enter the score to save the video link.`,
          );
        }
        return; // No score recorded — stays an upcoming fixture.
      }

      results.push({
        group: group.name,
        a: fixture.a.id,
        b: fixture.b.id,
        aHooks,
        bHooks,
        video,
      });
    });
  });

  // --- Knockout: the bracket shape stays as authored, slots/scores update. --
  const knockout: KnockoutRound[] | undefined = tournament.knockout?.map(
    (round, ri) => ({
      name: round.name,
      matches: round.matches.map((match, mi) => {
        const a = readKiller(formData, field.knockoutSlot(ri, mi, "a"), knownKillers);
        const b = readKiller(formData, field.knockoutSlot(ri, mi, "b"), knownKillers);
        const { aHooks, bHooks, video } = readMatch(
          formData,
          {
            aHooks: field.knockoutHooks(ri, mi, "a"),
            bHooks: field.knockoutHooks(ri, mi, "b"),
            video: field.knockoutVideo(ri, mi),
          },
          `${round.name}, match ${mi + 1}`,
          problems,
        );

        return {
          a,
          b,
          aLabel: match.aLabel,
          bLabel: match.bLabel,
          aHooks,
          bHooks,
          video,
        };
      }),
    }),
  );

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
      writeTournamentJson(original, { year, results, knockout }),
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

  const played = results.length;
  const total = tournament.groups.reduce(
    (sum, g) => sum + (g.killers.length * (g.killers.length - 1)) / 2,
    0,
  );
  return {
    status: "saved",
    message: `Saved to data/${year}.json — ${played} of ${total} group matches played.`,
  };
}
