import type {
  KnockoutMatchView,
  KnockoutRoundView,
  KnockoutSideView,
} from "@/lib/tournament";
import { Avatar } from "./Avatar";

function Side({ side, played }: { side: KnockoutSideView; played: boolean }) {
  const lost = played && !side.winner;
  return (
    <div
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
        <span className="truncate text-sm">{side.label}</span>
      </span>
      <span className="shrink-0 text-sm tabular-nums">
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
      {match.video && (
        <a
          href={match.video}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-black/10 bg-red-600 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-500 dark:border-white/10"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z" />
          </svg>
          Watch
        </a>
      )}
    </div>
  );
}

/** Find the champion (winner of the final match), if it has been decided. */
function champion(rounds: KnockoutRoundView[]): KnockoutSideView | undefined {
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches.length === 1 ? finalRound.matches[0] : undefined;
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
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
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
