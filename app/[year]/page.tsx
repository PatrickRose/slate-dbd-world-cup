import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildGroupViews,
  getTournament,
  getYears,
} from "@/lib/tournament";
import { GroupCard } from "@/components/GroupCard";
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

  const groups = buildGroupViews(tournament);
  const years = getYears();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
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
        <YearSwitcher years={years} current={tournament.year} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {groups.map((group) => (
          <GroupCard key={group.name} group={group} />
        ))}
      </div>
    </main>
  );
}
