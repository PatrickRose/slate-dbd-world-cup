# Tournament data

Each edition of the tournament is one JSON file named after its year, e.g.
`2025.json`. Add a new file to add a new year — it shows up automatically in the
year switcher, newest first. No database, no code changes needed.

## File shape

```jsonc
{
  "year": 2025,
  "title": "Slate DBD Killer World Cup 2025",

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

## About the seed `2025.json`

Groups B–F and their killers were transcribed from Slate's spreadsheet. Group F
still needs its last two killers, and **Group A** needs adding.

The **match scores and the knockout bracket are placeholder examples** so the
through/eliminated colouring, the YouTube links and the bracket are all visible —
Group B is played out in full (giving green/red/neutral rows), and the knockout
is a made-up run to a champion. Replace all of it, plus the placeholder `video`
URL, with the real results.
