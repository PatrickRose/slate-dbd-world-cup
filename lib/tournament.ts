/**
 * Tournament shapes and every computation over them — standings, schedules,
 * qualification and the knockout bracket.
 *
 * This module is deliberately free of filesystem access so it can be bundled
 * into the browser: spoiler mode recomputes the tables client-side from a
 * filtered result set. Reading `data/<year>.json` lives in
 * `lib/tournament-data.ts`, which is server-only.
 */

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

/**
 * One knockout-stage score — a single game, addressed by its position in the
 * bracket. A match played as a series has one of these per game.
 */
export interface KnockoutScore {
  /** 1-based round number, earliest round first. */
  round: number;
  /** 1-based match number within that round, top to bottom. */
  match: number;
  /**
   * 1-based game number within a series, for a match played as a best of
   * several. Left out for an ordinary one-off match, which is game 1.
   */
  game?: number;
  /** Hooks scored by the first and second slot of the match. */
  aHooks: number;
  bHooks: number;
  /** Full YouTube URL for the game, ideally timestamped. */
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
  /**
   * Rounds played as a series rather than a single game, keyed by the round
   * name shown on the bracket — `{ "Final": 5 }` makes the final a best of
   * five. Every other round stays a one-off. A name no round answers to is
   * ignored, so `bestOf` can be authored ahead of the bracket growing into it.
   */
  bestOf?: Record<string, number>;
  /** Scores for the games played so far, in any order. */
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
  /**
   * Set only in spoiler mode: the match *has* been played, but the viewer
   * hasn't watched the video it's in — so the score is kept back and the row
   * offers the video instead. A withheld result with no `video` can never be
   * revealed, since there's nothing to watch.
   *
   * `result` and `withheld` are mutually exclusive.
   */
  withheld?: Result;
}

/** How much of a group is being kept back in spoiler mode. */
export interface HiddenResults {
  /** Played, in a video the viewer hasn't ticked yet. */
  behindVideo: number;
  /** Played, with no video linked — hidden for good. */
  noVideo: number;
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
  /**
   * Set only in spoiler mode (i.e. when `buildGroupViews` is given the
   * unfiltered tournament to compare against), so the card can say how much of
   * the table is missing rather than looking finished.
   */
  hidden?: HiddenResults;
}

/** One killer's slot within a knockout match. */
export interface KnockoutSideView {
  killer?: Killer;
  /**
   * What to display: the killer's name once known, otherwise where they'll come
   * from — "Winner Group A", "Best 3rd place", "Winner of QF 2".
   */
  label: string;
  /** One-off matches only: hooks scored. A series counts in games instead. */
  hooks?: number;
  /**
   * Series only: games won so far, once the series is under way. Both sides
   * carry a number as soon as either does, so 3–0 reads as a sweep rather than
   * a blank.
   */
  games?: number;
  winner: boolean;
}

/** One game of a knockout match. A one-off match is a series of one. */
export interface KnockoutGameView {
  /** 1-based game number within the match. */
  number: number;
  /** Hooks scored by each slot, once the game has been played. */
  aHooks?: number;
  bHooks?: number;
  video?: string;
  /** Spoiler mode: played, but its score is being kept back. */
  withheld?: boolean;
  /** Who took it — unset while unplayed, and when it finished level. */
  winner?: "a" | "b";
}

export interface KnockoutMatchView {
  a: KnockoutSideView;
  b: KnockoutSideView;
  /** One-off matches only: the video. A series links its games individually. */
  video?: string;
  /**
   * Games this match is played over — 1 unless the round is listed in
   * `Knockout.bestOf`. A best of five is won by the first to three.
   */
  bestOf: number;
  /** One entry per game of the series, whether or not it has been played. */
  games: KnockoutGameView[];
  /** Settled: someone has won the series, or every game has been played. */
  played: boolean;
  /** Played out, but nobody won it — so nobody advances yet. */
  drawn: boolean;
  /**
   * Spoiler mode: at least one game is played but being kept back. Each game's
   * `video` is still set if there's something to watch, so the card can offer
   * the link without the hooks.
   */
  withheld?: boolean;
}

export interface KnockoutRoundView {
  name: string;
  matches: KnockoutMatchView[];
}

const POINTS_WIN = 3;
const POINTS_DRAW = 1;

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

/** Same result, sides swapped. */
function flipResult(r: Result): Result {
  return { ...r, a: r.b, b: r.a, aHooks: r.bHooks, bHooks: r.aHooks };
}

/** Same fixture, sides swapped. */
function flipFixture(f: Fixture): Fixture {
  return {
    a: f.b,
    b: f.a,
    result: f.result && flipResult(f.result),
    withheld: f.withheld && flipResult(f.withheld),
  };
}

/**
 * Turn raw tournament data into per-group views with computed standings and the
 * match-ups laid out into rounds. Standings are sorted by points, then total
 * hooks, then name — matching how Slate's spreadsheet ranks killers.
 *
 * `unfiltered` is how spoiler mode works: pass the full tournament alongside a
 * filtered `t` and every match missing from `t` is looked up there, so the
 * fixture can offer its video (`Fixture.withheld`) and the group can say how
 * much it's holding back (`GroupView.hidden`). Everything else — standings,
 * points, qualification — simply computes from the smaller result set, which is
 * the whole trick: the page becomes the tournament as it stood at the last
 * video the viewer watched.
 */
export function buildGroupViews(
  t: Tournament,
  unfiltered?: Tournament,
): GroupView[] {
  const killerById = new Map(t.killers.map((k) => [k.id, k]));
  const killer = (id: string): Killer =>
    killerById.get(id) ?? { id, name: id };

  const views: GroupView[] = t.groups.map((group) => {
    const ids = group.killers;
    const hidden: HiddenResults = { behindVideo: 0, noVideo: 0 };

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

      if (!result && unfiltered) {
        const withheld = findResult(unfiltered.results, group.name, idA, idB);
        if (withheld) {
          if (withheld.video) hidden.behindVideo++;
          else hidden.noVideo++;
          return { a: killer(idA), b: killer(idB), withheld };
        }
      }

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

    return {
      name: group.name,
      standings,
      rounds,
      unscheduled,
      hidden: unfiltered ? hidden : undefined,
    };
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
 * - `eliminated`: neither route to qualifying is open any more — they can't
 *   reach the group's top N (see `canStillQualify`), and the best-third-place
 *   route is shut too (see `canWinBestThird`). This fires mid-group as soon as
 *   it becomes impossible, or at completion.
 * - `contention`: everything still undecided.
 */
function computeQualification(views: GroupView[], t: Tournament): void {
  const advance = t.advancePerGroup ?? 2;
  const bestThirds = t.bestThirdPlace ?? 0;

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

  // Match-ups still to be played, per group — in spoiler mode that includes the
  // ones being kept back, which is the point: the table is the tournament as it
  // stood, so an unwatched match is an unplayed one. Every group's is needed up
  // front, since the best-third route is judged against the other groups.
  const remainingByGroup = new Map<string, Pairing[]>(
    views.map((v) => [
      v.name,
      groupFixtures(v)
        .filter((f) => !f.result)
        .map((f): Pairing => [f.a.id, f.b.id]),
    ]),
  );

  // Provisional, but only certainties are marked.
  for (const v of views) {
    const games = v.standings.length - 1; // round-robin games per killer
    const remainingFixtures = remainingByGroup.get(v.name)!;

    for (const row of v.standings) {
      const others = v.standings.filter((o) => o !== row);

      // Rivals who could still finish at or above this killer's floor.
      const canOvertake = others.filter((o) => {
        const oRemaining = Math.max(0, games - o.played);
        return o.points + POINTS_WIN * oRemaining >= row.points;
      }).length;

      if (canOvertake <= advance - 1) {
        row.status = "through"; // clinched a direct spot
        continue;
      }

      // Two ways to qualify, and a killer is only out once both are shut: the
      // group's top `advance` directly, or the row below it plus a good enough
      // showing against the other groups' third-placed killers.
      const directRoute = canStillQualify(
        row,
        others,
        remainingFixtures,
        advance,
      );
      const thirdRoute =
        !directRoute &&
        bestThirds > 0 &&
        canStillQualify(row, others, remainingFixtures, advance + 1) &&
        canWinBestThird(
          ceilingOf(row, remainingFixtures),
          v,
          views,
          remainingByGroup,
          advance,
          bestThirds,
        );

      row.status = directRoute || thirdRoute ? "contention" : "eliminated";
    }
  }
}

/**
 * Could a killer whose ceiling is `ceiling` points still take one of the
 * `bestThirds` slots on offer to third-placed killers?
 *
 * Only the other groups matter: each sends exactly one killer — whoever ends up
 * `advance + 1` places down — to be ranked against ours. A group's third-placed
 * killer finishes above `ceiling` precisely when `advance + 1` of its killers
 * do, so the question for each group is whether its remaining matches can
 * possibly leave that many below the ceiling. If they can't, that group is
 * certain to send someone better and one of the slots is spoken for.
 *
 * A group is only written off as out of reach when its third place is
 * *strictly* above the ceiling however its matches fall — see `canKeepBelow`
 * for when a tie on points counts as above it.
 */
function canWinBestThird(
  ceiling: Ceiling,
  ownGroup: GroupView,
  views: GroupView[],
  remainingByGroup: Map<string, Pairing[]>,
  advance: number,
  bestThirds: number,
): boolean {
  let spoken = 0;
  for (const v of views) {
    if (v === ownGroup) continue;
    // A group too small to have a third place never sends anybody.
    if (v.standings.length <= advance) continue;
    const open = remainingByGroup.get(v.name) ?? [];
    if (!canKeepBelow(v.standings, open, ceiling, advance + 1)) spoken++;
    if (spoken >= bestThirds) return false;
  }
  return true;
}

/**
 * The best a killer can still finish on, as the standings rank them: the points
 * they reach by winning everything they have left, and their hooks as a
 * tie-break.
 *
 * The hooks are only filled in once they have no matches left. Until then they
 * can climb without limit, so any tie on points is theirs for the taking and
 * there is no ceiling to compare against.
 */
interface Ceiling {
  points: number;
  hooks?: number;
}

/** Where a killer's ceiling sits — they win everything they have left. */
function ceilingOf(row: StandingRow, remaining: Pairing[]): Ceiling {
  const id = row.killer.id;
  const left = remaining.filter((p) => p[0] === id || p[1] === id).length;
  return {
    points: row.points + POINTS_WIN * left,
    hooks: left === 0 ? row.hooks : undefined,
  };
}

/**
 * How many outcomes the elimination search will look at before giving up. A
 * group's remaining matches branch three ways each, so an untouched group is
 * far too big to walk — but nobody is eliminated that early anyway, and the
 * search prunes hard once enough killers are clear, so by the time elimination
 * is actually in question it finishes well inside this.
 */
const ELIMINATION_SEARCH_BUDGET = 50_000;

/**
 * Can `row` still reach a qualifying position — i.e. finish in the group's top
 * `depth`?
 *
 * Best case for the killer in question: they win everything they have left, so
 * they finish on their `ceilingOf` and their remaining opponents take nothing
 * off them. What's left to settle is the matches *between* their rivals, and
 * those can't all go quietly — every one of them hands points to somebody.
 * Searching those outcomes is what catches the case a per-killer comparison
 * misses: two rivals sitting level with you still have to play each other, so
 * one of them is certain to pull clear.
 *
 * Their own matches drop out of the search for free: `canKeepBelow` only walks
 * matches between the killers it is given, and this killer isn't one of them.
 */
function canStillQualify(
  row: StandingRow,
  others: StandingRow[],
  remaining: Pairing[],
  depth: number,
): boolean {
  return canKeepBelow(others, remaining, ceilingOf(row, remaining), depth);
}

/**
 * Is there a way the matches still to be played can fall that leaves fewer than
 * `depth` of `rows` finishing strictly above `ceiling`?
 *
 * Only matches between two of `rows` are searched — anything else on the list
 * involves a killer whose points aren't being tracked, so it can't change the
 * count either way.
 *
 * Points as they stand are a floor, since they only ever go up, and a tie on
 * points is broken the way the standings break it — on hooks, but only where
 * both sides' hooks have stopped moving. Anyone still playing counts as *below*
 * a tie, since they could out-hook the ceiling however the points fall, and
 * every caller would rather leave a killer in contention than rule out one who
 * could still take a tie-break. The search gives up in favour of "yes" if it
 * runs long, so it can only ever under-call.
 */
function canKeepBelow(
  rows: StandingRow[],
  remaining: Pairing[],
  ceiling: Ceiling,
  depth: number,
): boolean {
  // Whose hook count is settled, and beats the ceiling's. Fixed for the whole
  // search: only points move as match-ups are played out below.
  const stillPlaying = new Set(remaining.flat());
  const outHooks = new Map(
    rows.map((o) => [
      o.killer.id,
      ceiling.hooks !== undefined &&
        !stillPlaying.has(o.killer.id) &&
        o.hooks > ceiling.hooks,
    ]),
  );
  /** Strictly above the ceiling on `pts` points: clear of it, or wins the tie. */
  const above = (killerId: string, pts: number): boolean =>
    pts > ceiling.points || (pts === ceiling.points && outHooks.get(killerId)!);

  const points = new Map(rows.map((o) => [o.killer.id, o.points]));
  let ahead = [...points].filter(([id, p]) => above(id, p)).length;
  if (ahead >= depth) return false;

  const award = (killerId: string, gain: number): void => {
    const before = points.get(killerId)!;
    points.set(killerId, before + gain);
    if (!above(killerId, before) && above(killerId, before + gain)) ahead++;
  };
  const revoke = (killerId: string, gain: number): void => {
    const after = points.get(killerId)!;
    points.set(killerId, after - gain);
    if (!above(killerId, after - gain) && above(killerId, after)) ahead--;
  };

  const open = remaining.filter((p) => points.has(p[0]) && points.has(p[1]));
  const outcomes: Array<[number, number]> = [
    [POINTS_WIN, 0],
    [0, POINTS_WIN],
    [POINTS_DRAW, POINTS_DRAW],
  ];
  let budget = ELIMINATION_SEARCH_BUDGET;

  const search = (i: number): boolean => {
    if (ahead >= depth) return false; // dead branch: points never come back off
    if (i === open.length) return true; // a way through
    if (budget-- <= 0) return true; // gave up looking — stay in contention

    const [x, y] = open[i];
    for (const [gainX, gainY] of outcomes) {
      award(x, gainX);
      award(y, gainY);
      const survives = search(i + 1);
      revoke(x, gainX);
      revoke(y, gainY);
      if (survives) return true;
    }
    return false;
  };

  return search(0);
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
 * How many games a round's matches are played over. One unless the data names
 * the round in `knockout.bestOf`; anything that isn't a whole number of games
 * is treated as a one-off rather than breaking the bracket.
 */
function seriesLength(knockout: Knockout | undefined, round: string): number {
  const declared = knockout?.bestOf?.[round];
  if (typeof declared !== "number" || !Number.isInteger(declared)) return 1;
  return declared >= 1 ? declared : 1;
}

/** Games it takes to win a series: three of a best of five. */
function gamesToWin(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

/** How a series stands: games each, and whether anyone has taken it. */
interface SeriesTally {
  aGames: number;
  bGames: number;
  /** Games played in sequence from the first — the series stops at a gap. */
  played: number;
  aWins: boolean;
  bWins: boolean;
}

/**
 * Count a series up, game by game in order, stopping the moment it's won —
 * anything entered after that is a dead rubber and doesn't count. A gap stops
 * the count too, since games are played in order: game 5 recorded on its own
 * says nothing about who leads.
 */
function tallySeries(games: KnockoutGameView[], bestOf: number): SeriesTally {
  const needed = gamesToWin(bestOf);
  let aGames = 0;
  let bGames = 0;
  let played = 0;

  for (const game of games) {
    if (game.aHooks === undefined || game.bHooks === undefined) break;
    played++;
    if (game.winner === "a") aGames++;
    else if (game.winner === "b") bGames++;
    if (aGames >= needed || bGames >= needed) break;
  }

  return { aGames, bGames, played, aWins: aGames >= needed, bWins: bGames >= needed };
}

/**
 * Build the bracket: the authored seeds make the first round, then each
 * following round is half the size, filled by the winners below it. A match
 * that's played out without anyone winning it leaves the slot above it open.
 */
export function buildKnockout(
  t: Tournament,
  groups: GroupView[],
  unfiltered?: Tournament,
): KnockoutRoundView[] {
  const seeds = t.knockout?.seeds ?? [];
  if (seeds.length === 0) return [];

  // Keyed by round, match and game — a score with no `game` is a one-off match,
  // which is game 1 of a series of one.
  const key = (s: KnockoutScore) => `${s.round}.${s.match}.${s.game ?? 1}`;
  const scoreAt = new Map((t.knockout?.scores ?? []).map((s) => [key(s), s]));
  // Spoiler mode: scores filtered out of `t` are still known about, so a game
  // can offer its video without giving up the hooks. Seeds aren't filtered, so
  // positions in the bracket line up between the two.
  const withheldAt = new Map(
    (unfiltered?.knockout?.scores ?? [])
      .filter((s) => !scoreAt.has(key(s)))
      .map((s) => [key(s), s]),
  );

  const rounds: KnockoutRoundView[] = [];
  // Each round is described by its slots: a known killer, or a label to show.
  let slots: Array<{ killer?: Killer; label: string }> = seeds
    .flat()
    .map((ref) => ({ killer: resolveSeed(ref, groups, t), label: seedLabel(ref) }));

  for (let r = 0; slots.length >= 2; r++) {
    const name = roundName(slots.length, r);
    const bestOf = seriesLength(t.knockout, name);
    const matches: KnockoutMatchView[] = [];
    const winners: Array<{ killer?: Killer; label: string }> = [];

    for (let m = 0; m < slots.length; m += 2) {
      const a = slots[m];
      const b = slots[m + 1];
      const position = `${r + 1}.${m / 2 + 1}`;

      const games: KnockoutGameView[] = [];
      for (let g = 1; g <= bestOf; g++) {
        const score = scoreAt.get(`${position}.${g}`);
        const withheld = withheldAt.get(`${position}.${g}`);
        games.push({
          number: g,
          aHooks: score?.aHooks,
          bHooks: score?.bHooks,
          video: score?.video ?? withheld?.video,
          withheld: withheld !== undefined,
          winner:
            score === undefined
              ? undefined
              : score.aHooks > score.bHooks
                ? "a"
                : score.bHooks > score.aHooks
                  ? "b"
                  : undefined,
        });
      }

      const { aGames, bGames, played, aWins, bWins } = tallySeries(games, bestOf);
      // Settled either way: someone has it, or every game is in and nobody has.
      const decided = aWins || bWins || played >= bestOf;
      // A series shows games won rather than hooks, but only once it's under
      // way — before that both sides sit at "–" like any unplayed match.
      const series = bestOf > 1 && played > 0;

      matches.push({
        video: bestOf === 1 ? games[0].video : undefined,
        bestOf,
        games,
        played: decided,
        drawn: decided && !aWins && !bWins,
        withheld: games.some((g) => g.withheld),
        a: {
          killer: a.killer,
          label: a.killer?.name ?? a.label,
          hooks: bestOf === 1 ? games[0].aHooks : undefined,
          games: series ? aGames : undefined,
          winner: aWins,
        },
        b: {
          killer: b.killer,
          label: b.killer?.name ?? b.label,
          hooks: bestOf === 1 ? games[0].bHooks : undefined,
          games: series ? bGames : undefined,
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
