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

/** A match-up, as a pair of killer ids. Which one is first doesn't matter. */
export type Pairing = [string, string];

export interface Group {
  /** Display name, e.g. "Group A". */
  name: string;
  /** Killer ids belonging to this group (round-robin among them). */
  killers: string[];
  /**
   * Which round each match-up is played in: one list of pairings per round,
   * earliest first. Optional — left out, a schedule is generated (see
   * `defaultSchedule`). The local editor writes this whenever you drag a match
   * to a different round, so you don't normally author it by hand.
   */
  rounds?: Pairing[][];
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

/**
 * Who fills a first-round knockout slot, written as a qualifying position
 * rather than a killer — the killer is whoever ends up there.
 *
 * - `"Group A:1"` — winner of Group A, `"Group A:2"` its runner-up, and so on.
 * - `"best3:1"` — the best third-placed killer across all groups, `"best3:2"`
 *   the next best. Only as many as `bestThirdPlace` are available.
 */
export type SeedRef = string;

/** One knockout-stage score. Matches are addressed by position in the bracket. */
export interface KnockoutScore {
  /** 1-based round number, earliest round first. */
  round: number;
  /** 1-based match number within that round, top to bottom. */
  match: number;
  /** Hooks scored by the first and second slot of the match. */
  aHooks: number;
  bHooks: number;
  /** Full YouTube URL for the match, ideally timestamped. */
  video?: string;
}

/**
 * The knockout stage. Only the first-round pairings are authored — every later
 * round is derived by advancing the winners, so the bracket builds itself as
 * scores go in.
 */
export interface Knockout {
  /** First-round pairings, top to bottom. Two `SeedRef`s per match. */
  seeds: Array<[SeedRef, SeedRef]>;
  /** Scores for the matches played so far, in any order. */
  scores?: KnockoutScore[];
}

export interface Tournament {
  /**
   * Taken from the data file's name, not its contents — `2026.json` is the 2026
   * tournament, so renaming the file moves the edition. See `getTournament`.
   */
  year: number;
  /** Heading for the year, defaulting to `Slate DBD Killer World Cup <year>`. */
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
  knockout?: Knockout;
}

/**
 * A data file as authored on disk: everything except `year` and `title`, which
 * are both derived from the filename. Naming the file is all it takes to start
 * a new edition.
 */
export type TournamentFile = Omit<Tournament, "year" | "title">;

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

/** One round of a group: the matches played together, e.g. "Round 1". */
export interface RoundView {
  name: string;
  fixtures: Fixture[];
}

export interface GroupView {
  name: string;
  standings: StandingRow[];
  /** Matches grouped into rounds, earliest first. */
  rounds: RoundView[];
  /**
   * Match-ups the group's authored `rounds` didn't mention — normally empty,
   * since the editor always writes a complete schedule. They show up here (and
   * as a bucket in the editor) rather than being silently dropped, so adding a
   * killer to a group can't lose matches.
   */
  unscheduled: Fixture[];
}

/** One killer's slot within a knockout match. */
export interface KnockoutSideView {
  killer?: Killer;
  /**
   * What to display: the killer's name once known, otherwise where they'll come
   * from — "Winner Group A", "Best 3rd place", "Winner of QF 2".
   */
  label: string;
  hooks?: number;
  winner: boolean;
}

export interface KnockoutMatchView {
  a: KnockoutSideView;
  b: KnockoutSideView;
  video?: string;
  played: boolean;
  /** Played, but level on hooks — so nobody advances yet. */
  drawn: boolean;
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
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as TournamentFile;
  // The filename is the only place the year lives — `getYears`, the route param
  // and `generateStaticParams` all read it from there, so deriving the year and
  // the heading here keeps every one of them in agreement after a rename.
  return { ...data, year, title: `Slate DBD Killer World Cup ${year}` };
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Every match-up in a group: each pair of killers plays once. Order is stable
 * so a pairing always looks the same way round.
 */
export function allPairings(ids: string[]): Pairing[] {
  const pairs: Pairing[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

/** Order-insensitive key for a pairing, so A-v-B and B-v-A are the same match. */
export function pairingKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Split a group's match-ups into rounds, so every killer plays exactly once per
 * round. Uses the circle method, seeded so that the first round pairs the killer
 * list up two at a time (1v2, 3v4, 5v6) — the way Slate's spreadsheet lays it
 * out. Later rounds are a valid schedule but won't necessarily match the
 * spreadsheet's; drag matches between rounds in the editor to line them up.
 *
 * With an odd number of killers one sits out each round.
 */
export function defaultSchedule(ids: string[]): Pairing[][] {
  if (ids.length < 2) return [];

  // The circle method pairs first-with-last, second-with-second-last, and so on.
  // Interleaving the killers as 1, 3, 5 … 6, 4, 2 makes that come out as the
  // consecutive pairs 1v2, 3v4, 5v6 for the opening round.
  const evens = ids.filter((_, i) => i % 2 === 0);
  const odds = ids.filter((_, i) => i % 2 === 1);
  let circle: Array<string | undefined> = [...evens, ...odds.reverse()];
  if (circle.length % 2 === 1) circle.push(undefined); // odd one out each round

  const size = circle.length;
  const rounds: Pairing[][] = [];

  for (let r = 0; r < size - 1; r++) {
    const round: Pairing[] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = circle[i];
      const b = circle[size - 1 - i];
      if (a !== undefined && b !== undefined) round.push([a, b]);
    }
    rounds.push(round);
    // Rotate everything but the first position.
    circle = [circle[0], circle[size - 1], ...circle.slice(1, size - 1)];
  }

  return rounds;
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

/** Every match-up in a group view, whichever round it landed in. */
export function groupFixtures(view: GroupView): Fixture[] {
  return [...view.rounds.flatMap((r) => r.fixtures), ...view.unscheduled];
}

/** Same fixture, sides swapped. */
function flipFixture(f: Fixture): Fixture {
  const result = f.result;
  return {
    a: f.b,
    b: f.a,
    result: result && {
      ...result,
      a: result.b,
      b: result.a,
      aHooks: result.bHooks,
      bHooks: result.aHooks,
    },
  };
}

/**
 * Turn raw tournament data into per-group views with computed standings and the
 * match-ups laid out into rounds. Standings are sorted by points, then total
 * hooks, then name — matching how Slate's spreadsheet ranks killers.
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

    const buildFixture = ([idA, idB]: Pairing): Fixture => {
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
    };

    // Every match-up gets built exactly once — that's what feeds the standings —
    // then they're laid out into the rounds the group asks for.
    const fixtureByPair = new Map<string, Fixture>(
      allPairings(ids).map((pairing) => [
        pairingKey(...pairing),
        buildFixture(pairing),
      ]),
    );

    const schedule = group.rounds ?? defaultSchedule(ids);
    const scheduled = new Set<string>();
    const rounds: RoundView[] = schedule.map((pairings, i) => ({
      name: `Round ${i + 1}`,
      fixtures: pairings.flatMap(([idA, idB]) => {
        const key = pairingKey(idA, idB);
        // Ignore anything that isn't a real match-up in this group, or a repeat.
        const fixture = scheduled.has(key) ? undefined : fixtureByPair.get(key);
        if (!fixture) return [];
        scheduled.add(key);
        // Show the pairing the way round the schedule lists it.
        return [fixture.a.id === idA ? fixture : flipFixture(fixture)];
      }),
    }));

    const unscheduled = [...fixtureByPair]
      .filter(([key]) => !scheduled.has(key))
      .map(([, fixture]) => fixture);

    const standings = [...rows.values()].sort(rankRows);

    return { name: group.name, standings, rounds, unscheduled };
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
    groupFixtures(v).every((f) => f.result !== undefined),
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

/** How a seed reads before it's known: `"Group A:1"` → "Winner Group A". */
function seedLabel(ref: SeedRef): string {
  const best3 = /^best3:(\d+)$/.exec(ref);
  if (best3) {
    const n = Number(best3[1]);
    return n === 1 ? "Best 3rd place" : `${ordinal(n)} best 3rd place`;
  }

  const position = /^(.*):(\d+)$/.exec(ref);
  if (!position) return ref;
  const [, group, place] = position;
  return Number(place) === 1
    ? `Winner ${group}`
    : `${ordinal(Number(place))} ${group}`;
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * Standard names for a knockout round, based on how many killers are left in
 * it. Anything unusual falls back to "Round N".
 */
function roundName(teams: number, index: number): string {
  switch (teams) {
    case 2:
      return "Final";
    case 4:
      return "Semi-finals";
    case 8:
      return "Quarter-finals";
    default:
      return teams > 8 ? `Round of ${teams}` : `Round ${index + 1}`;
  }
}

/**
 * Look up whoever currently occupies a qualifying position: `"Group A:2"` is the
 * runner-up of Group A, `"best3:1"` the best third-placed killer overall.
 *
 * Only returns a killer once that position is settled — while the group could
 * still change hands, the slot stays open and shows its label instead.
 */
function resolveSeed(
  ref: SeedRef,
  groups: GroupView[],
  t: Tournament,
): Killer | undefined {
  const best3 = /^best3:(\d+)$/.exec(ref);
  if (best3) {
    const advance = t.advancePerGroup ?? 2;
    // Only meaningful once every group is done, since it ranks across them all.
    if (!groups.every((g) => groupFixtures(g).every((f) => f.result))) {
      return undefined;
    }
    const thirds = groups
      .map((g) => g.standings[advance])
      .filter((r): r is StandingRow => r !== undefined)
      .sort(rankRows);
    return thirds[Number(best3[1]) - 1]?.killer;
  }

  const position = /^(.*):(\d+)$/.exec(ref);
  if (!position) return undefined;
  const [, groupName, place] = position;
  const group = groups.find((g) => g.name === groupName);
  if (!group) return undefined;
  // Positions are only final once the group has finished playing.
  if (!groupFixtures(group).every((f) => f.result)) return undefined;
  return group.standings[Number(place) - 1]?.killer;
}

/**
 * Build the bracket: the authored seeds make the first round, then each
 * following round is half the size, filled by the winners below it. A match
 * that finished level leaves the slot above it open.
 */
export function buildKnockout(
  t: Tournament,
  groups: GroupView[],
): KnockoutRoundView[] {
  const seeds = t.knockout?.seeds ?? [];
  if (seeds.length === 0) return [];

  const scoreAt = new Map(
    (t.knockout?.scores ?? []).map((s) => [`${s.round}.${s.match}`, s]),
  );

  const rounds: KnockoutRoundView[] = [];
  // Each round is described by its slots: a known killer, or a label to show.
  let slots: Array<{ killer?: Killer; label: string }> = seeds
    .flat()
    .map((ref) => ({ killer: resolveSeed(ref, groups, t), label: seedLabel(ref) }));

  for (let r = 0; slots.length >= 2; r++) {
    const name = roundName(slots.length, r);
    const matches: KnockoutMatchView[] = [];
    const winners: Array<{ killer?: Killer; label: string }> = [];

    for (let m = 0; m < slots.length; m += 2) {
      const a = slots[m];
      const b = slots[m + 1];
      const score = scoreAt.get(`${r + 1}.${m / 2 + 1}`);
      const played = score !== undefined;
      const aWins = played && score.aHooks > score.bHooks;
      const bWins = played && score.bHooks > score.aHooks;

      matches.push({
        video: score?.video,
        played,
        drawn: played && !aWins && !bWins,
        a: {
          killer: a.killer,
          label: a.killer?.name ?? a.label,
          hooks: score?.aHooks,
          winner: aWins,
        },
        b: {
          killer: b.killer,
          label: b.killer?.name ?? b.label,
          hooks: score?.bHooks,
          winner: bWins,
        },
      });

      const winner = aWins ? a : bWins ? b : undefined;
      winners.push({
        killer: winner?.killer,
        label: `Winner of ${shortRound(name)} ${m / 2 + 1}`,
      });
    }

    rounds.push({ name, matches });
    if (matches.length === 1) break; // that was the final
    slots = winners;
  }

  return rounds;
}

/** "Quarter-finals" → "QF", for the compact "Winner of QF 2" labels. */
function shortRound(name: string): string {
  if (name === "Quarter-finals") return "QF";
  if (name === "Semi-finals") return "SF";
  if (name === "Final") return "the final";
  const of = /^Round of (\d+)$/.exec(name);
  return of ? `R${of[1]}` : name;
}
