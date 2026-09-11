---
change_id: cast-relationship-map
title: Visual relationship map — circle and person views
status: implemented
created: 2026-09-11
updated: 2026-09-11
archived_at: null
---

## Notes

FR-007's optional diagram view, pulled out of Parked. The list stays the default view;
the map is an alternative the reader switches to from the cast section head:
`CAST · 6 · LIST · CIRCLE · PERSON`.

## Settled by working through a mockup, not by argument

`mockup-cast-map.html` in this folder is the reference. Every rule below came out of
drawing it and looking, and several reversed an earlier decision that looked right on
paper.

- **Labels always render.** Never hidden, never truncated. This is the decision the rest
  follows from.
- **The canvas is sized by the cast, not by the screen.** Each node gets a fixed slice of
  arc (132 px, which fits `ANTAGONIST`), so radius is `n × arc / 2π`. The frame scrolls in
  both axes. A longer reader-defined type forces a bigger arc and a bigger canvas.
- **Circle order is not arbitrary.** Connected characters sit next to each other, so most
  edges are short arcs rather than chords through the middle. Sorting, not an algorithm —
  the cheapest legibility win available.
- **Edge labels sit at the midpoint OF THEIR OWN EDGE.** An earlier version placed them at
  a fixed fraction from the `a` end, which piled every label onto whichever character
  happened to be stored as `a` — in a dense graph, one hub. Looks correct until the data
  has a hub.
- **Labels are rotated to the edge angle**, and any label past ±90° is flipped a half turn
  so text never reads upside down.
- **Two defences against strikethrough, because one is not enough.** A gap in the edge
  handles the label's own line; a paper-coloured halo (`paint-order: stroke fill`) handles
  OTHER edges crossing underneath, and short edges where no gap fits. The gap alone looks
  sufficient until the graph has crossings.
- **Gap thresholds:** cut the gap when at least 10% of the edge remains each side; cap it
  at 25% per side so a word never eats the whole line. Padding around the word is small
  (~2.5 px per side) — the halo already does the protecting.
- **Minimum edge length follows from the longest label on it.** Same relationship as the
  arc rule, measured along the line instead of around the rim.

## Defaults chosen to avoid blocking, changeable

- Arc per node: 132 px.
- Characters with no connections: shown (hollow dot, name in italics). The list renders
  nothing for them; the map cannot, without lying about the cast.
- Default focus for the person view: the character with the most connections.

## Scope

Not in scope: colour-coding types (the palette is paper/ink plus one red), hover states,
pan/zoom controls, force-directed layout, any client-side layout library. The layout is a
pure function rendered to SVG on the server; navigation between people is plain links.

## Settled during implementation, after the brief was written

The brief above came out of the mockup. These came out of running it against real data,
and two of them were defects the mockup could not have shown, because its fictional cast
never connected the same pair twice.

- **One edge per PAIR, not per relationship.** Two characters can be connected more than
  once — "mieszka z" AND "romantic" between the same two people. Drawn as separate edges
  they land in exactly the same place on the rim, one hiding the other, and they give that
  neighbour two spokes in the person view, where they render as two different people.
  `toLinks` now keys on the unordered pair.
- **Multiple type names stack, not join.** `"mieszka z · romantic"` on one line reads as a
  single long type. Each name takes its own line on the edge, and the gap cut for them
  clears the WIDEST rather than the first.
- **Spokes spread over the whole circle.** A floor of three left a two-connection view with
  one spoke up, one into a corner, and two thirds of the frame empty.
- **The canvas is cropped to what is drawn.** Sizing it as a square around the rim gave a
  vertical two-spoke drawing a box twice as wide as it needed, and a horizontal scrollbar
  for a drawing with room to spare. `fitCanvas` measures the real extent, labels included.
- **The relationship-type vocabulary shows only in the list view** — on a diagram the type
  names are already on the edges.
- **The count is ink, not accent.** In that header the accent means "the view you are
  looking at", so an accented number read as a fourth, selected tab.

## A trap worth naming for the next person

Replacing an element's children with `set:text` in an `.astro` template silently dropped
sibling attributes twice — first `transform` on the edge labels, then `text-anchor` on the
node names. Both failures looked like layout bugs (labels unrotated; one name sitting on
its dot) and both were edits, not geometry. The lesson generalises: after a scripted edit
to markup, check the RENDERED attributes, not just that the page still compiles.

## Shipped

- `src/lib/diagram.ts` + `src/lib/diagram.test.ts` — pure layout, 34 tests
- `src/pages/books/[id].astro` — view switch, SVG rendering, styles
- Commits: 2352672, 076bf0d, a163e98, d6b219b, 90a2622
