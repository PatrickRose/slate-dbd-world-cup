# Tournament data

Each edition of the tournament is one JSON file named after its year, e.g.
`2025.json`. Add a new file to add a new year — it shows up automatically in the
year switcher, newest first. No database, no code changes needed.

**The filename is what sets the year.** Renaming `2026.json` to `2027.json` moves
the tournament to 2027 — URL, year switcher and heading all follow. The file
itself holds no year and no title: the heading is generated as
`Slate DBD Killer World Cup <year>`, so a rename is the whole job.

## File shape

```jsonc
{
  // No "year" or "title" — both come from the filename.

  // How many killers advance directly from each group. Defaults to 2.
  "advancePerGroup": 2,
  // How many of the best third-placed killers (ranked across all groups by
  // points then hooks) also advance. Defaults to 0.
  "bestThirdPlace": 2,

  // Every killer that appears in any group this year.
  "killers": [
    // "id" is a stable slug used to reference the killer everywhere.
    // "avatar" is optional — see "Avatars" below.
    { "id": "trickster", "name": "Trickster", "avatar": "/avatars/trickster.png" }
  ],

  // Each group lists its killers by id. Every pair plays once (round-robin);
  // the match-ups are generated automatically, so you only enter results.
  "groups": [
    {
      "name": "Group B",
      "killers": ["trickster", "clown", "ghostie", "wraith"],
      // Which round each match is played in — one list per round. Optional:
      // leave it out and a schedule is generated (see "Rounds" below). The
      // editor writes this whenever you drag a match to another round.
      "rounds": [
        [["trickster", "clown"], ["ghostie", "wraith"]],
        [["trickster", "ghostie"], ["clown", "wraith"]],
        [["trickster", "wraith"], ["clown", "ghostie"]]
      ]
    }
  ],

  // One entry per match played. Omit matches that haven't happened yet —
  // they still appear as upcoming fixtures.
  "results": [
    {
      "group": "Group B",   // must match a group name above
      "a": "trickster",     // killer id
      "b": "clown",         // killer id
      "aHooks": 12,         // hooks scored by "a"
      "bHooks": 8,          // hooks scored by "b"
      // Full YouTube URL, ideally timestamped. Optional — leave it out until
      // the video is up and the score shows as a plain (non-clickable) badge.
      "video": "https://youtu.be/VIDEO_ID?t=1234"
    }
  ],

  // Optional single-elimination bracket. You only say who plays whom in the
  // first round, as qualifying *positions* — the rest of the bracket is built
  // by advancing winners. See "Knockout bracket" below.
  "knockout": {
    "seeds": [
      ["Group A:1", "best3:1"],   // Group A's winner v the best third-placed
      ["Group B:1", "Group C:2"]  // Group B's winner v Group C's runner-up
    ],
    // One entry per knockout match played, addressed by its place in the
    // bracket. Round 1 is the seeded round.
    "scores": [
      {
        "round": 1,
        "match": 2,
        "aHooks": 12,   // hooks for the first slot of that match
        "bHooks": 8,
        "video": "https://youtu.be/VIDEO_ID?t=1234"
      }
    ]
  }
}
```

## Scoring & advancement

Computed automatically from `results`:

- More hooks wins the match → **3 points**. A tie → **1 point each**.
- Standings sort by points, then total hooks, then name.
- **Through / eliminated** colouring is worked out mathematically: a killer turns
  green once they've clinched a qualifying place, and red once it's impossible
  for them to reach one (this can happen mid-group after enough losses). Until
  it's decided, the row stays neutral. Qualification = top `advancePerGroup` per
  group plus the best `bestThirdPlace` third-placed killers overall.

## Rounds

Every pair in a group plays once, and those match-ups are split into rounds —
one match per killer per round, the way Slate's spreadsheet columns are laid
out. Rounds show as headings under each group's table on the year page.

You don't have to write the schedule. Leave `rounds` out of a group and one is
generated: the opening round pairs the killer list up two at a time (1v2, 3v4,
5v6), and later rounds rotate from there. So the quickest way to make Round 1
match the spreadsheet is to list a group's `killers` in the spreadsheet's order.

Later rounds won't necessarily match — **drag a match to the round it actually
belongs in** using the editor's handle, and the layout is written back here. Two
things to know:

- Which side of a match a killer is on doesn't matter anywhere. `["a", "b"]` and
  `["b", "a"]` are the same match, and results are found either way round.
- A match-up no round mentions isn't lost: it shows under "Not scheduled" on the
  year page and as a bucket in the editor, so adding a killer to a group can
  never drop matches. Empty rounds are discarded when saving.

## Knockout bracket

Only the first round is authored, as `knockout.seeds` — one pair of qualifying
*positions* per match:

- `"Group A:1"` is Group A's winner, `"Group A:2"` its runner-up, and so on up to
  `advancePerGroup`.
- `"best3:1"` is the best third-placed killer across all groups, `"best3:2"` the
  next, up to `bestThirdPlace`.

Everything else follows from the results:

- A position resolves to a killer once that group has finished playing (and
  `best3:*` once every group has, since it's ranked across all of them). Until
  then the slot shows what it's waiting for — "Winner Group A", "Best 3rd place".
- Each later round is half the size of the one before, filled by the winners
  under it. Round names come from how many are left: Round of 16, Quarter-finals,
  Semi-finals, Final.
- A match level on hooks leaves the slot above it empty and says so, rather than
  guessing who goes through. Replay it or nudge the hooks to settle it.

Every position can only be seeded once, so the editor won't save a bracket with
the same qualifier in two slots — swap the pair over instead.

## Spoiler mode

Viewers can turn on spoiler mode and tick off the videos they've watched; the
page then shows the tournament **as it stood at those videos**. It works by
filtering `results` (and `knockout.scores`) down to the matches whose video has
been ticked, and everything else follows from that — standings shrink, nobody
clinches early, and bracket slots go back to saying "Winner Group A".

That makes the `video` field load-bearing in a way it wasn't before:

- **A match is hidden until the video it's in is ticked.** Matches are grouped by
  YouTube id, so all three matches on one stream reveal together — a timestamp
  makes no difference to that.
- **A result with no `video` can never be shown in spoiler mode.** There's
  nothing to watch, so there's no way to have earned it. The row shows a hatched
  "Hidden" marker instead of a score.
- Because of that, a group holding an unlinked result never *completes* while
  spoiler mode is on, so its qualifying positions stay unresolved — and since
  `best3:*` ranks across every group, one unlinked result anywhere leaves the
  best-third bracket slots unresolved too. If that starts to matter, the fix is
  to add the video link, not to change the data.

The video list is labelled from what each video covers ("Round 2 · Groups A–C ·
9 matches"), derived from the results and the round layout — there's nothing to
author. Videos are listed in playing order: group stage by round, then knockout.

The preference lives in `localStorage` under `spoilers:<year>`, so it's per
edition and per browser. Spoiler mode is **off by default**, and a visitor with
JavaScript disabled gets the full page exactly as before.

## Entering results without editing JSON by hand

Run the site locally and every year gets an editor at `/<year>/edit`:

```bash
npm run dev
# then open http://localhost:3000/2026/edit
# (or use the dashed "Edit scores (local only)" link on the year page)
```

It lists every group match round by round, with two hook boxes and a video link
each, then the knockout bracket. Hitting **Save** rewrites `data/<year>.json` in
place, so review it with `git diff` and commit it like any other change.

- Leave both hook boxes empty for a match that hasn't been played — clearing a
  score again deletes that result and the match goes back to being an upcoming
  fixture.
- **Drag a match by its ⠿ handle** to move it between rounds, or to reorder one
  within a round. Anything you've typed moves with it. "+ Add a round" makes room
  at the end if you need to spread matches out further.
- If a killer ends up twice in the same round the round says so — it's a warning,
  not a block, so you can shuffle freely and fix it as you go.
- The knockout's first-round slots are dropdowns of qualifying positions; later
  rounds show who's coming through and just take the score. Slot names refresh
  when you save.
- A video link needs a score alongside it, and both hook boxes must be filled or
  both empty. The editor refuses to save and lists what to fix rather than
  writing a half-entered match.
- The editor writes `groups[].rounds`, `results` and `knockout`. The killer list
  and the group memberships stay hand-authored here — as does creating the file
  for a brand new year.
- Everything the editor doesn't own keeps its exact formatting, so diffs stay
  small. Results are written in schedule order, so a saved file reads round by
  round.

**The editor is local-only and never reaches the deployed site.** Its page file
is `app/[year]/edit/page.dev.tsx`, and `next.config.ts` only registers the
`dev.tsx` extension as a page outside production builds — so `next build`
produces no `/[year]/edit` route, no editor JavaScript and no link to it. The
save action also refuses to run if `NODE_ENV` is `production`.

## Avatars

Optional. Drop an image in `public/avatars/` (e.g. `public/avatars/trickster.png`)
and set the killer's `avatar` to its path (`/avatars/trickster.png`). Without one,
a coloured initials badge is shown instead. Avatars appear enlarged on hover over
a killer anywhere in the tables and match list.

The bundled avatars are the killers' official character portraits
(`K## The<Name> Portrait`), pulled from the Dead by Daylight Wiki
([fandom](https://deadbydaylight.fandom.com) / [wiki.gg](https://deadbydaylight.wiki.gg))
and stored 200×200 in `public/avatars/`. They're game art © Behaviour Interactive,
used here for a non-commercial fan tracker. Swap in your own files any time.

## About `2026.json`

All seven groups (A–G) and their killers were transcribed from Slate's
spreadsheet — 42 killers across the groups. That's every current Dead by
Daylight killer except **The Animatronic**, which sits out the tournament.

Results are real and go in as the matches air.

Each stream covers one round per group, three matches at a time, so **rounds 1
and 2 of every group are taken from the videos** — the matches are grouped
exactly as they were played. Rounds 3–5 are a generated completion of the
round-robin; drag them into place as the real schedule is announced.

16 qualify (7 group winners, 7 runners-up and the 2 best third-placed), making a
Round of 16, seeded the way Slate set it up: the two best third-placed killers
meet the winners of A and B, then runners-up pair off with winners from the other
end of the alphabet — G's runner-up v C's winner, F's v D's, and so on. Because 7
winners can't each face a runner-up when two of the sixteen slots go to
third-placed killers, one match is runner-up v runner-up.
