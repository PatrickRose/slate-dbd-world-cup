import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTournament, getYears } from "@/lib/tournament-data";
import { buildVideoList, prepaintScript } from "@/lib/spoilers";
import { YearBoard } from "@/components/YearBoard";
import { YearSwitcher } from "@/components/YearSwitcher";

export function generateStaticParams() {
  return getYears().map((year) => ({ year: String(year) }));
}

export async function generateMetadata(
  props: PageProps<"/[year]">,
): Promise<Metadata> {
  const { year } = await props.params;
  const t = getTournament(Number(year));
  return {
    title: t ? t.title : "Slate DBD Killer World Cup",
  };
}

export default async function YearPage(props: PageProps<"/[year]">) {
  const { year } = await props.params;
  const tournament = getTournament(Number(year));

  if (!tournament) notFound();

  const years = getYears();
  const videos = buildVideoList(tournament);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 wide:max-w-[92rem]">
      {/* Spoiler mode's anti-flash. This runs while the browser is still parsing
          the page, so if spoiler mode is on the results below are hidden before
          anything is painted — `YearBoard` lifts the mask once it has rebuilt
          the tables for this viewer. See `lib/spoilers.ts`. */}
      <script
        dangerouslySetInnerHTML={{ __html: prepaintScript(tournament.year) }}
      />

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
            Group Stage
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tournament.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            More hooks wins the match — 3 points for a win, 1 each for a draw.
            Click a score to watch the match on YouTube.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <YearSwitcher years={years} current={tournament.year} />
          {/* Local score editor. `process.env.NODE_ENV` is inlined at build
              time, so this link — and the route it points at — are absent from
              the deployed site. */}
          {process.env.NODE_ENV !== "production" && (
            <a
              href={`/${tournament.year}/edit`}
              className="rounded-full border border-dashed border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
            >
              Edit scores (local only)
            </a>
          )}
        </div>
      </header>

      <YearBoard tournament={tournament} videos={videos}>
        <div className="mb-5 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-green-200 dark:bg-green-500/30" />
            Through
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-red-200 dark:bg-red-500/25" />
            Eliminated
          </span>
          <span>
            Status is only shown once it&apos;s mathematically decided.
          </span>
        </div>
      </YearBoard>
    </main>
  );
}
