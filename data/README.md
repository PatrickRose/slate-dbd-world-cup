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
  // the fixtures are generated automatically, so you only enter results.
  "groups": [
    { "name": "Group B", "killers": ["trickster", "ghostie", "executioner"] }
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

  // Optional single-elimination bracket, earliest round first. Each round has
  // any number of matches. A slot can be a killer id, or a placeholder label
  // for a spot that isn't decided yet.
  "knockout": [
    {
      "name": "Quarter-finals",
      "matches": [
        {
          "a": "executioner",      // killer id, OR omit and use "aLabel"
          "b": "doctor",
          "aLabel": "Winner Group A", // shown when the killer isn't known yet
          "aHooks": 12,            // omit both hooks until the match is played
          "bHooks": 8,
          "video": "https://youtu.be/VIDEO_ID?t=1234"
        }
      ]
    }
  ]
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

## Entering results without editing JSON by hand

Run the site locally and every year gets an editor at `/<year>/edit`:

```bash
npm run dev
# then open http://localhost:3000/2026/edit
# (or use the dashed "Edit scores (local only)" link on the year page)
```

It lists every group fixture with two hook boxes and a video link, plus a
knockout section where you pick who filled each bracket slot. Hitting **Save**
rewrites `data/<year>.json` in place, so review it with `git diff` and commit it
like any other change.

- Leave both hook boxes empty for a match that hasn't been played — clearing a
  score again deletes that result and the match goes back to being an upcoming
  fixture.
- A video link needs a score alongside it, and both hook boxes must be filled or
  both empty. The editor refuses to save and lists what to fix rather than
  writing a half-entered match.
- Only `results` and `knockout` scores/slots are written. The killer list, the
  groups, the bracket shape and its `aLabel` / `bLabel` placeholders stay
  hand-authored here — as does creating the file for a brand new year.
- Everything the editor doesn't own keeps its exact formatting, so diffs stay
  small. The first save does normalise `results` into fixture order, with each
  match written in the same killer order the tables use.

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

Results are real and go in as the matches air. The knockout rounds are in place
with empty matches, ready for slots and scores once the groups finish.
