import type {
  Fixture,
  GroupView,
  HiddenResults,
  QualificationStatus,
} from "@/lib/tournament";
import { KillerChip } from "./KillerChip";
import { YouTubeIcon } from "./YouTubeIcon";

/** Row background tint by qualification status. */
const STATUS_ROW: Record<QualificationStatus, string> = {
  through: "bg-green-100/70 dark:bg-green-500/15",
  eliminated: "bg-red-100/70 dark:bg-red-500/10",
  contention: "",
};

function Score({ fixture }: { fixture: Fixture }) {
  const { result, withheld } = fixture;

  // Spoiler mode: played, but the viewer hasn't watched the video it's in. Keep
  // the link, drop the number — the row still says "there's something here".
  if (withheld?.video) {
    return (
      <a
        href={withheld.video}
        target="_blank"
        rel="noopener noreferrer"
        title="Hidden by spoiler mode — watch it, then tick the video off"
        className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-semibold text-red-600 ring-1 ring-red-600/40 ring-inset transition-colors hover:bg-red-600 hover:text-white hover:ring-transparent dark:text-red-400"
      >
        <YouTubeIcon size={12} />
        Watch
      </a>
    );
  }

  // Played, but with no video linked there's nothing to watch and so no way to
  // earn it. Marked rather than blanked, otherwise the row claims the match
  // hasn't happened.
  if (withheld) {
    return (
      <span
        title="Played, but no video is linked — hidden while spoiler mode is on"
        className="spoiler-hatch w-full rounded-md px-3 py-1 text-center text-sm font-semibold text-zinc-500 ring-1 ring-black/10 ring-inset dark:text-zinc-400 dark:ring-white/15"
      >
        Hidden
      </span>
    );
  }

  if (!result) {
    return (
      <span className="w-full rounded-md px-3 py-1 text-center text-sm font-medium text-zinc-400 dark:text-zinc-500">
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
        data-spoilerable
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-red-500"
      >
        {label}
        <YouTubeIcon />
      </a>
    );
  }

  return (
    <span
      title="Result recorded — no video linked yet"
      data-spoilerable
      className="w-full rounded-md bg-zinc-200 px-3 py-1 text-center text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
    >
      {label}
    </span>
  );
}

/** "6 hidden", with the two reasons split out in the tooltip. */
function HiddenBadge({ hidden }: { hidden: HiddenResults }) {
  const total = hidden.behindVideo + hidden.noVideo;
  if (total === 0) return null;

  const reasons = [
    hidden.behindVideo > 0 &&
      `${hidden.behindVideo} in videos you haven't ticked`,
    hidden.noVideo > 0 && `${hidden.noVideo} with no video linked`,
  ].filter(Boolean) as string[];

  return (
    <span
      title={`${reasons.join(" · ")} — this table isn't final`}
      className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400"
    >
      {total} hidden
    </span>
  );
}

function MatchRow({ fixture }: { fixture: Fixture }) {
  return (
    // `grid-cols-subgrid`: the columns come from the round's `<ul>`, so the
    // score column is sized once for the whole round — "7 – 4", "12 – 12" and
    // "Watch" all end up the same width and the names either side line up.
    <li className="col-span-3 grid grid-cols-subgrid items-center px-4 py-2.5 odd:bg-black/[.02] dark:odd:bg-white/[.02]">
      <div className="min-w-0 justify-self-end">
        <KillerChip killer={fixture.a} align="left" />
      </div>
      <Score fixture={fixture} />
      <div className="min-w-0 justify-self-start">
        <KillerChip killer={fixture.b} align="right" reverse />
      </div>
    </li>
  );
}

export function GroupCard({ group }: { group: GroupView }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="flex items-center justify-between gap-2 border-b border-black/10 bg-zinc-100 px-5 py-3 text-lg font-bold dark:border-white/10 dark:bg-zinc-800">
        {group.name}
        {group.hidden && <HiddenBadge hidden={group.hidden} />}
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
        {/* `data-spoilerable`: the order of these rows gives the group away just
            as much as the numbers do, so the whole body stays invisible until
            the client has recomputed it. See `app/globals.css`. */}
        <tbody data-spoilerable>
          {group.standings.map((row, i) => (
            <tr
              key={row.killer.id}
              className={`border-b border-black/5 last:border-0 dark:border-white/5 ${STATUS_ROW[row.status]}`}
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

      {/* Matches, round by round */}
      {group.rounds.map((round) => (
        <MatchList
          key={round.name}
          title={round.name}
          fixtures={round.fixtures}
        />
      ))}
      {group.unscheduled.length > 0 && (
        <MatchList title="Not scheduled" fixtures={group.unscheduled} />
      )}
    </section>
  );
}

function MatchList({
  title,
  fixtures,
}: {
  title: string;
  fixtures: Fixture[];
}) {
  if (fixtures.length === 0) return null;

  return (
    <div className="border-t border-black/10 dark:border-white/10">
      <h3 className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <ul className="grid grid-cols-[1fr_auto_1fr] gap-x-3">
        {fixtures.map((f) => (
          <MatchRow key={`${f.a.id}-${f.b.id}`} fixture={f} />
        ))}
      </ul>
    </div>
  );
}
