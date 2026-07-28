"use client";

import { useActionState } from "react";
import type { Killer, KnockoutMatch } from "@/lib/tournament";
import {
  field,
  IDLE_SAVE_STATE,
  type EditorFixture,
  type EditorGroup,
  type EditorModel,
  type EditorRound,
} from "@/lib/editor";
import { saveTournament } from "@/lib/editor-actions";
import { Avatar } from "@/components/Avatar";

const HOOKS_CLASS =
  "w-14 rounded-md border border-black/15 bg-white px-2 py-1 text-center text-sm tabular-nums dark:border-white/20 dark:bg-zinc-800";
const VIDEO_CLASS =
  "w-full min-w-0 rounded-md border border-black/15 bg-white px-2 py-1 font-mono text-xs dark:border-white/20 dark:bg-zinc-800";
const SELECT_CLASS =
  "w-full min-w-0 rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800";

function HooksInput({
  name,
  value,
  label,
}: {
  name: string;
  value?: number;
  label: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      name={name}
      defaultValue={value ?? ""}
      aria-label={label}
      className={HOOKS_CLASS}
    />
  );
}

function VideoInput({
  name,
  value,
  label,
}: {
  name: string;
  value?: string;
  label: string;
}) {
  return (
    <input
      type="url"
      name={name}
      defaultValue={value ?? ""}
      aria-label={label}
      placeholder="https://youtu.be/…?t=123"
      className={VIDEO_CLASS}
    />
  );
}

function FixtureRow({
  fixture,
  groupIndex,
  fixtureIndex,
}: {
  fixture: EditorFixture;
  groupIndex: number;
  fixtureIndex: number;
}) {
  const match = `${fixture.a.name} v ${fixture.b.name}`;

  return (
    <li className="px-4 py-2 odd:bg-black/[.02] dark:odd:bg-white/[.02]">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-2 lg:grid-cols-[1fr_auto_auto_auto_1fr_13rem]">
        <span className="flex min-w-0 items-center justify-end gap-2 text-sm">
          <span className="truncate">{fixture.a.name}</span>
          <Avatar killer={fixture.a} size={22} />
        </span>

        <HooksInput
          name={field.groupHooks(groupIndex, fixtureIndex, "a")}
          value={fixture.aHooks}
          label={`${match} — hooks for ${fixture.a.name}`}
        />
        <span className="text-zinc-400">–</span>
        <HooksInput
          name={field.groupHooks(groupIndex, fixtureIndex, "b")}
          value={fixture.bHooks}
          label={`${match} — hooks for ${fixture.b.name}`}
        />

        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Avatar killer={fixture.b} size={22} />
          <span className="truncate">{fixture.b.name}</span>
        </span>

        <span className="col-span-5 lg:col-span-1">
          <VideoInput
            name={field.groupVideo(groupIndex, fixtureIndex)}
            value={fixture.video}
            label={`${match} — video link`}
          />
        </span>
      </div>
    </li>
  );
}

function GroupSection({
  group,
  groupIndex,
}: {
  group: EditorGroup;
  groupIndex: number;
}) {
  const played = group.fixtures.filter(
    (f) => f.aHooks !== undefined && f.bHooks !== undefined,
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="flex items-baseline justify-between border-b border-black/10 bg-zinc-100 px-5 py-3 font-bold dark:border-white/10 dark:bg-zinc-800">
        {group.name}
        <span className="text-xs font-medium text-zinc-500">
          {played}/{group.fixtures.length} played
        </span>
      </h2>
      <ul>
        {group.fixtures.map((fixture, fixtureIndex) => (
          <FixtureRow
            key={`${fixture.a.id}-${fixture.b.id}`}
            fixture={fixture}
            groupIndex={groupIndex}
            fixtureIndex={fixtureIndex}
          />
        ))}
      </ul>
    </section>
  );
}

function SlotSelect({
  name,
  value,
  placeholder,
  killers,
  label,
}: {
  name: string;
  value?: string;
  placeholder?: string;
  killers: Killer[];
  label: string;
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      aria-label={label}
      className={SELECT_CLASS}
    >
      <option value="">{placeholder ?? "Not decided yet"}</option>
      {killers.map((killer) => (
        <option key={killer.id} value={killer.id}>
          {killer.name}
        </option>
      ))}
    </select>
  );
}

function KnockoutMatchCard({
  match,
  roundIndex,
  matchIndex,
  killers,
}: {
  match: KnockoutMatch;
  roundIndex: number;
  matchIndex: number;
  killers: Killer[];
}) {
  const label = `Match ${matchIndex + 1}`;

  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <SlotSelect
          name={field.knockoutSlot(roundIndex, matchIndex, "a")}
          value={match.a}
          placeholder={match.aLabel}
          killers={killers}
          label={`${label} — first killer`}
        />
        <HooksInput
          name={field.knockoutHooks(roundIndex, matchIndex, "a")}
          value={match.aHooks}
          label={`${label} — hooks for the first killer`}
        />
        <SlotSelect
          name={field.knockoutSlot(roundIndex, matchIndex, "b")}
          value={match.b}
          placeholder={match.bLabel}
          killers={killers}
          label={`${label} — second killer`}
        />
        <HooksInput
          name={field.knockoutHooks(roundIndex, matchIndex, "b")}
          value={match.bHooks}
          label={`${label} — hooks for the second killer`}
        />
      </div>
      <div className="mt-2">
        <VideoInput
          name={field.knockoutVideo(roundIndex, matchIndex)}
          value={match.video}
          label={`${label} — video link`}
        />
      </div>
    </div>
  );
}

function KnockoutSection({
  rounds,
  killers,
}: {
  rounds: EditorRound[];
  killers: Killer[];
}) {
  if (rounds.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-xl font-bold tracking-tight">Knockout Stage</h2>
      <p className="mb-4 text-sm text-zinc-500">
        The bracket shape and the &ldquo;Winner Group A&rdquo;-style
        placeholders are authored in the JSON — here you pick who filled each
        slot and enter their hooks.
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-5">
          {rounds.map((round, roundIndex) => (
            <div key={round.name} className="flex w-72 flex-col gap-3">
              <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {round.name}
              </h3>
              {round.matches.map((match, matchIndex) => (
                <KnockoutMatchCard
                  key={`${round.name}-${matchIndex}`}
                  match={match}
                  roundIndex={roundIndex}
                  matchIndex={matchIndex}
                  killers={killers}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The local score-entry form. Every input is uncontrolled and seeded from the
 * JSON; saving posts the lot to `saveTournament`, which rewrites the data file.
 * Clearing both hook fields of a match turns it back into an upcoming fixture.
 */
export function ScoreEditor({ model }: { model: EditorModel }) {
  const [state, formAction, pending] = useActionState(
    saveTournament.bind(null, model.year),
    IDLE_SAVE_STATE,
  );

  return (
    <form action={formAction}>
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        {model.groups.map((group, groupIndex) => (
          <GroupSection
            key={group.name}
            group={group}
            groupIndex={groupIndex}
          />
        ))}
      </div>

      <KnockoutSection rounds={model.knockout} killers={model.killers} />

      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-black/10 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-white/10 dark:bg-zinc-950/90">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {pending ? "Saving…" : `Save data/${model.year}.json`}
          </button>

          {state.status !== "idle" && state.message && (
            <p
              role="status"
              className={`text-sm ${
                state.status === "saved"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {state.message}
            </p>
          )}
        </div>

        {state.problems && state.problems.length > 0 && (
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-red-700 dark:text-red-400">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
