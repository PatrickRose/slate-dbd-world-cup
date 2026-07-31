"use client";

import type { SpoilerState, VideoSummary } from "@/lib/spoilers";

/**
 * The spoiler-mode control: one switch, and behind it the list of videos you've
 * watched.
 *
 * Closed by default — spoiler mode is off for most visitors, so it costs a
 * single line until someone wants it. Videos tick in any order, because plenty
 * of people watch out of order; "up to here" covers the front-to-back case in
 * one click.
 */
export function SpoilerBar({
  videos,
  state,
  open,
  onOpenChange,
  onChange,
}: {
  videos: VideoSummary[];
  state: SpoilerState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (next: SpoilerState) => void;
}) {
  const watchedCount = videos.filter((v) => state.watched.has(v.id)).length;

  const setWatched = (ids: Iterable<string>) =>
    onChange({ on: state.on, watched: new Set(ids) });

  const toggleVideo = (id: string) => {
    const next = new Set(state.watched);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setWatched(next);
  };

  const upTo = (index: number) =>
    setWatched([
      ...state.watched,
      ...videos.slice(0, index + 1).map((v) => v.id),
    ]);

  return (
    <section
      aria-label="Spoiler mode"
      className={`mb-5 rounded-xl border ${
        state.on
          ? "border-red-600/40 dark:border-red-500/40"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
        <label className="inline-flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={state.on}
            onChange={(e) => {
              onChange({ on: e.target.checked, watched: state.watched });
              if (!e.target.checked) onOpenChange(false);
            }}
            className="peer sr-only"
          />
          <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-300 transition-colors peer-checked:bg-red-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red-600 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4 dark:bg-zinc-600" />
          <span className="text-sm font-semibold">Spoiler mode</span>
        </label>

        {state.on && (
          <>
            <span className="text-xs text-zinc-500 tabular-nums">
              {watchedCount === 0
                ? "No videos ticked — every result is hidden"
                : `${watchedCount} of ${videos.length} videos watched`}
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(!open)}
              aria-expanded={open}
              aria-controls="spoiler-videos"
              className="ml-auto rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              {open ? "Close" : "Change"}
            </button>
          </>
        )}
      </div>

      {state.on && open && (
        <div
          id="spoiler-videos"
          className="flex flex-col gap-2 border-t border-black/10 px-3 py-3 dark:border-white/10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Which videos have you watched?
            </h2>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setWatched(videos.map((v) => v.id))}
                className="rounded-full border border-black/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                Tick all
              </button>
              <button
                type="button"
                onClick={() => setWatched([])}
                className="rounded-full border border-black/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-black/5 dark:border-white/20 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          <ul className="flex flex-col gap-1.5">
            {videos.map((video, i) => {
              const watched = state.watched.has(video.id);
              return (
                // Wrapping rather than truncating: on a narrow screen the
                // labels are the whole point, so the controls drop to their own
                // line instead of squeezing "Round 1 · Groups A & B" to an
                // ellipsis.
                <li
                  key={video.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-2.5 py-1.5 ${
                    watched
                      ? "border-green-600/30 bg-green-100/50 dark:border-green-500/30 dark:bg-green-500/10"
                      : "border-black/5 bg-black/[.02] dark:border-white/5 dark:bg-white/[.03]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleVideo(video.id)}
                    aria-pressed={watched}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded border text-[0.7rem] font-bold ${
                        watched
                          ? "border-transparent bg-green-600 text-white"
                          : "border-black/20 text-transparent dark:border-white/25"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {video.label}
                      </span>
                      <span className="block font-mono text-[0.7rem] text-zinc-500">
                        {video.matches} matches
                        <span className="hidden sm:inline"> · {video.id}</span>
                      </span>
                    </span>
                  </button>

                  <span className="ml-auto flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => upTo(i)}
                      title="Tick this one and everything above it"
                      className="rounded-full border border-black/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide text-zinc-500 uppercase transition-colors hover:bg-black/5 hover:text-zinc-800 dark:border-white/15 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                    >
                      up to here
                    </button>

                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open this stream on YouTube"
                      className="font-mono text-[0.7rem] whitespace-nowrap text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Open ↗
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-zinc-500">
            Results appear as you tick off the videos they&apos;re in. Matches
            with no video linked stay hidden while spoiler mode is on.
          </p>
        </div>
      )}
    </section>
  );
}
