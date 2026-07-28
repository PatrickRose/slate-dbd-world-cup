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
import type { Killer, KnockoutMatch } from "./tournament";

/** One group fixture as the editor sees it: the pairing plus any recorded score. */
export interface EditorFixture {
  a: Killer;
  b: Killer;
  aHooks?: number;
  bHooks?: number;
  video?: string;
}

export interface EditorGroup {
  name: string;
  fixtures: EditorFixture[];
}

export interface EditorRound {
  name: string;
  matches: KnockoutMatch[];
}

/** Everything the editor form needs, all plain serialisable data. */
export interface EditorModel {
  year: number;
  title: string;
  /** Every killer in the tournament, for the knockout slot dropdowns. */
  killers: Killer[];
  groups: EditorGroup[];
  knockout: EditorRound[];
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
 * Form field names. Fixtures and knockout matches are addressed by their
 * position in `buildGroupViews()` / `tournament.knockout`, which both the page
 * and the action derive from the same JSON — so the indices always line up.
 */
export const field = {
  groupHooks: (groupIndex: number, fixtureIndex: number, side: "a" | "b") =>
    `g.${groupIndex}.${fixtureIndex}.${side}Hooks`,
  groupVideo: (groupIndex: number, fixtureIndex: number) =>
    `g.${groupIndex}.${fixtureIndex}.video`,
  knockoutSlot: (roundIndex: number, matchIndex: number, side: "a" | "b") =>
    `k.${roundIndex}.${matchIndex}.${side}`,
  knockoutHooks: (roundIndex: number, matchIndex: number, side: "a" | "b") =>
    `k.${roundIndex}.${matchIndex}.${side}Hooks`,
  knockoutVideo: (roundIndex: number, matchIndex: number) =>
    `k.${roundIndex}.${matchIndex}.video`,
};
