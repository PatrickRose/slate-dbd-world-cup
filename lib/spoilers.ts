/**
 * Spoiler mode: the page as the tournament stood at whichever videos you've
 * watched.
 *
 * The whole feature is one idea — filter the result set and let everything else
 * follow. Standings, points, hooks, the through/eliminated colouring and the
 * knockout bracket are all computed from `results`, so removing the results a
 * viewer hasn't seen yet un-decides them automatically: tables shrink, nobody
 * clinches early, and bracket slots go back to saying "Winner Group A".
 *
 * Two rules the UI depends on:
 *
 * - Whether a result is showable is decided by *its video*, which the viewer
 *   ticks off. A match is hidden until the video it appears in is ticked.
 * - A result with no video is never showable in spoiler mode — there's nothing
 *   to watch, so there's no way to have earned it. That means a group holding an
 *   unlinked result never completes while spoiler mode is on, which in turn
 *   leaves the "best 3rd place" bracket slots unresolved. That's the accepted
 *   cost of the rule, not a bug.
 *
 * This module is browser-safe: no filesystem, no server-only imports.
 */
import { buildGroupViews, buildKnockout, type Tournament } from "./tournament";

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

/**
 * The YouTube id inside a result's link, which is what "have you watched this?"
 * is really asking about. Handles both link shapes in the data —
 * `youtube.com/watch?v=ID` and `youtu.be/ID`, with or without a timestamp.
 */
export function videoId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match =
    /(?:[?&]v=|youtu\.be\/|\/(?:embed|live|shorts)\/)([\w-]{6,})/.exec(url);
  return match?.[1];
}

/** One video, as the spoiler control lists it. */
export interface VideoSummary {
  /** YouTube id — the stable handle for "watched", so re-ordering can't shift it. */
  id: string;
  /** The first link found for this video, for the "Open" affordance. */
  url: string;
  /**
   * Derived from what the video covers, e.g. "Round 2 · Groups A–C". The data
   * has no titles in it, and this is the more useful label for picking up where
   * you left off anyway.
   */
  label: string;
  /** How many matches this video covers. */
  matches: number;
}

/** "Group A" → "A", for the coverage label. Anything else is left alone. */
function groupLetter(name: string): string | undefined {
  return /^Group (\S+)$/.exec(name)?.[1];
}

/** ["Group A", "Group B", "Group C"] → "Groups A–C"; two → "Groups A & B". */
function groupsLabel(names: string[]): string {
  const letters = names.map(groupLetter);
  if (letters.some((l) => l === undefined)) return names.join(", ");
  const sorted = (letters as string[]).slice().sort();
  if (sorted.length === 1) return `Group ${sorted[0]}`;
  if (sorted.length === 2) return `Groups ${sorted[0]} & ${sorted[1]}`;
  // Contiguous single letters read better as a range.
  const contiguous = sorted.every(
    (l, i) =>
      l.length === 1 &&
      l.charCodeAt(0) === (sorted[0] as string).charCodeAt(0) + i,
  );
  return contiguous
    ? `Groups ${sorted[0]}–${sorted[sorted.length - 1]}`
    : `Groups ${sorted.join(", ")}`;
}

function roundsLabel(rounds: number[]): string {
  const sorted = [...new Set(rounds)].sort((x, y) => x - y);
  if (sorted.length === 1) return `Round ${sorted[0]}`;
  return `Rounds ${sorted[0]}–${sorted[sorted.length - 1]}`;
}

/** Which games of a series a video covers: "Game 3", "Games 1–3", "Games 1, 4". */
function gamesLabel(games: number[]): string {
  const sorted = [...new Set(games)].sort((x, y) => x - y);
  if (sorted.length === 1) return `Game ${sorted[0]}`;
  const contiguous = sorted.every((g, i) => g === sorted[0] + i);
  return contiguous
    ? `Games ${sorted[0]}–${sorted[sorted.length - 1]}`
    : `Games ${sorted.join(", ")}`;
}

/**
 * Every video referenced by the tournament, in the order the matches were
 * played: group stage by round then group, knockout after.
 *
 * Built from the same round layout the page shows, so a video's label always
 * agrees with where its matches appear on screen.
 */
export function buildVideoList(t: Tournament): VideoSummary[] {
  interface Entry {
    url: string;
    matches: number;
    rounds: number[];
    groups: Set<string>;
    /** Sorts group-stage videos by round, then by group order in the data. */
    order: number;
    /** Knockout rounds are named, not numbered. */
    stageLabel?: string;
    /** Which games of a knockout series this video covers, if it's a series. */
    stageGames?: number[];
  }
  const entries = new Map<string, Entry>();

  const entry = (id: string, url: string, order: number): Entry => {
    const existing = entries.get(id);
    if (existing) {
      existing.order = Math.min(existing.order, order);
      return existing;
    }
    const created: Entry = {
      url,
      matches: 0,
      rounds: [],
      groups: new Set(),
      order,
    };
    entries.set(id, created);
    return created;
  };

  const groups = buildGroupViews(t);
  const groupOrder = new Map(t.groups.map((g, i) => [g.name, i]));

  groups.forEach((group) => {
    const position = groupOrder.get(group.name) ?? 0;
    group.rounds.forEach((round, roundIndex) => {
      round.fixtures.forEach((fixture) => {
        const id = videoId(fixture.result?.video);
        if (!id || !fixture.result?.video) return;
        const e = entry(id, fixture.result.video, roundIndex * 100 + position);
        e.matches++;
        e.rounds.push(roundIndex + 1);
        e.groups.add(group.name);
      });
    });
  });

  // A series links each of its games separately, so they're listed — and ticked
  // off — one at a time. Games sharing a stream still collapse into one entry,
  // the same way three group matches on one video do.
  buildKnockout(t, groups).forEach((round, roundIndex) => {
    round.matches.forEach((match) => {
      match.games.forEach((game) => {
        const id = videoId(game.video);
        if (!id || !game.video) return;
        const e = entry(id, game.video, 100_000 + roundIndex);
        e.matches++;
        e.stageLabel = round.name;
        if (match.bestOf > 1) (e.stageGames ??= []).push(game.number);
      });
    });
  });

  return [...entries]
    .sort(([, x], [, y]) => x.order - y.order)
    .map(([id, e]) => ({
      id,
      url: e.url,
      matches: e.matches,
      label: e.stageLabel
        ? e.stageGames
          ? `${e.stageLabel} · ${gamesLabel(e.stageGames)}`
          : e.stageLabel
        : `${roundsLabel(e.rounds)} · ${groupsLabel([...e.groups])}`,
    }));
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * The same tournament with every result the viewer hasn't earned removed —
 * group results and knockout scores alike. Seeds, groups and killers are left
 * alone, so the fixture list and the bracket keep their shape.
 */
export function filterTournament(
  t: Tournament,
  watched: ReadonlySet<string>,
): Tournament {
  const seen = (video: string | undefined): boolean => {
    const id = videoId(video);
    return id !== undefined && watched.has(id);
  };

  return {
    ...t,
    results: t.results.filter((r) => seen(r.video)),
    knockout: t.knockout && {
      ...t.knockout,
      scores: (t.knockout.scores ?? []).filter((s) => seen(s.video)),
    },
  };
}

// ---------------------------------------------------------------------------
// Stored preference
// ---------------------------------------------------------------------------

/** What spoiler mode remembers, per year. */
export interface SpoilerState {
  on: boolean;
  /** Video ids ticked as watched. */
  watched: ReadonlySet<string>;
}

export const SPOILERS_OFF: SpoilerState = { on: false, watched: new Set() };

/** Stored per year, so a new edition doesn't inherit last year's progress. */
export function storageKey(year: number): string {
  return `spoilers:${year}`;
}

/**
 * How the preference is stored: ids, never indexes — see `VideoSummary.id`.
 * Reading and writing it is `lib/spoiler-store.ts`, which is browser-only.
 */
export interface StoredSpoilerState {
  on?: boolean;
  watched?: unknown;
}

/** Parse whatever is in storage, tolerating anything that isn't ours. */
export function parseSpoilerState(raw: string | null): SpoilerState {
  if (!raw) return SPOILERS_OFF;
  try {
    const parsed = JSON.parse(raw) as StoredSpoilerState;
    const watched = Array.isArray(parsed.watched)
      ? parsed.watched.filter((id): id is string => typeof id === "string")
      : [];
    // An `off` state still keeps its ticks, so turning spoiler mode back on
    // picks up where it left off.
    return { on: parsed.on === true, watched: new Set(watched) };
  } catch {
    // Hand-mangled JSON, or a key that belongs to something else. Spoiler mode
    // just doesn't come back on — never worth breaking the page over.
    return SPOILERS_OFF;
  }
}

export function serialiseSpoilerState(state: SpoilerState): string {
  return JSON.stringify({ on: state.on, watched: [...state.watched] });
}

/**
 * The inline script the year page renders before its tables.
 *
 * It runs while the browser is still parsing the HTML — before the first paint
 * and long before React hydrates — and all it needs to know is whether spoiler
 * mode is on. If it is, `data-spoilers="on"` on `<html>` lets one CSS rule (see
 * `app/globals.css`) hide the results the server has already rendered, so
 * nothing is spoiled in the gap. `YearBoard` clears the attribute once it has
 * recomputed the tables for this viewer.
 *
 * Deliberately *not* the other way round (hiding by default, revealing once the
 * script runs): spoiler mode is off for most visitors, and they shouldn't get a
 * blank page — or, with JavaScript disabled, no page at all.
 */
export function prepaintScript(year: number): string {
  return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
    storageKey(year),
  )}));if(s&&s.on===true)document.documentElement.dataset.spoilers='on'}catch(e){}})()`;
}
