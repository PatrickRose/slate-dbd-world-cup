import type {
  KnockoutMatchView,
  KnockoutRoundView,
  KnockoutSideView,
} from "@/lib/tournament";
import { Avatar } from "./Avatar";
import { YouTubeIcon } from "./YouTubeIcon";

function Side({ side, played }: { side: KnockoutSideView; played: boolean }) {
  const lost = played && !side.winner;
  return (
    // `data-spoiler-tint` / `data-spoilerable`: who's in the slot and who won it
    // are both spoilers, so they're neutralised until the client has rebuilt the
    // bracket for this viewer.
    <div
      data-spoiler-tint={side.winner ? "" : undefined}
      className={`flex items-center justify-between gap-2 px-3 py-2 ${
        side.winner ? "bg-green-100/70 font-semibold dark:bg-green-500/15" : ""
      }`}
    >
      <span
        className={`flex min-w-0 items-center gap-2 ${
          lost ? "text-zinc-400 dark:text-zinc-500" : ""
        }`}
      >
        {side.killer ? (
          <Avatar killer={side.killer} size={22} />
        ) : (
          <span className="inline-block size-[22px] shrink-0 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600" />
        )}
        <span
          className="truncate text-sm"
          data-spoilerable={side.killer ? "" : undefined}
        >
          {side.label}
        </span>
      </span>
      <span className="shrink-0 text-sm tabular-nums" data-spoilerable>
        {typeof side.hooks === "number" ? side.hooks : "–"}
      </span>
    </div>
  );
}

function MatchCard({ match }: { match: KnockoutMatchView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <Side side={match.a} played={match.played} />
      <div className="border-t border-black/5 dark:border-white/10" />
      <Side side={match.b} played={match.played} />
      {match.drawn && (
        <p className="border-t border-black/5 bg-amber-50 px-3 py-1 text-center text-xs font-medium text-amber-700 dark:border-white/10 dark:bg-amber-500/10 dark:text-amber-400">
          Level on hooks — no one through
        </p>
      )}
      {/* Played, hidden, and nothing to watch: same dead end as an unlinked
          group match, so it's marked rather than left looking unplayed. */}
      {match.withheld && !match.video && (
        <p className="spoiler-hatch border-t border-black/5 px-3 py-1 text-center text-xs font-semibold text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Hidden — no video linked
        </p>
      )}
      {match.video && (
        <a
          href={match.video}
          target="_blank"
          rel="noopener noreferrer"
          title={
            match.withheld
              ? "Hidden by spoiler mode — watch it, then tick the video off"
              : undefined
          }
          className={
            match.withheld
              ? "flex items-center justify-center gap-1.5 border-t border-black/10 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:border-white/10 dark:text-red-400"
              : "flex items-center justify-center gap-1.5 border-t border-black/10 bg-red-600 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-500 dark:border-white/10"
          }
        >
          <YouTubeIcon size={12} />
          Watch
        </a>
      )}
    </div>
  );
}

/** Find the champion (winner of the final match), if it has been decided. */
function champion(rounds: KnockoutRoundView[]): KnockoutSideView | undefined {
  const finalRound = rounds[rounds.length - 1];
  const finalMatch =
    finalRound?.matches.length === 1 ? finalRound.matches[0] : undefined;
  if (!finalMatch?.played || finalMatch.drawn) return undefined;
  return finalMatch.a.winner ? finalMatch.a : finalMatch.b;
}

export function Bracket({ rounds }: { rounds: KnockoutRoundView[] }) {
  if (rounds.length === 0) return null;
  const winner = champion(rounds);

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-bold tracking-tight">Knockout Stage</h2>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-6">
          {rounds.map((round) => (
            <div
              key={round.name}
              className="flex min-w-[220px] flex-1 flex-col gap-4"
            >
              <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {round.name}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {round.matches.map((m, i) => (
                  <MatchCard key={`${round.name}-${i}`} match={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {winner?.killer && (
        <div
          data-spoilerable
          className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-4 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <span className="text-2xl">🏆</span>
          <Avatar killer={winner.killer} size={40} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Champion
            </p>
            <p className="text-lg font-bold">{winner.label}</p>
          </div>
        </div>
      )}
    </section>
  );
}
