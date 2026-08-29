import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildGroupViews,
  buildKnockout,
  groupFixtures,
  pairingKey,
  type SeedRef,
} from "@/lib/tournament";
import { getTournament, getYears } from "@/lib/tournament-data";
import type { EditorModel, SeedOption } from "@/lib/editor";
import { ScoreEditor } from "@/components/editor/ScoreEditor";

/**
 * Local-only score entry for one year.
 *
 * The `.dev.tsx` extension is only registered as a page when we're not building
 * for production (see `next.config.ts`), so this route exists under
 * `npm run dev` and is absent from the deployed site. Types are written out by
 * hand here rather than using the generated `PageProps` helper, because the
 * route — and therefore its generated types — doesn't exist in a production
 * build.
 */
export const metadata: Metadata = {
  title: "Edit scores",
};

export default async function EditYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const tournament = getTournament(Number(year));

  if (!tournament) notFound();

  const groups = buildGroupViews(tournament);
  const knockout = buildKnockout(tournament, groups);

  const model: EditorModel = {
    year: tournament.year,
    title: tournament.title,

    groups: groups.map((group) => ({
      name: group.name,
      rounds: group.rounds.map((round) =>
        round.fixtures.map((f) => pairingKey(f.a.id, f.b.id)),
      ),
      unscheduled: group.unscheduled.map((f) => pairingKey(f.a.id, f.b.id)),
      fixtures: groupFixtures(group).map((f) => ({
        key: pairingKey(f.a.id, f.b.id),
        a: f.a,
        b: f.b,
        aHooks: f.result?.aHooks,
        bHooks: f.result?.bHooks,
        video: f.result?.video,
      })),
    })),

    knockout: knockout.map((round, ri) => ({
      name: round.name,
      matches: round.matches.map((m, mi) => ({
        round: ri + 1,
        match: mi + 1,
        aLabel: m.a.label,
        bLabel: m.b.label,
        bestOf: m.bestOf,
        games: m.games.map((g) => ({
          number: g.number,
          aHooks: g.aHooks,
          bHooks: g.bHooks,
          aGens: g.aGens,
          bGens: g.bGens,
          video: g.video,
          tiebreak: g.tiebreak,
        })),
        drawn: m.drawn,
      })),
    })),

    seeds: tournament.knockout?.seeds ?? [],
    seedOptions: seedOptions(tournament.groups.map((g) => g.name), tournament),
  };

  const years = getYears();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
          Local editor · not deployed
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tournament.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter hooks and match links, then save to write{" "}
          <code className="font-mono">data/{tournament.year}.json</code>. Leave
          both hook boxes empty for a match that hasn&apos;t been played —
          clearing them again removes the result. Drag a match by its handle to
          move it to a different round.
        </p>
        <nav className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <a
            href={`/${tournament.year}`}
            className="rounded-full border border-black/15 px-4 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            View {tournament.year} tables
          </a>
          {years
            .filter((y) => y !== tournament.year)
            .map((y) => (
              <a
                key={y}
                href={`/${y}/edit`}
                className="rounded-full border border-black/15 px-4 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                Edit {y}
              </a>
            ))}
        </nav>
      </header>

      <ScoreEditor model={model} />
    </main>
  );
}

/**
 * Every qualifying position a knockout seed can point at: each place that
 * advances from each group, plus however many best-third-place slots are on
 * offer this year.
 */
function seedOptions(
  groupNames: string[],
  t: { advancePerGroup?: number; bestThirdPlace?: number },
): SeedOption[] {
  const advance = t.advancePerGroup ?? 2;
  const bestThirds = t.bestThirdPlace ?? 0;
  const options: SeedOption[] = [];

  for (const name of groupNames) {
    for (let place = 1; place <= advance; place++) {
      const ref: SeedRef = `${name}:${place}`;
      options.push({
        ref,
        label: place === 1 ? `${name} winner` : `${name} #${place}`,
      });
    }
  }
  for (let n = 1; n <= bestThirds; n++) {
    options.push({ ref: `best3:${n}`, label: `Best 3rd place #${n}` });
  }

  return options;
}
