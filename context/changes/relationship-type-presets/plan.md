# Relationship type presets in the database Implementation Plan

## Overview

The five shared relationship types become rows in the database, and the code stops enumerating
them. Today they exist only as a TypeScript array plus two hand-written lists inside Postgres
check constraints — the reader looked for them in the database and could not find them. When
this plan is done, adding or renaming a shared type is a migration, not a code change, and the
first exercise of that is renaming `other` to `friend`.

## Current State Analysis

**The five live in three copies, none of which is a row.**

- `src/types.ts:120` — `RELATIONSHIP_TYPES`, feeding the TS union, the Zod choice validator,
  and the "a custom type may not shadow a shared one" refine.
- `src/pages/books/[id].astro:465, 570, 678` — two `<select>` blocks and the "Predefined" line.
- Postgres — `relationships.type check (type in (…))` from
  `20260910103932_create_relationships_with_rls.sql:20`, and `relationship_types_not_shared`
  from `20260910140215_create_relationship_types_with_rls.sql:24`.

**Measured 2026-09-11, before planning:**

|                                            | local          | production                                           |
| ------------------------------------------ | -------------- | ---------------------------------------------------- |
| `relationships` rows with `type = 'other'` | 0              | 0                                                    |
| `relationships` rows by type               | 1 × `romantic` | 8 × custom, 1 × `family`                             |
| `relationship_types` names                 | none           | `córka`, `matka`, `mieszka w kamienicy`, `mieszka z` |

So the rename has no data to migrate today, and no custom type collides with `friend`. Both
facts are measurements, not guarantees: the window between now and deployment is open, so the
rename still ships as an `update`, and the collision case is discussed under Migration Notes.

**The write path already queries the database for types.** `resolveTypeColumns`
(`src/lib/relationship-type.ts:47`) looks up a custom type to confirm book membership.
Validating a preset slug there costs the same round trip pattern, not a new one.

**Two comments went stale in the previous change** (`one-way-relationships`, `3ec2663`) and
are corrected here because this plan edits the same file:

- `src/types.ts:124-128` — `Relationship` still reads "Undirected: the row is rendered beneath
  both characters… Never assume the anchor."
- `src/types.ts:211-213` — `updateRelationshipSchema` still says `anchor_id` "tells the route
  which column holds the anchor"; the route now verifies ownership instead of choosing a column.

## Desired End State

`public.relationship_type_presets` holds the shared types as rows, readable by any signed-in
reader and writable by none. `relationships.type` is a foreign key into it, so an unknown value
is refused by referential integrity rather than by a list someone has to remember to update.
`src/types.ts` no longer contains the names at all; the page renders both `<select>` blocks and
the "Predefined" line from the rows, ordered by `sort_order`. The fifth type reads `friend`
everywhere — in the select, in the list, and in any connection that used to say `other`.

Verify by adding a connection through the UI: the shared group in the dropdown lists
`family · ally · antagonist · romantic · friend`, and `grep -rn "antagonist" src/` returns
nothing outside generated types.

### Key Discoveries:

- `src/lib/relationship-type.ts:25` — `classifyTypeChoice` distinguishes the two sources by
  list membership today; without the list, "is it a uuid" is the natural discriminator and is
  already how the Zod validator's second branch works (`src/types.ts:190`).
- `src/types.ts:167` — the "that is already one of the shared types" message comes from a Zod
  refine over the array. Without the array, a friendly message needs a database lookup, which
  belongs in the endpoint, not in the schema.
- `20260910140215…sql:24` — `relationship_types_not_shared` is a check constraint, so it cannot
  subquery the presets table. The decision (2026-09-11) is to keep it a check with its list
  written out, and make the drift loud with a harness assertion instead.
- Adding a check constraint validates existing rows. A custom type named `friend` present at
  deploy time therefore fails the migration rather than being ignored — see Migration Notes.

## What We're NOT Doing

- No `label` column. The UI renders the slug directly today; a display-name column nobody reads
  differently is a commitment without a benefit. Add it when there is a reason.
- No per-reader or per-book editing of the presets. They stay immutable from the application:
  no insert/update/delete policy, no grant. A sixth shared type is a migration.
- No collision handling for a pre-existing custom type named `friend`. Measured zero; if one
  appears before deploy the migration fails loudly inside its transaction, which is a safe
  failure, not a corrupt one.
- No change to `relationships_one_type`, `relationships_unique_pair_type`, the RLS policies on
  `relationships` / `relationship_types`, or anything about connection direction.
- No renaming of the `relationships.type` column.

## Implementation Approach

Two phases, split where the application's view of the world changes.

**Phase 1 is invisible to the application.** It creates the table, seeds the five names exactly
as they are today (including `other`), and swaps the check constraint for a foreign key. The
TypeScript list still matches the rows, so the app keeps working whether or not its code has
been deployed. That makes Phase 1 independently deployable.

**Phase 2 moves the source of truth and does the rename together**, because they cannot be
separated: the moment `other` becomes `friend` in the database, a code path that still offers
`other` writes a value the foreign key refuses. The app must be reading the table before the
rename lands, and both must reach production in one deploy.

## Critical Implementation Details

**`on update cascade` on the foreign key is what makes Phase 2 a one-liner.** With it, the
rename is `update relationship_type_presets set slug = 'friend' where slug = 'other'` and every
referencing row follows automatically. Without it the same change needs insert-new,
rewrite-references, delete-old — three statements and an ordering that is wrong in two of the
six possible arrangements. Set it in Phase 1, where the foreign key is created.

**Order inside Phase 2's migration matters.** The `relationship_types_not_shared` check must be
dropped before the preset rename and re-added after, listing `friend`. Re-adding it first would
validate against a list that does not yet describe the presets.

## Phase 1: Presets become rows

### Overview

Create the lookup table, move the five names into it unchanged, and make
`relationships.type` a foreign key. Nothing the reader can see changes.

### Changes Required:

#### 1. The presets table and the foreign key

**File**: `supabase/migrations/<timestamp>_create_relationship_type_presets.sql` (new)

**Intent**: Give the five shared types a row each and make `relationships.type` refer to them,
so the set of valid values is data rather than a list repeated in three files. Seed the names
exactly as they are today — the rename is Phase 2's job, and mixing them would break the
phase's own claim of being invisible.

**Contract**: `public.relationship_type_presets (slug text primary key, sort_order smallint not
null unique)`, seeded with `family, ally, antagonist, romantic, other` in that order. RLS
enabled with exactly one policy — `for select to authenticated using (true)` — and no write
policy at all; `grant select … to authenticated`, `revoke all … from anon`. On
`public.relationships`: drop `relationships_type_check`, add a foreign key from `type` to
`relationship_type_presets (slug)` with `on update cascade on delete no action`. Comment the
table with why it is immutable from the app.

#### 2. Harness coverage for the new table

**File**: `supabase/tests/rls_books.sql`

**Intent**: Assert the guarantees the table is supposed to carry, in both directions — a
select-only table is easy to get wrong in the direction that still passes every negative test.

**Contract**: a block asserting that an authenticated reader can read all five presets; that
the same reader's insert, update and delete are all refused; that `anon` is denied at the grant
level; that a `relationships` row with an unknown `type` is refused by the foreign key; and
that a preset referenced by a connection cannot be deleted.

#### 3. Generated row types

**File**: `src/db/database.types.ts`

**Intent**: Keep the generated file matching the schema, per the project rule that it is the
source of truth for row shapes.

**Contract**: regenerate with `npm run db:types`; no hand edits.

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly from scratch: `npx supabase db reset`
- RLS and preset harness pass: `npm run db:verify-rls`
- Mutation check: dropping the `revoke all … from anon` line makes the anon assertion fail
- Unit tests pass unchanged: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- `npm run db:types` produces no uncommitted drift after the migration

#### Manual Verification:

- The shared group in both dropdowns still lists the same five names
- Adding a connection with a shared type still saves
- Adding a connection with a reader-defined type still saves

---

## Phase 2: The code stops enumerating them, and `other` becomes `friend`

### Overview

Move the source of truth into the query layer: the page reads the presets, the write path
validates against them, and `src/types.ts` no longer names them. Rename `other` to `friend` in
the same deploy.

### Changes Required:

#### 1. Rename and constraint swap

**File**: `supabase/migrations/<timestamp>_rename_other_to_friend.sql` (new)

**Intent**: Rename the fifth preset and bring the shadowing rule with it. The rename reaches
existing connections through the foreign key's `on update cascade`.

**Contract**: drop `relationship_types_not_shared`; `update relationship_type_presets set slug
= 'friend' where slug = 'other'`; re-add the check with `friend` in place of `other`. The
`update` is written even though both environments measured zero `other` connections, because
the referencing rows are only guaranteed empty at the moment they were measured.

#### 2. Shared-type resolution without the list

**File**: `src/lib/relationship-type.ts`

**Intent**: The submitted `<select>` value is either a preset slug or a custom type's uuid.
With no array to test membership against, shape is the discriminator, and the database confirms
the slug exists.

**Contract**: `classifyTypeChoice` branches on whether the value parses as a uuid.
`resolveTypeColumns` gains a lookup confirming a preset slug exists, returning `null` the same
way it already does for a custom type that is not this book's — so the caller's existing "that
type is not in this book" path covers both. `columnsFor` and the duplicate-message exports keep
their signatures; `TypeColumns.type` widens from the union to `string | null`.

#### 3. The names leave `src/types.ts`

**File**: `src/types.ts`

**Intent**: Delete the list and everything that existed only to read it, and correct the two
comments left stale by `one-way-relationships`.

**Contract**: remove `RELATIONSHIP_TYPES`, `RelationshipType`, and `isSharedType`.
`Relationship.type` becomes `string | null`. `relationshipTypeChoice` keeps its name and its
"Pick a relationship type" message but validates shape only — the slug's existence is the
database's answer, not the schema's. `relationshipTypeNameField` loses its shared-name refine
(see the next entry). Rewrite the `Relationship` and `updateRelationshipSchema` comments to
describe one-way connections.

#### 4. The shadowing message moves to the endpoint

**File**: the relationship-type create and update endpoints under `src/pages/api/`

**Intent**: Keep the reader's friendly "that is already one of the shared types" instead of a
raw constraint violation, now that the schema cannot know the names.

**Contract**: before writing, compare the submitted name against the preset slugs and return
the existing message through the existing `?error=` redirect. The database check remains the
guarantee; this is the translation layer, exactly as `DUPLICATE_PAIR` is for 23505.

#### 5. The page reads the presets

**File**: `src/pages/books/[id].astro`

**Intent**: Render the shared options and the "Predefined" line from the rows, in
`sort_order`, so a sixth preset appears without touching the template.

**Contract**: one query alongside the existing custom-types query; both `<select>` blocks and
the `.vocab-note` line iterate the result. The `optgroup` labels, ordering of shared-before-
custom, and the `selected` logic for the edit form are unchanged.

#### 6. Tests

**File**: `src/lib/relationship-type.test.ts`

**Intent**: The classifier's rule changed from list membership to uuid shape; its tests must
change with it, and one of them should fail if the old rule came back.

**Contract**: `classifyTypeChoice` returns `custom` for a uuid and `shared` for anything else,
including a slug that is not a preset — resolution, not classification, is what rejects that.
Keep the `columnsFor` tests asserting both columns are always written.

#### 7. Drift assertion for the two remaining copies

**File**: `supabase/tests/rls_books.sql`

**Intent**: The names now live in two places, both inside the database: the preset rows and the
`relationship_types_not_shared` list. Make a divergence fail a command rather than wait to be
noticed in a dropdown.

**Contract**: an assertion that every preset slug is rejected as a custom type name and that no
non-preset name is — that is, the check's list and the rows describe the same set. Plus
assertions that `friend` now behaves as a shared name and `other` no longer does.

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly from scratch: `npx supabase db reset`
- RLS, preset and drift assertions pass: `npm run db:verify-rls`
- Mutation check: renaming a preset without updating the check list makes the drift assertion
  fail
- Unit tests pass, including the rewritten classifier tests: `npm test`
- `grep -rn "antagonist" src/` matches nothing outside `src/db/database.types.ts`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Both dropdowns list `family · ally · antagonist · romantic · friend` under "Shared"
- The "Predefined" line in the relationship-types section reads the same five
- Adding and editing a connection works with a shared type and with a reader-defined one
- Naming a new reader-defined type `friend` is refused with the sentence, not a database error
- Naming one `other` is now allowed
- Deployed to production and an existing book still renders every connection it had

---

## Testing Strategy

### Unit Tests:

- `classifyTypeChoice`: uuid → custom, anything else → shared
- `columnsFor`: both columns written for both branches

### Integration Tests:

- `supabase/tests/rls_books.sql`: preset table is readable by authenticated, unwritable by
  anyone, denied to anon; unknown `type` refused by the foreign key; preset in use undeletable;
  check list and preset rows describe the same set; `friend` shared, `other` not

### Manual Testing Steps:

1. `npm run dev`, open a book with at least two characters
2. Add a connection using each of the five shared types in turn
3. Add a reader-defined type, then a connection using it
4. Try to name a reader-defined type `friend` — expect the sentence
5. Try to name one `other` — expect it to be accepted
6. Edit an existing connection from a shared type to a custom one and back
7. Check the "Predefined" line lists the five in the intended order

## Migration Notes

Phase 1 changes no data. Phase 2 renames one preset slug; the foreign key's `on update cascade`
carries it into `relationships.type`, and the explicit `update` in the migration is therefore
belt-and-braces for rows created between measurement and deploy.

The one way Phase 2 can fail on production is a reader-defined type named `friend` existing at
deploy time: re-adding `relationship_types_not_shared` validates existing rows and refuses.
Measured zero on both environments 2026-09-11. The failure is transactional — nothing is
written — and the fix is to rename that one row by hand and re-run.

## References

- Change identity and the recorded decisions: `context/changes/relationship-type-presets/change.md`
- Existing table and constraint being changed: `supabase/migrations/20260910140215_create_relationship_types_with_rls.sql`
- Original `type` check: `supabase/migrations/20260910103932_create_relationships_with_rls.sql:20`
- Write-side resolution this plan extends: `src/lib/relationship-type.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Presets become rows

#### Automated

- [x] 1.1 Migrations apply cleanly from scratch: `npx supabase db reset` — 53f247d
- [x] 1.2 RLS and preset harness pass: `npm run db:verify-rls` — 53f247d
- [x] 1.3 Mutation check: dropping the anon revoke makes the anon assertion fail — 53f247d
- [x] 1.4 Unit tests pass unchanged: `npm test` — 53f247d
- [x] 1.5 Lint passes: `npm run lint` — 53f247d
- [x] 1.6 Type check passes: `npx astro check` — 53f247d
- [x] 1.7 `npm run db:types` produces no uncommitted drift — 53f247d

#### Manual

- [x] 1.8 Both dropdowns still list the same five shared names — 53f247d
- [x] 1.9 Adding a connection with a shared type still saves — 53f247d
- [x] 1.10 Adding a connection with a reader-defined type still saves — 53f247d

### Phase 2: The code stops enumerating them, and `other` becomes `friend`

#### Automated

- [x] 2.1 Migrations apply cleanly from scratch: `npx supabase db reset` — 1b0b12c
- [x] 2.2 RLS, preset and drift assertions pass: `npm run db:verify-rls` — 1b0b12c
- [x] 2.3 Mutation check: renaming a preset without the check list makes the drift assertion fail — 1b0b12c
- [x] 2.4 Unit tests pass, including the rewritten classifier tests: `npm test` — 1b0b12c
- [x] 2.5 `grep -rn "antagonist" src/` matches nothing outside generated types — 1b0b12c
- [x] 2.6 Lint passes: `npm run lint` — 1b0b12c
- [x] 2.7 Type check passes: `npx astro check` — 1b0b12c

#### Manual

- [x] 2.8 Both dropdowns list the five with `friend` in place of `other` — 1b0b12c
- [x] 2.9 The "Predefined" line reads the same five — 1b0b12c
- [x] 2.10 Adding and editing a connection works with both type sources — 1b0b12c
- [x] 2.11 Naming a reader-defined type `friend` is refused with the sentence — 1b0b12c
- [x] 2.12 Naming one `other` is now allowed — 1b0b12c
- [x] 2.13 Deployed to production and an existing book renders every connection it had — 1b0b12c
