import type { Fixture, GroupView } from "@/lib/tournament";
import { KillerChip } from "./KillerChip";

function Score({ fixture }: { fixture: Fixture }) {
  const { result } = fixture;

  if (!result) {
    return (
      <span className="rounded-md px-3 py-1 text-sm font-medium text-zinc-400 dark:text-zinc-500">
        vs
      </span>
    );
  }

  const won = result.aHooks > result.bHooks;
  const lost = result.aHooks < result.bHooks;
  const label = (
    <span className="tabular-nums">
      <span className={won ? "font-bold" : ""}>{result.aHooks}</span>
      <span className="mx-1 text-zinc-400">–</span>
      <span className={lost ? "font-bold" : ""}>{result.bHooks}</span>
    </span>
  );

  if (result.video) {
    return (
      <a
        href={result.video}
        target="_blank"
        rel="noopener noreferrer"
        title="Watch this match on YouTube"
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-red-500"
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden
        >
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
      </a>
    );
  }

  return (
    <span
      title="Result recorded — no video linked yet"
      className="rounded-md bg-zinc-200 px-3 py-1 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
    >
      {label}
    </span>
  );
}

function MatchRow({ fixture }: { fixture: Fixture }) {
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 odd:bg-black/[.02] dark:odd:bg-white/[.02]">
      <div className="min-w-0 justify-self-end">
        <KillerChip killer={fixture.a} align="left" />
      </div>
      <div className="justify-self-center">
        <Score fixture={fixture} />
      </div>
      <div className="min-w-0 justify-self-start">
        <KillerChip killer={fixture.b} align="right" reverse />
      </div>
    </li>
  );
}

export function GroupCard({ group }: { group: GroupView }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="border-b border-black/10 bg-zinc-100 px-5 py-3 text-lg font-bold dark:border-white/10 dark:bg-zinc-800">
        {group.name}
      </h2>

      {/* Standings */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10">
            <th className="py-2 pl-5 pr-2 font-semibold">Killer</th>
            <th className="w-9 px-1 text-center font-semibold" title="Played">
              Pl
            </th>
            <th className="w-9 px-1 text-center font-semibold" title="Won">
              W
            </th>
            <th className="w-9 px-1 text-center font-semibold" title="Drawn">
              D
            </th>
            <th className="w-9 px-1 text-center font-semibold" title="Lost">
              L
            </th>
            <th className="w-12 px-1 text-center font-semibold" title="Hooks">
              Hooks
            </th>
            <th
              className="w-12 px-1 pr-5 text-center font-semibold"
              title="Points"
            >
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {group.standings.map((row, i) => (
            <tr
              key={row.killer.id}
              className="border-b border-black/5 last:border-0 dark:border-white/5"
            >
              <td className="py-2 pl-5 pr-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 text-xs text-zinc-400 tabular-nums">
                    {i + 1}
                  </span>
                  <KillerChip killer={row.killer} align="left" />
                </div>
              </td>
              <td className="px-1 text-center tabular-nums">{row.played}</td>
              <td className="px-1 text-center tabular-nums">{row.won}</td>
              <td className="px-1 text-center tabular-nums">{row.drawn}</td>
              <td className="px-1 text-center tabular-nums">{row.lost}</td>
              <td className="px-1 text-center tabular-nums">{row.hooks}</td>
              <td className="px-1 pr-5 text-center font-bold tabular-nums">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Fixtures */}
      <div className="border-t border-black/10 dark:border-white/10">
        <h3 className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Matches
        </h3>
        <ul>
          {group.fixtures.map((f) => (
            <MatchRow key={`${f.a.id}-${f.b.id}`} fixture={f} />
          ))}
        </ul>
      </div>
    </section>
  );
}
