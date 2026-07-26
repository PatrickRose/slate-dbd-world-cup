import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Data shapes — these mirror the JSON files in /data. See data/README.md for
// how to author a new year.
// ---------------------------------------------------------------------------

export interface Killer {
  /** Stable slug, e.g. "trickster". Used to reference the killer everywhere. */
  id: string;
  /** Display name, e.g. "The Trickster". */
  name: string;
  /**
   * Optional avatar image. Point this at a file in /public, e.g.
   * "/avatars/trickster.png". If omitted we fall back to a coloured initial.
   */
  avatar?: string;
}

export interface Group {
  /** Display name, e.g. "Group A". */
  name: string;
  /** Killer ids belonging to this group (round-robin among them). */
  killers: string[];
}

export interface Result {
  /** Group name this match belongs to (must match a Group.name). */
  group: string;
  /** Home killer id. */
  a: string;
  /** Away killer id. */
  b: string;
  /** Hooks scored by killer `a`. */
  aHooks: number;
  /** Hooks scored by killer `b`. */
  bHooks: number;
  /**
   * Full YouTube URL for the match, ideally timestamped, e.g.
   * "https://youtu.be/VIDEO_ID?t=1234". Optional — omit if not uploaded yet.
   */
  video?: string;
}

export interface Tournament {
  year: number;
  title: string;
  killers: Killer[];
  groups: Group[];
  results: Result[];
}

// ---------------------------------------------------------------------------
// Derived / view models
// ---------------------------------------------------------------------------

/** A single fixture in a group (may or may not have a recorded result yet). */
export interface Fixture {
  a: Killer;
  b: Killer;
  result?: Result;
}

/** One row of a group standings table. */
export interface StandingRow {
  killer: Killer;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Total hooks scored by this killer across the group. */
  hooks: number;
  points: number;
}

export interface GroupView {
  name: string;
  standings: StandingRow[];
  fixtures: Fixture[];
}

const POINTS_WIN = 3;
const POINTS_DRAW = 1;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");

/** All tournament years available, newest first. */
export function getYears(): number[] {
  const files = fs.existsSync(DATA_DIR)
    ? fs.readdirSync(DATA_DIR).filter((f) => /^\d{4}\.json$/.test(f))
    : [];
  return files
    .map((f) => parseInt(f.replace(".json", ""), 10))
    .sort((x, y) => y - x);
}

export function getLatestYear(): number | undefined {
  return getYears()[0];
}

export function getTournament(year: number): Tournament | undefined {
  const file = path.join(DATA_DIR, `${year}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Tournament;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Build the full round-robin fixture list for a set of killer ids, in a stable
 * order. Every pair plays once (a vs b).
 */
function roundRobin(ids: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

/**
 * Find the recorded result for a fixture regardless of home/away orientation.
 * Returns the result oriented so that `.a` corresponds to `idA`.
 */
function findResult(
  results: Result[],
  group: string,
  idA: string,
  idB: string,
): Result | undefined {
  for (const r of results) {
    if (r.group !== group) continue;
    if (r.a === idA && r.b === idB) return r;
    if (r.a === idB && r.b === idA) {
      // Flip so the caller always sees `idA` as `a`.
      return { ...r, a: r.b, b: r.a, aHooks: r.bHooks, bHooks: r.aHooks };
    }
  }
  return undefined;
}

/**
 * Turn raw tournament data into per-group views with computed standings and
 * a full fixture list. Standings are sorted by points, then total hooks, then
 * name — matching how Slate's spreadsheet ranks killers.
 */
export function buildGroupViews(t: Tournament): GroupView[] {
  const killerById = new Map(t.killers.map((k) => [k.id, k]));
  const killer = (id: string): Killer =>
    killerById.get(id) ?? { id, name: id };

  return t.groups.map((group) => {
    const ids = group.killers;

    // Seed a standings row per killer.
    const rows = new Map<string, StandingRow>(
      ids.map((id) => [
        id,
        {
          killer: killer(id),
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          hooks: 0,
          points: 0,
        },
      ]),
    );

    const fixtures: Fixture[] = roundRobin(ids).map(([idA, idB]) => {
      const result = findResult(t.results, group.name, idA, idB);
      if (result) {
        const rowA = rows.get(idA)!;
        const rowB = rows.get(idB)!;
        rowA.played++;
        rowB.played++;
        rowA.hooks += result.aHooks;
        rowB.hooks += result.bHooks;

        if (result.aHooks > result.bHooks) {
          rowA.won++;
          rowB.lost++;
          rowA.points += POINTS_WIN;
        } else if (result.aHooks < result.bHooks) {
          rowB.won++;
          rowA.lost++;
          rowB.points += POINTS_WIN;
        } else {
          rowA.drawn++;
          rowB.drawn++;
          rowA.points += POINTS_DRAW;
          rowB.points += POINTS_DRAW;
        }
      }
      return { a: killer(idA), b: killer(idB), result };
    });

    const standings = [...rows.values()].sort(
      (x, y) =>
        y.points - x.points ||
        y.hooks - x.hooks ||
        x.killer.name.localeCompare(y.killer.name),
    );

    return { name: group.name, standings, fixtures };
  });
}
