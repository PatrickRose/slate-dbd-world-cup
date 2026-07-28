/**
 * Shapes and form-field names shared between the local score editor page
 * (`app/[year]/edit/page.dev.tsx`), its client form
 * (`components/editor/ScoreEditor.tsx`) and the server action that writes the
 * JSON back (`lib/editor-actions.ts`).
 *
 * This module must stay free of *runtime* imports from `lib/tournament.ts` —
 * that reads the filesystem, and this file is bundled into the browser. Types
 * are erased at compile time, so `import type` is fine.
 */
import type { Killer, SeedRef } from "./tournament";

/** One group match-up as the editor sees it, keyed by an order-free pair key. */
export interface EditorFixture {
  /** `pairingKey(a, b)` — stable no matter which round the match is dragged to. */
  key: string;
  a: Killer;
  b: Killer;
  aHooks?: number;
  bHooks?: number;
  video?: string;
}

export interface EditorGroup {
  name: string;
  /** Match-up keys per round, earliest round first. */
  rounds: string[][];
  /** Match-ups not in any round yet — a drag source, normally empty. */
  unscheduled: string[];
  /** Every match-up in the group, by key. */
  fixtures: EditorFixture[];
}

/** One knockout match: who's in it is derived, so only the score is editable. */
export interface EditorKnockoutMatch {
  /** 1-based position in the bracket. */
  round: number;
  match: number;
  /** Display labels for the two slots, resolved as far as results allow. */
  aLabel: string;
  bLabel: string;
  aHooks?: number;
  bHooks?: number;
  video?: string;
  /** Played but level, so nobody advanced. */
  drawn: boolean;
}

export interface EditorRound {
  name: string;
  matches: EditorKnockoutMatch[];
}

/** A qualifying position that can fill a first-round knockout slot. */
export interface SeedOption {
  ref: SeedRef;
  label: string;
}

/** Everything the editor form needs, all plain serialisable data. */
export interface EditorModel {
  year: number;
  title: string;
  groups: EditorGroup[];
  /** The bracket as it currently resolves, for entering scores. */
  knockout: EditorRound[];
  /** Authored first-round pairings — the bit you get to choose. */
  seeds: Array<[SeedRef, SeedRef]>;
  /** Every position a seed slot can be set to. */
  seedOptions: SeedOption[];
}

/** Result of a save attempt, rendered above the save button. */
export interface SaveState {
  status: "idle" | "saved" | "error";
  message?: string;
  /** Per-match problems, e.g. only one of the two hook counts filled in. */
  problems?: string[];
}

export const IDLE_SAVE_STATE: SaveState = { status: "idle" };

/**
 * Form field names.
 *
 * Group scores are keyed by the match-up itself rather than its position, so
 * dragging a match to another round doesn't move its score. The round layout
 * travels separately, as one JSON field per group.
 */
export const field = {
  groupHooks: (groupIndex: number, pairKey: string, side: "a" | "b") =>
    `g.${groupIndex}.${pairKey}.${side}Hooks`,
  groupVideo: (groupIndex: number, pairKey: string) =>
    `g.${groupIndex}.${pairKey}.video`,
  /** JSON: one group's `SchedulePayload` of match-up keys. */
  groupSchedule: (groupIndex: number) => `g.${groupIndex}.schedule`,
  /** JSON: `[SeedRef, SeedRef][]` — the whole first round in one go. */
  seeds: "seeds",
  knockoutHooks: (round: number, match: number, side: "a" | "b") =>
    `k.${round}.${match}.${side}Hooks`,
  knockoutVideo: (round: number, match: number) => `k.${round}.${match}.video`,
};

/**
 * What a group's `groupSchedule` field carries: match-up keys, laid out. The
 * server turns keys back into pairings from its own copy of the group, so a
 * stale or malformed key can't invent a match.
 */
export interface SchedulePayload {
  rounds: string[][];
  unscheduled: string[];
}
