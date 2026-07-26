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

/** One knockout-stage match. */
export interface KnockoutMatch {
  /** Killer id for side A, if known. Omit for a not-yet-decided slot. */
  a?: string;
  /** Killer id for side B, if known. */
  b?: string;
  /** Placeholder text when the killer isn't known yet, e.g. "Winner Group A". */
  aLabel?: string;
  bLabel?: string;
  /** Hooks scored by each side. Omit until the match has been played. */
  aHooks?: number;
  bHooks?: number;
  /** Full YouTube URL for the match, ideally timestamped. */
  video?: string;
}

/** A knockout round, e.g. Quarter-finals. Rounds are listed earliest first. */
export interface KnockoutRound {
  name: string;
  matches: KnockoutMatch[];
}

export interface Tournament {
  year: number;
  title: string;
  /** How many killers advance directly from each group. Defaults to 2. */
  advancePerGroup?: number;
  /**
   * How many of the best third-placed killers (those just below the automatic
   * cut, ranked across all groups by points then hooks) additionally advance.
   * Defaults to 0.
   */
  bestThirdPlace?: number;
  killers: Killer[];
  groups: Group[];
  results: Result[];
  /** Optional single-elimination bracket after the group stage. */
  knockout?: KnockoutRound[];
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

/**
 * Where a killer stands relative to advancing:
 * - `through`     — mathematically guaranteed to advance (green)
 * - `eliminated`  — mathematically impossible to advance (red)
 * - `contention`  — still could go either way (neutral)
 */
export type QualificationStatus = "through" | "eliminated" | "contention";

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
  status: QualificationStatus;
}

export interface GroupView {
  name: string;
  standings: StandingRow[];
  fixtures: Fixture[];
}

/** One killer's slot within a knockout match. */
export interface KnockoutSideView {
  killer?: Killer;
  /** What to display: the killer name, or a placeholder like "Winner Group A". */
  label: string;
  hooks?: number;
  winner: boolean;
}

export interface KnockoutMatchView {
  a: KnockoutSideView;
  b: KnockoutSideView;
  video?: string;
  played: boolean;
}

export interface KnockoutRoundView {
  name: string;
  matches: KnockoutMatchView[];
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

  const views: GroupView[] = t.groups.map((group) => {
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
          status: "contention",
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

    const standings = [...rows.values()].sort(rankRows);

    return { name: group.name, standings, fixtures };
  });

  computeQualification(views, t);
  return views;
}

/** Standings sort order: points, then total hooks, then name. */
function rankRows(x: StandingRow, y: StandingRow): number {
  return (
    y.points - x.points ||
    y.hooks - x.hooks ||
    x.killer.name.localeCompare(y.killer.name)
  );
}

/**
 * Work out each killer's through / eliminated / contention status.
 *
 * Qualification format: the top `advancePerGroup` of each group advance
 * directly, plus the best `bestThirdPlace` of the next-placed killers across
 * all groups (ranked by points then hooks) — the classic "best third-placed"
 * scheme.
 *
 * Statuses are only assigned when they are mathematically certain:
 * - `through`: a killer has clinched a direct top-N spot, or the whole group
 *   stage is complete and they qualify.
 * - `eliminated`: so many rivals in their group are already guaranteed above
 *   them that they cannot even reach the lowest qualifying position — this
 *   fires mid-group as soon as it becomes impossible, or at completion.
 * - `contention`: everything still undecided.
 */
function computeQualification(views: GroupView[], t: Tournament): void {
  const advance = t.advancePerGroup ?? 2;
  const bestThirds = t.bestThirdPlace ?? 0;
  // Lowest group position that could still lead to qualifying (0-indexed):
  // top N directly, plus one more row if any best-third places are on offer.
  const qualifyingDepth = advance + (bestThirds > 0 ? 1 : 0);

  const allComplete = views.every((v) =>
    v.fixtures.every((f) => f.result !== undefined),
  );

  if (allComplete) {
    // Definitive: direct qualifiers per group, then the best third-placed.
    for (const v of views) {
      v.standings.forEach((row, i) => {
        row.status = i < advance ? "through" : "eliminated";
      });
    }
    const thirds = views
      .map((v) => v.standings[advance])
      .filter((r): r is StandingRow => r !== undefined)
      .sort(rankRows);
    thirds.slice(0, bestThirds).forEach((row) => {
      row.status = "through";
    });
    return;
  }

  // Provisional, but only certainties are marked.
  for (const v of views) {
    const games = v.standings.length - 1; // round-robin games per killer
    for (const row of v.standings) {
      const remaining = Math.max(0, games - row.played);
      const maxPoints = row.points + POINTS_WIN * remaining;
      const others = v.standings.filter((o) => o !== row);

      // Rivals who could still finish at or above this killer's floor.
      const canOvertake = others.filter((o) => {
        const oRemaining = Math.max(0, games - o.played);
        return o.points + POINTS_WIN * oRemaining >= row.points;
      }).length;
      // Rivals already guaranteed to finish strictly above this killer.
      const guaranteedAbove = others.filter((o) => o.points > maxPoints).length;

      if (canOvertake <= advance - 1) {
        row.status = "through"; // clinched a direct spot
      } else if (guaranteedAbove >= qualifyingDepth) {
        row.status = "eliminated"; // can't reach any qualifying position
      } else {
        row.status = "contention";
      }
    }
  }
}

/**
 * Resolve the knockout bracket into a view model: killer ids become Killer
 * objects, missing slots fall back to their placeholder label, and the winner
 * of each played match is flagged.
 */
export function buildKnockout(t: Tournament): KnockoutRoundView[] {
  if (!t.knockout) return [];
  const killerById = new Map(t.killers.map((k) => [k.id, k]));

  return t.knockout.map((round) => ({
    name: round.name,
    matches: round.matches.map((m): KnockoutMatchView => {
      const killerA = m.a ? killerById.get(m.a) : undefined;
      const killerB = m.b ? killerById.get(m.b) : undefined;
      const played =
        typeof m.aHooks === "number" && typeof m.bHooks === "number";
      const aWins = played && m.aHooks! > m.bHooks!;
      const bWins = played && m.bHooks! > m.aHooks!;

      return {
        video: m.video,
        played,
        a: {
          killer: killerA,
          label: killerA?.name ?? m.aLabel ?? "TBD",
          hooks: m.aHooks,
          winner: aWins,
        },
        b: {
          killer: killerB,
          label: killerB?.name ?? m.bLabel ?? "TBD",
          hooks: m.bHooks,
          winner: bWins,
        },
      };
    }),
  }));
}
