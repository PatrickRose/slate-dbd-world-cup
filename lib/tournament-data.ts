/**
 * Reading the tournament data files off disk.
 *
 * Split out from `lib/tournament.ts` so that the computation over a tournament
 * stays importable from the browser — spoiler mode rebuilds the tables on the
 * client, and `node:fs` can't go with it. Only server components, server
 * actions and the local editor should import this module.
 */
import fs from "node:fs";
import path from "node:path";
import type { Tournament, TournamentFile } from "./tournament";

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
