# One-way relationships Implementation Plan

## Overview

A connection is recorded from one character to another and shows only on the card it was
created from. Today a single `relationships` row renders under both of its characters, so
every connection is duplicated in the cast list — "córka" appears under Agnieszka _and_ under
Ewa, and Alicja's card carries five mirrored "mieszka w kamienicy" entries the reader never
entered there. The reader wants to decide for herself whether the reverse direction is worth
noting; the automatic mirror takes that decision away.

## Current State Analysis

**The mirror is display-side, not stored.** `buildConnections` (`src/lib/connections.ts:76-79`)
loops each relationship over both orderings of its two ids and indexes it under each:

```ts
for (const [selfId, otherId] of [
  [rel.character_a_id, rel.character_b_id],
  [rel.character_b_id, rel.character_a_id],
]) {
```

The module comment above it states the rule that this change reverses: _"Relationships are
undirected: which id sits in `character_a_id` depends only on whose row the connection was
created from, so neither column may be treated as the anchor."_

**The direction is already in the data.** `src/pages/api/characters/[id]/relationships.ts:66`
writes `character_a_id: anchorId` — the character whose card the reader used. Nothing needs
migrating; the column stops being incidental and becomes the anchor.

**The stored direction is the one the reader wants.** Measured on production 2026-09-11
against book `3a2def94-e13f-409f-8c72-fd64bea703ea` (read-only join through the SQL editor),
8 rows, `from_a` = `character_a_id`:

| from_a    | typ                 | to_b      |
| --------- | ------------------- | --------- |
| Agnieszka | córka               | Ewa       |
| Agnieszka | mieszka w kamienicy | Alicja    |
| Alicja    | family              | Agnieszka |
| Ewa       | mieszka w kamienicy | Alicja    |
| Kasia     | mieszka w kamienicy | Alicja    |
| Kasia     | mieszka z           | Marta     |
| Maria     | mieszka w kamienicy | Alicja    |
| Marta     | mieszka w kamienicy | Alicja    |

All five "mieszka w kamienicy" rows have the tenant as `a` and Alicja as `b`, so Alicja's card
loses exactly the list the reader complained about and gains only `family → Agnieszka`. No
manual re-entry of rows is needed. This table is also the expected result of manual
verification.

**The unique index contradicts the new semantics.** `relationships_unique_pair_type`
(`supabase/migrations/20260911110400_unique_relationship_pairs.sql`) normalises the pair with
`least`/`greatest` _specifically so that_ A→B and B→A collide. Under one-way semantics the
reverse direction is a distinct, legitimate fact the reader may want to record, so the
normalisation has to go.

**Two RLS assertions encode the old rule.** `supabase/tests/rls_books.sql:709-717` and
`:733-744` both prove refusal by inserting the **reversal** (`a_c2, a_c1`). Under the new
index those inserts must succeed. The second one is load-bearing for a different reason: it is
the only assertion that proves `nulls not distinct` is doing anything, so it must be moved to
a same-direction duplicate rather than deleted.

**One page comment goes stale.** `src/pages/books/[id].astro:543-545` justifies the compound
DOM id `edit-rel-<characterId>-<connectionId>` with "A relationship renders under both of its
characters" — which stops being true.

## Desired End State

A connection appears once, on the card of the character it was created from, labelled exactly
as today (`CÓRKA  Ewa`). The reader may additionally record the reverse direction with its own
type (`Ewa — matka → Agnieszka`) and the database accepts it; entering the same direction with
the same type twice is still refused with the existing duplicate message. The CIRCLE and
PERSON diagrams are unchanged — a line still means "connected", and a pair recorded in both
directions stacks both labels over one line, exactly as two types on one pair already do.

Verify by loading `/books/<id>` on the production book above: Alicja shows one connection
(`family  Agnieszka`), each tenant shows her own `mieszka w kamienicy  Alicja`, `córka  Ewa`
sits under Agnieszka only, and Ewa's PERSON view still draws Agnieszka.

### Key Discoveries:

- `src/lib/connections.ts:76-79` — the mirror loop; the only place the duplication happens.
- `src/pages/api/characters/[id]/relationships.ts:66` — direction already persisted.
- `src/pages/api/relationships/[id].ts:66-95` — the `anchorIsA` / `anchorIsB` branch exists
  solely because the anchor could be in either column; it becomes dead.
- `supabase/tests/rls_books.sql:733-744` — the custom-type duplicate assertion is the project's
  only proof that `nulls not distinct` is present; treat it as load-bearing when rewriting.
- The new index is strictly **looser** than the old one (same `a`,`b` implies same
  `least`,`greatest`), so no existing row can violate it and the migration cannot fail on data.

## What We're NOT Doing

- No arrowheads or direction markers on the CIRCLE / PERSON diagrams. `toLinks` keeps merging
  by unordered pair; that is a separate change if ever wanted.
- No "who points at this character" section, counter, or read-only back-reference list. A
  connection is owned by the card it was created from, full stop.
- No direction-swap affordance on the edit form. If a row sits on the wrong side, delete and
  re-enter — measured above as unnecessary for existing data.
- No change to the rendering of a connection row (`CÓRKA  Ewa` stays as-is; no arrow glyph, no
  reordering of type and name).
- No move of the five shared relationship types into the database — separate, later change.
- No change to `relationships_one_type`, `relationships_distinct_characters`, RLS policies, or
  grants.

## Implementation Approach

One phase. The change is indivisible: shipping the index without the render change would allow
reverse rows the UI immediately duplicates, and shipping the render change without the index
means the reader's first attempt at a reverse direction fails with SQLSTATE 23505. Both halves
plus their tests land together.

## Critical Implementation Details

**Mutation-check the rewritten SQL assertions.** The `nulls not distinct` proof has already
survived one rewrite by accident in this project. After rewriting the duplicate block, rebuild
the index locally without `nulls not distinct` and confirm the custom-type assertion _fails_.
An assertion that passes against both index definitions measures nothing.

**Index name.** Keep `relationships_unique_pair_type`. Renaming buys a marginally more accurate
noun and costs a stale name in the previous migration's comment, this project's SQL-editor
muscle memory, and any future `\d` comparison against production. Update the index `comment`
instead — the comment is where the semantics belong.

## Phase 1: One-way connections

### Overview

Make `character_a_id` the anchor everywhere: in the index that decides what counts as a
duplicate, in the function that builds the cast list, in the endpoint that edits a connection,
and in the assertions that prove it.

### Changes Required:

#### 1. Directed unique index

**File**: `supabase/migrations/20260911154500_directional_relationship_pairs.sql` (new)

**Intent**: Replace the pair-normalised uniqueness with directed uniqueness, so the reverse
direction becomes a recordable fact while the same direction with the same type stays a
duplicate. Explain in the file header why `least`/`greatest` is being removed — the previous
migration argues hard _for_ it, and a reader comparing the two needs the reason, not just the
diff.

**Contract**: drop `public.relationships_unique_pair_type`; recreate it under the same name on
`(character_a_id, character_b_id, type, custom_type_id)` with `nulls not distinct`; replace the
index comment. `nulls not distinct` is non-negotiable — every row has exactly one null among
the two type columns, so without it the index rejects nothing at all.

#### 2. Connection building

**File**: `src/lib/connections.ts`

**Intent**: Index each relationship under `character_a_id` only, so a connection renders once,
on the card it was created from. Rewrite the module comment that currently forbids treating
either column as the anchor — it is the exact rule being reversed, and leaving it would make
the next reader distrust the code or the comment.

**Contract**: `buildConnections` keeps its signature and its `Map<string, Connection[]>`
return. `Connection.otherId` / `otherName` now always describe `character_b_id`. The
out-of-cast guard stays: a relationship whose `b` is not in the cast is still skipped rather
than rendered with an undefined name.

#### 3. Connection-building tests

**File**: `src/lib/connections.test.ts`

**Intent**: Flip the two tests that assert both-ends indexing, and add one that would fail if
the mirror came back.

**Contract**: `"indexes a connection under BOTH characters"` becomes an assertion that the row
appears under `character_a_id` and that `character_b_id` is absent from the map entirely.
`"carries a custom type's name to both ends"` becomes the anchor-only equivalent. Add a test
that two rows between the same pair in opposite directions produce one entry under each
character, each naming the other — the shape that distinguishes real reverse data from a
restored mirror. `resolveTypeLabel` tests are untouched.

#### 4. Connection edit endpoint

**File**: `src/pages/api/relationships/[id].ts`

**Intent**: The anchor is now always `character_a_id`, so the two-way branch is dead. Collapse
it and keep the membership check — a posted `anchor_id` that is not this relationship's `a`
must still be refused rather than silently rewriting the wrong end.

**Contract**: keep the fetch of the existing row (it is what proves membership) but compare
only `character_a_id`; a mismatch keeps the existing message "That character is not part of
this relationship". The update patch becomes unconditional:
`{ character_b_id: other_character_id, ...typeColumns }`. Both type columns are still always
written. `RelationshipEnds` narrows to the one field still read. Error handling, the
`at`/`for` redirect scoping and the duplicate-message branch are unchanged.

#### 5. RLS harness — duplicate assertions

**File**: `supabase/tests/rls_books.sql` (the "duplikaty par" block, ~line 697 onward)

**Intent**: Re-point the block at directed uniqueness and add the capability this change
exists to unlock, keeping the `nulls not distinct` proof intact.

**Contract**: four assertions in this block —
(a) the same direction with the same shared type is refused (`unique_violation`);
(b) the **reverse** direction with the same type is now **accepted** — this is the new
capability and must fail loudly if the normalisation is ever restored;
(c) a second type between the same pair in the same direction is still accepted;
(d) the same direction with the same _custom_ type is refused — this is the `nulls not
distinct` proof and must stay a duplicate insert, not a reversal.
Rewrite the block's comment to describe directed uniqueness. The cascade, isolation and
relationship_types assertions in the surrounding blocks are untouched.

#### 6. Stale page comment

**File**: `src/pages/books/[id].astro`

**Intent**: The comment at ~line 543 justifies the compound DOM id with the mirror that is
being removed. Correct the justification; keep the id itself, which is still unique and whose
churn would touch several `form=` references for no behavioural gain.

**Contract**: comment text only. No markup, no attribute, no class changes. (Watch the
`set:text` hazard from this project's history: do not let an edit here drop sibling
attributes.)

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly from scratch: `npx supabase db reset`
- RLS + duplicate harness passes: `npm run db:verify-rls`
- Mutation check: with `nulls not distinct` removed from the new index, `npm run db:verify-rls`
  FAILS on assertion (d) — proving the assertion still measures the clause
- Unit tests pass, including the rewritten connection tests: `npm test`
- `diagram.test.ts` passes unchanged — the map is genuinely untouched
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Formatting of touched files: `npx prettier --check` on the touched set

#### Manual Verification:

- On dev, a character's card lists each connection once; the character on the other end does
  not show it
- Recording the reverse direction with a different type is accepted and appears on the second
  character's card
- Recording the same direction with the same type again is refused with the existing duplicate
  message, scoped under the right character
- Editing a connection from its owning card still saves, including moving it between a shared
  and a reader-defined type
- CIRCLE and PERSON views are unchanged; a character who is only the target of a connection
  still appears in the map and in her own PERSON view
- Pushed to production (`npx supabase db push`) and the production book renders as the table in
  "Current State Analysis" predicts: Alicja shows only `family  Agnieszka`

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before committing.

---

## Testing Strategy

### Unit Tests:

- `buildConnections` indexes under the anchor only; the other end is absent from the map
- Two opposite-direction rows between one pair yield one entry under each character
- Existing guards keep working: unresolvable custom type skipped, out-of-cast relationship
  skipped, several connections grouped under one character

### Integration Tests:

- `supabase/tests/rls_books.sql` — directed duplicate refused, reverse accepted, second type
  accepted, custom-type duplicate refused; run via `npm run db:verify-rls`

### Manual Testing Steps:

1. `npm run dev`, open a book with several characters
2. Add a connection from character A to B; confirm it appears under A and NOT under B
3. From B, add a connection back to A with a different type; confirm both cards now show one
   connection each, and the map draws one line with both labels stacked
4. From A, try the identical type to B again; confirm the duplicate message appears under A
5. Edit A's connection to a reader-defined type; confirm it saves and still shows only under A
6. Switch to CIRCLE and PERSON; confirm no character vanished from the map
7. After `supabase db push`, load the production book and compare against the measured table

## Migration Notes

No data migration. The new index is looser than the old one, so every existing row satisfies it
and the migration cannot fail on production data. The visible effect on existing data is purely
in rendering: each connection moves to the card it was created from.

## References

- Change identity and measured production evidence: `context/changes/one-way-relationships/change.md`
- Index this one replaces: `supabase/migrations/20260911110400_unique_relationship_pairs.sql`
- Mirror loop: `src/lib/connections.ts:76-79`
- Anchor write: `src/pages/api/characters/[id]/relationships.ts:66`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: One-way connections

#### Automated

- [x] 1.1 Migrations apply cleanly from scratch: `npx supabase db reset` — 3ec2663
- [x] 1.2 RLS + duplicate harness passes: `npm run db:verify-rls` — 3ec2663
- [x] 1.3 Mutation check: index without `nulls not distinct` makes assertion (d) fail — 3ec2663
- [x] 1.4 Unit tests pass, including the rewritten connection tests: `npm test` — 3ec2663
- [x] 1.5 `diagram.test.ts` passes unchanged — 3ec2663
- [x] 1.6 Lint passes: `npm run lint` — 3ec2663
- [x] 1.7 Type check passes: `npx astro check` — 3ec2663
- [x] 1.8 Formatting of touched files: `npx prettier --check` — 3ec2663

#### Manual

- [x] 1.9 A connection lists once, under the card it was created from — 3ec2663
- [x] 1.10 The reverse direction with a different type is accepted and shows on the other card — 3ec2663
- [x] 1.11 The same direction with the same type is refused with the scoped duplicate message — 3ec2663
- [x] 1.12 Editing a connection from its owning card still saves, across both type sources — 3ec2663
- [x] 1.13 CIRCLE and PERSON views unchanged; a target-only character still appears — 3ec2663
- [x] 1.14 Pushed to production and the production book matches the measured table — 3ec2663
