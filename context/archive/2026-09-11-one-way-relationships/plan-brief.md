# One-way relationships — Plan Brief

> Full plan: `context/changes/one-way-relationships/plan.md`

## What & Why

A connection between two characters is currently shown under both of them, because
`buildConnections` indexes every `relationships` row twice. In use that reads as duplication:
"córka" appears under Agnieszka _and_ Ewa, and Alicja's card fills with five "mieszka w
kamienicy" entries nobody typed there. The reverse direction is sometimes worth noting and
sometimes not — that should be the reader's call, not an automatic mirror.

## Starting Point

The mirror is display-side only; the database holds one row per connection. The direction is
already persisted: the create endpoint writes `character_a_id` = the card the reader used. What
blocks one-way semantics is the unique index, which deliberately normalises the pair with
`least`/`greatest` so that A→B and B→A collide.

## Desired End State

A connection appears once, on the card it was created from, labelled exactly as today. The
reader may additionally record the reverse direction with its own type and the database accepts
it; the same direction with the same type twice is still refused. The CIRCLE and PERSON
diagrams are untouched — a line still means "connected".

## Key Decisions Made

| Decision          | Choice                                                                        | Why (1 sentence)                                                                                                                | Source |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Row rendering     | Unchanged (`CÓRKA  Ewa`)                                                      | The note is the reader's own shorthand; an arrow glyph would promise a direction the diagrams deliberately don't draw.          | Plan   |
| Back-references   | None — the source card owns the connection                                    | Any "points at her" list is the Alicja list the reader asked to remove, returning in grey.                                      | Plan   |
| Diagram behaviour | Untouched; both directions stack their labels on one line                     | The stacking mechanism already exists and is tested; showing one label would re-create the defect reported for Harey.           | Plan   |
| Index semantics   | Directed `(a, b, type, custom_type_id)`, same name, `nulls not distinct` kept | Normalisation is exactly what blocks the reverse direction; the name stays so production and the prior migration still line up. | Plan   |
| Phasing           | One phase                                                                     | Index-only allows rows the UI duplicates; render-only makes the first reverse entry fail with 23505.                            | Plan   |
| Existing data     | No re-entry needed                                                            | Production was queried: all five mirrored rows already have the tenant as anchor.                                               | Plan   |

## Scope

**In scope:** directed unique index (new migration); `buildConnections` anchored on
`character_a_id`; its unit tests; collapse of the dead two-way branch in the connection edit
endpoint; the four duplicate assertions in the RLS harness; one stale comment in
`books/[id].astro`.

**Out of scope:** arrowheads on the diagrams; a "who points at her" section; a direction-swap
control; moving the five shared relationship types into the database; any change to
`relationships_one_type`, RLS policies or grants.

## Architecture / Approach

`character_a_id` stops being incidental and becomes the anchor, consistently in four places:
the index that defines a duplicate, the function that builds the cast list, the endpoint that
edits a connection, and the SQL assertions that prove both. Nothing else moves — the map reads
the same structure and keeps merging by unordered pair.

## Phases at a Glance

| Phase                  | What it delivers                                                               | Key risk                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. One-way connections | Directed index, anchored rendering, simplified edit path, rewritten assertions | Losing the `nulls not distinct` proof while rewriting the duplicate block — the one assertion that measures it currently does so via a reversal, which becomes legal. |

**Prerequisites:** local Supabase running (`npx supabase start`), `psql` on PATH for
`db:verify-rls`.
**Estimated effort:** one session, one commit.

## Open Risks & Assumptions

- The rewritten custom-type assertion must stay a _same-direction_ duplicate, or the project
  loses its only check that `nulls not distinct` is present. Mitigated by an explicit mutation
  check in the success criteria.
- Existing connections visibly move to one card. Verified harmless for the production book
  (measured 2026-09-11); a book not yet inspected could still surprise the reader.
- The new index is looser than the old one, so the migration cannot fail on existing data —
  this is an assumption worth re-checking if the index definition changes during implementation.

## Success Criteria (Summary)

- Each connection appears once, on the card the reader created it from.
- Recording the reverse direction is possible; recording the same direction twice is refused.
- The cast map looks and behaves exactly as before.
