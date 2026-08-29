import type {
  KnockoutGameView,
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
      {/* Hooks for a one-off match, games won for a series — never both, so
          the column stays one number wide either way. */}
      <span className="shrink-0 text-sm tabular-nums" data-spoilerable>
        {side.games ?? side.hooks ?? "–"}
      </span>
    </div>
  );
}

/**
 * One game of a series: its number and score, linking to the video if there is
 * one. The score is `data-spoilerable` like any other, so which games have been
 * played doesn't leak out of the server-rendered HTML before the client has
 * rebuilt the bracket for this viewer.
 */
function GameChip({ game }: { game: KnockoutGameView }) {
  const score =
    typeof game.aHooks === "number" && typeof game.bHooks === "number"
      ? `${game.aHooks}–${game.bHooks}`
      : "–";
  // Only a game level at a 4k each is settled on generators, and only then is
  // the count worth the space — see `gens` in `MatchCard`.
  const gens = gensScore(game);

  const body = (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
        G{game.number}
      </span>
      <span className="tabular-nums" data-spoilerable>
        {score}
      </span>
      {gens && (
        <span className="tabular-nums opacity-70" data-spoilerable>
          ({gens} gens)
        </span>
      )}
    </>
  );

  const shell =
    "flex items-center gap-1 rounded border border-black/10 px-1.5 py-0.5 text-xs dark:border-white/15";

  if (game.video) {
    return (
      <a
        href={game.video}
        target="_blank"
        rel="noopener noreferrer"
        title={
          game.withheld
            ? "Hidden by spoiler mode — watch it, then tick the video off"
            : `Watch game ${game.number}`
        }
        className={`${shell} font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:text-red-400`}
      >
        {body}
      </a>
    );
  }

  return (
    <span
      className={`${shell} text-zinc-500 dark:text-zinc-400 ${
        game.withheld ? "spoiler-hatch" : ""
      }`}
      title={game.withheld ? "Played, but no video linked" : undefined}
    >
      {body}
    </span>
  );
}

/**
 * A game's generators as a score, but only where they matter: it came out level
 * at a 4k each and there are generators recorded to separate the two. Anywhere
 * else there's nothing to say, so the bracket says nothing.
 */
function gensScore(game: KnockoutGameView): string | undefined {
  if (!game.tiebreak) return undefined;
  if (game.aGens === undefined || game.bGens === undefined) return undefined;
  return `${game.aGens}–${game.bGens}`;
}

function MatchCard({ match }: { match: KnockoutMatchView }) {
  const series = match.bestOf > 1;
  // A one-off says its tie-break in a line under the slots; a series has too
  // many games for that and says it on the chips instead.
  const single = series ? undefined : match.games[0];
  const gens = single && gensScore(single);

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      {series && (
        <p className="border-b border-black/5 bg-black/[0.03] px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:bg-white/[0.04]">
          Best of {match.bestOf} · first to {Math.floor(match.bestOf / 2) + 1}
        </p>
      )}
      <Side side={match.a} played={match.played} />
      <div className="border-t border-black/5 dark:border-white/10" />
      <Side side={match.b} played={match.played} />
      {/* A series counts in games, so the hooks live here — one chip per game,
          played or not, which also shows how far the series has left to run. */}
      {series && (
        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-black/5 px-2 py-1.5 dark:border-white/10">
          {match.games.map((game) => (
            <GameChip key={game.number} game={game} />
          ))}
        </div>
      )}
      {/* Level at a 4k each and settled on generators: the winner is already
          tinted above, so this only has to say what settled it. Spoilerable
          like any other score — it gives the result away just as plainly. */}
      {gens && !match.drawn && (
        <p
          data-spoilerable
          className="border-t border-black/5 px-3 py-1 text-center text-xs font-medium text-zinc-500 dark:border-white/10 dark:text-zinc-400"
        >
          A 4k each — through on generators left, {gens}
        </p>
      )}
      {match.drawn && (
        <p className="border-t border-black/5 bg-amber-50 px-3 py-1 text-center text-xs font-medium text-amber-700 dark:border-white/10 dark:bg-amber-500/10 dark:text-amber-400">
          {series
            ? `All ${match.bestOf} games played, series level — to be replayed`
            : gens
              ? `A 4k each, level on generators too, ${gens} — to be replayed`
              : "Level on hooks — to be replayed"}
        </p>
      )}
      {/* Played, hidden, and nothing to watch: same dead end as an unlinked
          group match, so it's marked rather than left looking unplayed. A
          series says it per game on its chips instead. */}
      {!series && match.withheld && !match.video && (
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
      <h2 className="text-xl font-bold tracking-tight">Knockout Stage</h2>
      <p className="mb-4 mt-1 text-sm text-zinc-500">
        More hooks wins. Level at a 4k each, whoever left more generators
        standing goes through — any other tie is replayed.
      </p>

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
