# Tournament data

Each edition of the tournament is one JSON file named after its year, e.g.
`2025.json`. Add a new file to add a new year — it shows up automatically in the
year switcher, newest first. No database, no code changes needed.

## File shape

```jsonc
{
  "year": 2025,
  "title": "Slate DBD Killer World Cup 2025",

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
  ]
}
```

## Scoring

Computed automatically from `results`:

- More hooks wins the match → **3 points**. A tie → **1 point each**.
- Standings sort by points, then total hooks, then name.

## Avatars

Optional. Drop an image in `public/avatars/` (e.g. `public/avatars/trickster.png`)
and set the killer's `avatar` to its path (`/avatars/trickster.png`). Without one,
a coloured initials badge is shown instead. Avatars appear enlarged on hover over
a killer anywhere in the tables and match list.

## About the seed `2025.json`

Groups B–F and their killers were transcribed from Slate's spreadsheet. Group F
still needs its last two killers, and **Group A** needs adding. The three Group B
results are examples to demonstrate the tables and the YouTube link — replace the
scores and the placeholder `video` URL with the real ones.
