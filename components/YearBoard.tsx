"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  filterTournament,
  type SpoilerState,
  type VideoSummary,
} from "@/lib/spoilers";
import {
  serverSpoilerState,
  spoilerSnapshot,
  subscribeToSpoilers,
  writeSpoilerState,
} from "@/lib/spoiler-store";
import {
  buildGroupViews,
  buildKnockout,
  type Tournament,
} from "@/lib/tournament";
import { Bracket } from "./Bracket";
import { GroupCard } from "./GroupCard";
import { SpoilerBar } from "./SpoilerBar";

/**
 * The tables and the bracket, rebuilt from whichever results the viewer is
 * allowed to see.
 *
 * This is the client boundary, and it's here because spoiler mode has to react
 * to a click: ticking a video re-computes every standings table and the whole
 * knockout. The page itself is still rendered to static HTML with every result
 * in it — which is what a visitor with spoiler mode off, or with JavaScript
 * disabled, gets.
 */
export function YearBoard({
  tournament,
  videos,
  children,
}: {
  tournament: Tournament;
  videos: VideoSummary[];
  /** Server-rendered content to sit between the control and the tables. */
  children?: React.ReactNode;
}) {
  const year = tournament.year;

  // Rendered as "off" on the server and through hydration, then React swaps in
  // the stored preference. Until that second render lands, the results the
  // server put in the HTML are held invisible by the pre-paint script's
  // attribute — see `prepaintScript` and `app/globals.css`.
  const getSnapshot = useCallback(() => spoilerSnapshot(year), [year]);
  const stored = useSyncExternalStore(
    subscribeToSpoilers,
    getSnapshot,
    serverSpoilerState,
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Safe to lift the mask only once what's on screen is what this viewer is
  // allowed to see: that's when the render matches the stored snapshot rather
  // than the server's placeholder. Runs after every commit, since the condition
  // is what decides, not a dependency list.
  useEffect(() => {
    if (stored === getSnapshot())
      delete document.documentElement.dataset.spoilers;
  });

  const known = useMemo(() => new Set(videos.map((v) => v.id)), [videos]);

  // Ids that aren't in the data any more — a re-uploaded stream, say — are
  // dropped rather than counted against a total they're no longer part of.
  const state: SpoilerState = useMemo(
    () => ({
      on: stored.on,
      watched: new Set([...stored.watched].filter((id) => known.has(id))),
    }),
    [stored, known],
  );

  const { groups, knockout } = useMemo(() => {
    if (!state.on) {
      const views = buildGroupViews(tournament);
      return { groups: views, knockout: buildKnockout(tournament, views) };
    }
    // The whole feature, in three lines: drop the results this viewer hasn't
    // earned, then build the page from what's left. The unfiltered tournament
    // goes along only so the UI can offer the videos it's holding back and say
    // how many there are.
    const visible = filterTournament(tournament, state.watched);
    const views = buildGroupViews(visible, tournament);
    return {
      groups: views,
      knockout: buildKnockout(visible, views, tournament),
    };
  }, [state, tournament]);

  return (
    <>
      <SpoilerBar
        videos={videos}
        state={state}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChange={(next) => writeSpoilerState(year, next)}
      />

      {children}

      {/* Three across once there's room for it: below the `wide` breakpoint a
          third column squeezes the standings enough that names start to
          truncate. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 wide:grid-cols-3">
        {groups.map((group) => (
          <GroupCard key={group.name} group={group} />
        ))}
      </div>

      <Bracket rounds={knockout} />
    </>
  );
}
