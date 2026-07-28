import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildGroupViews, getTournament, getYears } from "@/lib/tournament";
import type { EditorModel } from "@/lib/editor";
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

  // Fixtures come straight from the group views so the indices used as form
  // field names match what the server action recomputes when it saves.
  const model: EditorModel = {
    year: tournament.year,
    title: tournament.title,
    killers: tournament.killers,
    groups: buildGroupViews(tournament).map((group) => ({
      name: group.name,
      fixtures: group.fixtures.map((fixture) => ({
        a: fixture.a,
        b: fixture.b,
        aHooks: fixture.result?.aHooks,
        bHooks: fixture.result?.bHooks,
        video: fixture.result?.video,
      })),
    })),
    knockout: tournament.knockout ?? [],
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
          clearing them again removes the result. Standings are recalculated from
          the file, so commit it when you&apos;re happy.
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
