"use client";

import {
  memo,
  useActionState,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SeedRef } from "@/lib/tournament";
import {
  field,
  IDLE_SAVE_STATE,
  type EditorFixture,
  type EditorGroup,
  type EditorKnockoutMatch,
  type EditorModel,
  type EditorRound,
  type SchedulePayload,
  type SeedOption,
} from "@/lib/editor";
import { saveTournament } from "@/lib/editor-actions";
import { Avatar } from "@/components/Avatar";

const HOOKS_CLASS =
  "w-14 rounded-md border border-black/15 bg-white px-2 py-1 text-center text-sm tabular-nums dark:border-white/20 dark:bg-zinc-800";
const VIDEO_CLASS =
  "w-full min-w-0 rounded-md border border-black/15 bg-white px-2 py-1 font-mono text-xs dark:border-white/20 dark:bg-zinc-800";
const SELECT_CLASS =
  "w-full min-w-0 rounded-md border border-black/15 bg-white px-2 py-1 text-sm dark:border-white/20 dark:bg-zinc-800";

/** Where a match's score lives while it's being edited, as typed. */
interface ScoreEntry {
  a: string;
  b: string;
  video: string;
}

/** Bucket a match can be dropped into: a round index, or the unscheduled pile. */
const UNSCHEDULED = -1;

// ---------------------------------------------------------------------------
// Group stage
// ---------------------------------------------------------------------------

/**
 * One match-up. The grip is the only draggable part, so the inputs stay
 * clickable and text-selectable; it hands the whole row to the browser as the
 * drag image.
 */
const FixtureRow = memo(function FixtureRow({
  fixture,
  groupIndex,
  score,
  onScoreChange,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  dropBefore,
}: {
  fixture: EditorFixture;
  groupIndex: number;
  score: ScoreEntry;
  onScoreChange: (key: string, patch: Partial<ScoreEntry>) => void;
  onDragStart: (groupIndex: number, key: string) => void;
  onDragEnd: () => void;
  onDragOverRow: (key: string) => void;
  dropBefore: boolean;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const match = `${fixture.a.name} v ${fixture.b.name}`;
  const key = fixture.key;

  return (
    <li
      ref={rowRef}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverRow(key);
      }}
      className={`px-3 py-2 odd:bg-black/[.02] dark:odd:bg-white/[.02] ${
        dropBefore ? "border-t-2 border-red-500" : "border-t-2 border-transparent"
      }`}
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-[auto_1fr_auto_auto_auto_1fr] items-center gap-2 lg:grid-cols-[auto_1fr_auto_auto_auto_1fr_13rem]">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            // Some browsers need data set for the drag to start at all.
            e.dataTransfer.setData("text/plain", key);
            if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 20, 16);
            onDragStart(groupIndex, key);
          }}
          onDragEnd={onDragEnd}
          role="button"
          tabIndex={-1}
          aria-label={`Move ${match} to another round`}
          title="Drag to another round"
          className="cursor-grab select-none px-1 text-zinc-400 active:cursor-grabbing hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ⠿
        </span>

        <span className="flex min-w-0 items-center justify-end gap-2 text-sm">
          <span className="truncate">{fixture.a.name}</span>
          <Avatar killer={fixture.a} size={22} />
        </span>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          name={field.groupHooks(groupIndex, key, "a")}
          value={score.a}
          onChange={(e) => onScoreChange(key, { a: e.target.value })}
          aria-label={`${match} — hooks for ${fixture.a.name}`}
          className={HOOKS_CLASS}
        />
        <span className="text-zinc-400">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          name={field.groupHooks(groupIndex, key, "b")}
          value={score.b}
          onChange={(e) => onScoreChange(key, { b: e.target.value })}
          aria-label={`${match} — hooks for ${fixture.b.name}`}
          className={HOOKS_CLASS}
        />

        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Avatar killer={fixture.b} size={22} />
          <span className="truncate">{fixture.b.name}</span>
        </span>

        <span className="col-span-6 lg:col-span-1">
          <input
            type="url"
            name={field.groupVideo(groupIndex, key)}
            value={score.video}
            onChange={(e) => onScoreChange(key, { video: e.target.value })}
            aria-label={`${match} — video link`}
            placeholder="https://youtu.be/…?t=123"
            className={VIDEO_CLASS}
          />
        </span>
      </div>
    </li>
  );
});

/** A round's list of matches — also the drop target for that round. */
function RoundList({
  title,
  bucket,
  hint,
  warning,
  children,
  isDropTarget,
  onDragOver,
  onDrop,
}: {
  title: string;
  bucket: number;
  hint?: string;
  warning?: string;
  children: React.ReactNode;
  isDropTarget: boolean;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      data-round={bucket}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`border-t border-black/10 dark:border-white/10 ${
        isDropTarget ? "bg-red-500/5" : ""
      }`}
    >
      <h3 className="flex items-baseline justify-between gap-2 px-5 pt-3 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </span>
        {warning ? (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {warning}
          </span>
        ) : (
          hint && <span className="text-xs text-zinc-400">{hint}</span>
        )}
      </h3>
      <ul className="min-h-8">{children}</ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knockout
// ---------------------------------------------------------------------------

function SeedSelect({
  value,
  options,
  label,
  onChange,
}: {
  value: SeedRef;
  options: SeedOption[];
  label: string;
  onChange: (ref: SeedRef) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={SELECT_CLASS}
    >
      {options.map((option) => (
        <option key={option.ref} value={option.ref}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function KnockoutMatchCard({
  match,
  seed,
  seedOptions,
  onSeedChange,
}: {
  match: EditorKnockoutMatch;
  /** First-round matches let you choose the two qualifying positions. */
  seed?: [SeedRef, SeedRef];
  seedOptions: SeedOption[];
  onSeedChange: (side: 0 | 1, ref: SeedRef) => void;
}) {
  const label = `Round ${match.round} match ${match.match}`;

  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        {seed ? (
          <SeedSelect
            value={seed[0]}
            options={seedOptions}
            label={`${label} — first qualifier`}
            onChange={(ref) => onSeedChange(0, ref)}
          />
        ) : (
          <span className="truncate text-sm" title={match.aLabel}>
            {match.aLabel}
          </span>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          name={field.knockoutHooks(match.round, match.match, "a")}
          defaultValue={match.aHooks ?? ""}
          aria-label={`${label} — hooks for the first side`}
          className={HOOKS_CLASS}
        />

        {seed ? (
          <SeedSelect
            value={seed[1]}
            options={seedOptions}
            label={`${label} — second qualifier`}
            onChange={(ref) => onSeedChange(1, ref)}
          />
        ) : (
          <span className="truncate text-sm" title={match.bLabel}>
            {match.bLabel}
          </span>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          name={field.knockoutHooks(match.round, match.match, "b")}
          defaultValue={match.bHooks ?? ""}
          aria-label={`${label} — hooks for the second side`}
          className={HOOKS_CLASS}
        />
      </div>

      {seed && (
        <p className="mt-1 truncate text-xs text-zinc-400">
          {match.aLabel} v {match.bLabel}
        </p>
      )}

      <div className="mt-2">
        <input
          type="url"
          name={field.knockoutVideo(match.round, match.match)}
          defaultValue={match.video ?? ""}
          aria-label={`${label} — video link`}
          placeholder="https://youtu.be/…?t=123"
          className={VIDEO_CLASS}
        />
      </div>

      {match.drawn && (
        <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          Level on hooks — nobody advances from this one.
        </p>
      )}
    </div>
  );
}

function KnockoutSection({
  rounds,
  seeds,
  seedOptions,
  onSeedChange,
}: {
  rounds: EditorRound[];
  seeds: Array<[SeedRef, SeedRef]>;
  seedOptions: SeedOption[];
  onSeedChange: (match: number, side: 0 | 1, ref: SeedRef) => void;
}) {
  if (rounds.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-black/15 p-5 text-sm text-zinc-500 dark:border-white/20">
        <h2 className="mb-1 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Knockout Stage
        </h2>
        No bracket yet — add a <code className="font-mono">knockout.seeds</code>{" "}
        list to the data file (one pair of qualifying positions per first-round
        match) and it&apos;ll appear here.
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-xl font-bold tracking-tight">Knockout Stage</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Pick which qualifying position fills each first-round slot; every later
        round fills itself from the winners as you enter hooks. Slot names update
        when you save.
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-5">
          {rounds.map((round, ri) => (
            <div key={round.name} className="flex w-72 flex-col gap-3">
              <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {round.name}
              </h3>
              {round.matches.map((match, mi) => (
                <KnockoutMatchCard
                  key={`${match.round}.${match.match}`}
                  match={match}
                  seed={ri === 0 ? seeds[mi] : undefined}
                  seedOptions={seedOptions}
                  onSeedChange={(side, ref) => onSeedChange(mi, side, ref)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

function initialScores(model: EditorModel): Record<string, ScoreEntry> {
  const scores: Record<string, ScoreEntry> = {};
  for (const group of model.groups) {
    for (const fixture of group.fixtures) {
      scores[fixture.key] = {
        a: fixture.aHooks?.toString() ?? "",
        b: fixture.bHooks?.toString() ?? "",
        video: fixture.video ?? "",
      };
    }
  }
  return scores;
}

/** Killers appearing twice in one round — a schedule that can't be played. */
function clashIn(round: string[]): string | undefined {
  const seen = new Set<string>();
  for (const key of round) {
    for (const id of key.split("|")) {
      if (seen.has(id)) return id;
      seen.add(id);
    }
  }
  return undefined;
}

/**
 * The local score-entry form: hooks and links per match, matches draggable
 * between rounds, and the knockout seeding. Saving posts the lot to
 * `saveTournament`, which rewrites the data file.
 */
export function ScoreEditor({ model }: { model: EditorModel }) {
  const [state, formAction, pending] = useActionState(
    saveTournament.bind(null, model.year),
    IDLE_SAVE_STATE,
  );

  const [scores, setScores] = useState(() => initialScores(model));
  const [schedules, setSchedules] = useState<SchedulePayload[]>(() =>
    model.groups.map((g) => ({ rounds: g.rounds, unscheduled: g.unscheduled })),
  );
  const [seeds, setSeeds] = useState(model.seeds);

  const dragging = useRef<{ groupIndex: number; key: string } | null>(null);
  const [hover, setHover] = useState<{
    groupIndex: number;
    bucket: number;
    beforeKey?: string;
  } | null>(null);

  const fixturesByGroup = useMemo(
    () =>
      model.groups.map(
        (g) => new Map(g.fixtures.map((f) => [f.key, f] as const)),
      ),
    [model.groups],
  );

  const onScoreChange = useCallback(
    (key: string, patch: Partial<ScoreEntry>) =>
      setScores((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } })),
    [],
  );

  const onDragStart = useCallback((groupIndex: number, key: string) => {
    dragging.current = { groupIndex, key };
  }, []);

  const onDragEnd = useCallback(() => {
    dragging.current = null;
    setHover(null);
  }, []);

  /** Move the dragged match into `bucket`, before `beforeKey` if given. */
  const drop = useCallback((bucket: number, beforeKey?: string) => {
    const drag = dragging.current;
    dragging.current = null;
    setHover(null);
    if (!drag) return;

    setSchedules((prev) =>
      prev.map((schedule, gi) => {
        if (gi !== drag.groupIndex) return schedule;

        const lists = [...schedule.rounds.map((r) => [...r]), [...schedule.unscheduled]];
        const target = bucket === UNSCHEDULED ? lists.length - 1 : bucket;
        if (!lists[target]) return schedule;

        for (const list of lists) {
          const at = list.indexOf(drag.key);
          if (at !== -1) list.splice(at, 1);
        }

        const before = beforeKey ? lists[target].indexOf(beforeKey) : -1;
        lists[target].splice(before === -1 ? lists[target].length : before, 0, drag.key);

        return { rounds: lists.slice(0, -1), unscheduled: lists[lists.length - 1] };
      }),
    );
  }, []);

  const addRound = (groupIndex: number) =>
    setSchedules((prev) =>
      prev.map((schedule, gi) =>
        gi === groupIndex
          ? { ...schedule, rounds: [...schedule.rounds, []] }
          : schedule,
      ),
    );

  const onSeedChange = (match: number, side: 0 | 1, ref: SeedRef) =>
    setSeeds((prev) =>
      prev.map((pair, i) => {
        if (i !== match) return pair;
        const next: [SeedRef, SeedRef] = [...pair];
        next[side] = ref;
        return next;
      }),
    );

  return (
    <form action={formAction}>
      {/* The layout and seeding travel as JSON — everything else is a field. */}
      {schedules.map((schedule, gi) => (
        <input
          key={gi}
          type="hidden"
          name={field.groupSchedule(gi)}
          value={JSON.stringify(schedule)}
        />
      ))}
      <input type="hidden" name={field.seeds} value={JSON.stringify(seeds)} />

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        {model.groups.map((group, gi) => (
          <GroupSection
            key={group.name}
            group={group}
            groupIndex={gi}
            schedule={schedules[gi]}
            fixtures={fixturesByGroup[gi]}
            scores={scores}
            onScoreChange={onScoreChange}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            hover={hover?.groupIndex === gi ? hover : null}
            setHover={setHover}
            onDrop={drop}
            onAddRound={() => addRound(gi)}
          />
        ))}
      </div>

      <KnockoutSection
        rounds={model.knockout}
        seeds={seeds}
        seedOptions={model.seedOptions}
        onSeedChange={onSeedChange}
      />

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

function GroupSection({
  group,
  groupIndex,
  schedule,
  fixtures,
  scores,
  onScoreChange,
  onDragStart,
  onDragEnd,
  hover,
  setHover,
  onDrop,
  onAddRound,
}: {
  group: EditorGroup;
  groupIndex: number;
  schedule: SchedulePayload;
  fixtures: Map<string, EditorFixture>;
  scores: Record<string, ScoreEntry>;
  onScoreChange: (key: string, patch: Partial<ScoreEntry>) => void;
  onDragStart: (groupIndex: number, key: string) => void;
  onDragEnd: () => void;
  hover: { bucket: number; beforeKey?: string } | null;
  setHover: (
    hover: { groupIndex: number; bucket: number; beforeKey?: string } | null,
  ) => void;
  onDrop: (bucket: number, beforeKey?: string) => void;
  onAddRound: () => void;
}) {
  const played = group.fixtures.filter(
    (f) => scores[f.key]?.a !== "" && scores[f.key]?.b !== "",
  ).length;

  const buckets: Array<{ bucket: number; title: string; keys: string[] }> = [
    ...schedule.rounds.map((keys, i) => ({
      bucket: i,
      title: `Round ${i + 1}`,
      keys,
    })),
    ...(schedule.unscheduled.length > 0
      ? [{ bucket: UNSCHEDULED, title: "Not scheduled", keys: schedule.unscheduled }]
      : []),
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="flex items-baseline justify-between border-b border-black/10 bg-zinc-100 px-5 py-3 font-bold dark:border-white/10 dark:bg-zinc-800">
        {group.name}
        <span className="text-xs font-medium text-zinc-500">
          {played}/{group.fixtures.length} played
        </span>
      </h2>

      {buckets.map(({ bucket, title, keys }) => {
        const clash = clashIn(keys);
        return (
          <RoundList
            key={bucket}
            title={title}
            bucket={bucket}
            hint={keys.length === 0 ? "drop a match here" : undefined}
            warning={
              clash
                ? `${fixtures.get(keys.find((k) => k.includes(clash))!)?.a.name ?? clash} plays twice`
                : undefined
            }
            isDropTarget={hover?.bucket === bucket}
            onDragOver={() => setHover({ groupIndex, bucket })}
            onDrop={() => onDrop(bucket, hover?.beforeKey)}
          >
            {keys.map((key) => {
              const fixture = fixtures.get(key);
              if (!fixture) return null;
              return (
                <FixtureRow
                  key={key}
                  fixture={fixture}
                  groupIndex={groupIndex}
                  score={scores[key]}
                  onScoreChange={onScoreChange}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOverRow={(beforeKey) =>
                    setHover({ groupIndex, bucket, beforeKey })
                  }
                  dropBefore={hover?.bucket === bucket && hover.beforeKey === key}
                />
              );
            })}
          </RoundList>
        );
      })}

      <div className="border-t border-black/10 px-5 py-2 dark:border-white/10">
        <button
          type="button"
          onClick={onAddRound}
          className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          + Add a round
        </button>
      </div>
    </section>
  );
}
