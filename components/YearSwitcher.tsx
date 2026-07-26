import Link from "next/link";

/** Row of year tabs so viewers can jump between editions of the tournament. */
export function YearSwitcher({
  years,
  current,
}: {
  years: number[];
  current: number;
}) {
  if (years.length <= 1) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {years.map((year) => {
        const active = year === current;
        return (
          <Link
            key={year}
            href={`/${year}`}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/10"
            }
          >
            {year}
          </Link>
        );
      })}
    </nav>
  );
}
