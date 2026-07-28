/**
 * Writing `data/<year>.json` back out from the local score editor.
 *
 * The data files are hand-formatted — one killer per line, blank lines grouping
 * them, one result per line — and a plain `JSON.stringify(t, null, 2)` would
 * reflow the whole file into an unreadable diff. So we only re-emit the two
 * sections the editor owns (`results` and `knockout`) and copy every other
 * top-level value through as its exact original source text.
 */
import type { KnockoutRound, Result } from "./tournament";

const IND = "  ";

/** A top-level `"key": value` pair, with the value kept as raw source text. */
interface RawEntry {
  key: string;
  raw: string;
}

/** Index just past the closing quote of the JSON string starting at `start`. */
function endOfString(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") i += 2;
    else if (text[i] === '"') return i + 1;
    else i++;
  }
  throw new Error("Unterminated string in JSON source");
}

/** Index just past the end of the JSON value starting at `start`. */
function endOfValue(text: string, start: number): number {
  const char = text[start];

  if (char === '"') return endOfString(text, start);

  if (char === "{" || char === "[") {
    let depth = 0;
    let i = start;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i = endOfString(text, i);
        continue;
      }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    throw new Error("Unbalanced brackets in JSON source");
  }

  // Number, boolean or null: runs until the next separator.
  let i = start;
  while (i < text.length && !/[\s,}\]]/.test(text[i])) i++;
  return i;
}

/** Split a JSON object's source into its top-level entries, in file order. */
function splitTopLevel(text: string): RawEntry[] {
  const entries: RawEntry[] = [];
  const skipSpace = (i: number) => {
    while (i < text.length && /\s/.test(text[i])) i++;
    return i;
  };

  let i = skipSpace(0);
  if (text[i] !== "{") throw new Error("Expected a JSON object");
  i = skipSpace(i + 1);

  while (i < text.length && text[i] !== "}") {
    if (text[i] !== '"') throw new Error(`Expected a key at offset ${i}`);
    const keyEnd = endOfString(text, i);
    const key = JSON.parse(text.slice(i, keyEnd)) as string;

    i = skipSpace(keyEnd);
    if (text[i] !== ":") throw new Error(`Expected ":" after key "${key}"`);
    i = skipSpace(i + 1);

    const valueEnd = endOfValue(text, i);
    entries.push({ key, raw: text.slice(i, valueEnd) });

    i = skipSpace(valueEnd);
    if (text[i] === ",") i = skipSpace(i + 1);
  }

  return entries;
}

/** `{ "a": 1, "b": 2 }` on a single line, dropping `undefined` values. */
function compactObject(pairs: Array<[string, unknown]>): string {
  const body = pairs
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ");
  return body ? `{ ${body} }` : "{}";
}

/** One result per line, matching the house style of the data files. */
function serializeResults(results: Result[]): string {
  if (results.length === 0) return "[]";
  const lines = results.map((r) =>
    compactObject([
      ["group", r.group],
      ["a", r.a],
      ["b", r.b],
      ["aHooks", r.aHooks],
      ["bHooks", r.bHooks],
      ["video", r.video],
    ]),
  );
  return `[\n${lines.map((l) => IND.repeat(2) + l).join(",\n")}\n${IND}]`;
}

/** One round per block, one match per line. */
function serializeKnockout(rounds: KnockoutRound[]): string {
  if (rounds.length === 0) return "[]";

  const blocks = rounds.map((round) => {
    const matches = round.matches.map((m) =>
      compactObject([
        ["a", m.a],
        ["b", m.b],
        ["aLabel", m.aLabel],
        ["bLabel", m.bLabel],
        ["aHooks", m.aHooks],
        ["bHooks", m.bHooks],
        ["video", m.video],
      ]),
    );
    const matchList = matches.length
      ? `[\n${matches.map((m) => IND.repeat(4) + m).join(",\n")}\n${IND.repeat(3)}]`
      : "[]";

    return [
      `${IND.repeat(2)}{`,
      `${IND.repeat(3)}"name": ${JSON.stringify(round.name)},`,
      `${IND.repeat(3)}"matches": ${matchList}`,
      `${IND.repeat(2)}}`,
    ].join("\n");
  });

  return `[\n${blocks.join(",\n")}\n${IND}]`;
}

/**
 * Return the source of `original` with its `results` (and, when supplied, its
 * `knockout`) replaced. Untouched top-level keys keep their exact original
 * formatting, and their order in the file is preserved.
 */
export function writeTournamentJson(
  original: string,
  next: { year: number; results: Result[]; knockout?: KnockoutRound[] },
): string {
  const replacements = new Map<string, string>([
    ["results", serializeResults(next.results)],
  ]);
  if (next.knockout) {
    replacements.set("knockout", serializeKnockout(next.knockout));
  }

  // The filename owns the year, so we only bring an existing `year` field back
  // into line (e.g. after renaming 2025.json to 2026.json) — never add one.
  const ifPresent = new Map<string, string>([["year", String(next.year)]]);

  const entries = splitTopLevel(original);
  const present = new Set(entries.map((e) => e.key));
  const lines = entries.map(
    ({ key, raw }) =>
      `${IND}${JSON.stringify(key)}: ${
        replacements.get(key) ?? ifPresent.get(key) ?? raw
      }`,
  );

  // A section the file didn't have yet (e.g. the first ever result) gets added.
  for (const [key, value] of replacements) {
    if (!present.has(key)) lines.push(`${IND}${JSON.stringify(key)}: ${value}`);
  }

  return `{\n${lines.join(",\n")}\n}\n`;
}
