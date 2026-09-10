# Reader-defined relationship types Implementation Plan

## Overview

FR-004's five shared relationship types turned out too narrow in use: relationships a reader
actually wants to record are often book-specific ("lives with", "serves"), and forcing them
into `other` loses exactly the information the note was for. This plan lets a reader define
their own types, scoped to one book, and use them alongside the immutable five — without
putting any of that machinery in front of a reader who never wanted it.

## Current State Analysis

- `RELATIONSHIP_TYPES = ["family", "ally", "antagonist", "romantic", "other"] as const`
  (`src/types.ts:120`) is the single source of truth, read by the Zod schemas
  (`src/types.ts:147,158`) and both `<select>` elements (`src/pages/books/[id].astro:283,325`).
  The migration's check constraint carries the same list independently.
- `relationships` has `type text not null check (type in (…))` and **no `book_id`** — the book
  is reached through `characters`. Both ends are `on delete cascade` to `characters`.
- Both write endpoints already resolve the book from `characters` and reject a cross-book pair
  with a reader-facing message (`src/pages/api/characters/[id]/relationships.ts:47`,
  `src/pages/api/relationships/[id].ts:60`). Book-scoping is application-level here by
  precedent; RLS owns ownership only.
- The cast read (`src/pages/books/[id].astro:70`) selects the four columns and indexes every
  row under both ends, building `connectionsByCharacter`. `Connection.type` is typed
  `RelationshipType` (`:17`), i.e. the stored value and the displayed value are the same thing
  today. That is what the two-column shape breaks.
- Relationship management (edit / delete) sits inside a nested `<details>` under each
  character; delete sits behind a second nested `<details>` confirmation (`ceb5bca`).
- `supabase/tests/rls_books.sql` holds four `DO` blocks with negative _and_ positive
  assertions; `npm run db:verify-rls` runs it. `CLAUDE.md` carries the worked RLS template.

## Desired End State

A reader opens a book, opens "Relationship types", types `lives with`, and it appears in the
type `<select>` of every connection form for that book, in a group separated from the shared
five. They record Harey — "lives with" — Snaut, and the cast view shows it under both names.
They fix a typo by renaming the type once, and every connection holding it shows the new name.
Deleting a type still in use is refused with a sentence naming how many connections hold it.
A second reader sees none of it, and a reader who never opens that section sees exactly the
app they had before.

Verify by: `npm run db:verify-rls` green with a fifth table block; `npx astro check` clean;
and the manual passes listed per phase.

### Key Discoveries:

- **Per-book scoping needs no new mechanism.** A custom type row carries `book_id`, and the
  write endpoints already compare `book_id` against the anchor character's — one more
  comparison in an existing branch, not a trigger and not a denormalised column.
- **`type in (…)` stays satisfied when `type` is NULL.** A SQL check evaluating to NULL passes,
  so making `type` nullable does not require touching the existing constraint.
- **The foreign key is the guarantee; the count is only for the message.** The endpoint counts
  connections to build the sentence, and the constraint is what actually prevents the delete —
  so the refusal cannot be bypassed by a race or a hand-crafted post. NO ACTION rather than
  RESTRICT: same refusal, but checked at end of statement, so a book delete cascading to both
  `characters` and `relationship_types` does not depend on which FK fires first.
- **A second query beats an embedded select for the read.** The page already resolves character
  names through a `Map` (`src/pages/books/[id].astro:65`); resolving type names the same way
  keeps `.or()` untouched and avoids depending on PostgREST embedding over a nullable FK.

## What We're NOT Doing

- **No Polish display map.** Reversed on 2026-09-10: the UI is English throughout. Custom types
  are themselves the answer to "ally reads as fantasy-saga" — the reader writes their own.
- **No retranslation of `src/types.ts`** — its messages are already English (S-01).
- **Nothing on the type table beyond name, book, owner.** No colours, no icons, no ordering, no
  sorting, no per-type notes. No reuse of a type across books, and no copying between books.
- **No change to the five.** They stay in code, immutable, held by the check constraint, the Zod
  schema and `RELATIONSHIP_TYPES`.
- **No duplicate-pair fix** — that is S-02, blocked on its own uniqueness-key decision.
- **No separate management route.** Management lives in a `<details>` on the book page.
- **Not adding the `<Database>` generic to `createServerClient`.** It is the real fix for the
  compiler believing `src/types.ts` over the schema, but it is one line with a blast radius
  across every endpoint. Its own change, not a rider on this one.

## Implementation Approach

Three phases, cut so the milestone has its outcome after phase 2. Phase 1 lands the schema and
proves isolation before any UI exists. Phase 2 delivers the north star: define a type, use it,
read it back. Phase 3 adds rename and delete, which is the cut line if the deadline bites.

The two-column shape on `relationships` (`type` for the five, `custom_type_id` for the rest,
exactly one filled) is what buys rename propagation: a name lives in one row, so fixing it fixes
every connection at once. The cost is that every read now coalesces two sources into one
display label — paid once, in the page's existing loop.

## Critical Implementation Details

**The migration's statement order is free.** Adding the XOR check while `type` is still NOT
NULL succeeds: every existing row has `type` set and `custom_type_id` NULL, so the constraint
validates true either way. No data migration is needed, and nothing here needs sequencing.

**The FK carries NO ACTION, not RESTRICT — deliberately.** Both refuse to delete a type a
connection points at. The difference is timing: RESTRICT is checked immediately, NO ACTION at
end of statement. Deleting a book cascades to `characters` (and through them to
`relationships`) and to `relationship_types` in one statement, so RESTRICT would let the book
delete through only when the characters cascade happens to fire first — an accident of FK
order, not something we declared.

**New structural assertions must catch their own exceptions.** The harness's existing negative
assertions trap `insufficient_privilege`. The new ones trap `check_violation` (name collision,
XOR) and `foreign_key_violation` (type in use). A violating statement left unwrapped inside a
`DO` block aborts the whole script, so a missing `exception when` turns a passing assertion
into a failed run.

**The migration reaches production through `npx supabase db push`, not `git push`.** Separate
deploy, already missed twice on this project. Phase 1 is not done in production until it runs.

**One form field, two meanings.** The type `<select>` submits either one of the five literals
or a UUID. The endpoint decides the column by shape, and a value that is neither must be
rejected rather than silently written — a UUID that is not this book's type is the case to get
right, because RLS makes another reader's type simply not found.

---

## Phase 1: Schema, isolation and generated types

### Overview

The `relationship_types` table with full RLS, the two-column shape on `relationships`, the
isolation harness extended to the new table, and regenerated database types. No UI.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_relationship_types_with_rls.sql`

**Intent**: Add the per-book type table and rewire `relationships` so a connection can point at
either a shared literal or a custom row. Copy the RLS template in `CLAUDE.md` verbatim —
including the `grant … to authenticated` line, without which the table is unreachable however
correct the policies are — and attach the trigger without re-creating `public.set_updated_at()`.

**Contract**:

- `public.relationship_types`: `id`, `user_id` (`not null default auth.uid()` → `auth.users` on
  delete cascade), `book_id` (`not null` → `public.books` on delete cascade), `name text not
null`, `created_at`, `updated_at`.
- Index on `(user_id, book_id)`; trigger `relationship_types_set_updated_at` attached to the
  shared function.
- Unique index on `(book_id, lower(name))` — a book's vocabulary cannot hold the same name
  twice.
- Check constraint rejecting a name that collides with one of the five, case-insensitively.
- RLS enabled, four per-operation policies scoped to `authenticated`, `grant select, insert,
update, delete … to authenticated`, `revoke all … from anon`.
- On `public.relationships`: `alter column type drop not null`; add `custom_type_id uuid
references public.relationship_types (id)` — NO ACTION by default, see Critical
  Implementation Details; add
  `constraint relationships_one_type check ((type is null) <> (custom_type_id is null))`.
  Drop-not-null precedes the constraint (see Critical Implementation Details).

#### 2. Isolation harness

**File**: `supabase/tests/rls_books.sql`

**Intent**: Add a fifth `DO` block for `relationship_types`, keeping both directions — reader B
cannot select, update, delete or forge a row of reader A's, and reader A _can_ act on their own.
Also assert the two new structural guarantees, so they are checked by a command rather than by
someone remembering: a connection cannot hold both type sources or neither, and a type in use
cannot be deleted.

**Contract**: same shape as the existing blocks — fixtures scoped `where user_id in (a_id, b_id)`
so the file survives a populated dev database, and the script still ends in `rollback`.

#### 3. Generated types

**File**: `src/db/database.types.ts`

**Intent**: Regenerate from the local schema so the row shapes match. Do not hand-edit.

**Contract**: `npm run db:types`.

### Success Criteria:

#### Automated Verification:

- Migration applies from scratch: `npx supabase db reset` succeeds
- Isolation and structural assertions pass: `npm run db:verify-rls`
- Generated types match the schema: `npm run db:types` leaves no diff on a second run
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Seeded accounts survive the reset (`supabase/seed.sql` still signs in)

#### Manual Verification:

- The catalog confirms the isolation contract (queried, not read off a Studio badge — the badge
  is a view over these same tables, and a query is reproducible and archivable). Expected:
  `relrowsecurity` true on `relationship_types` and `relationships`; four policies on
  `relationship_types`, one per command, all scoped to `{authenticated}`; `anon` absent from the
  grants entirely; `confdeltype = 'a'` on the `custom_type_id` foreign key. See the verification
  note below.
- Name-collision and per-book-uniqueness behaviour: asserted by the harness (step 1.2), not by
  hand — `'  ALLY '` raises `check_violation`, a second `'Lives With '` in the same book raises
  `unique_violation`, and the same name under a different book is accepted.

### Verification note (Phase 1, recorded 2026-09-10):

```
 relname            | relrowsecurity
--------------------+----------------
 relationship_types | t
 relationships      | t

 tablename          | policyname                    | cmd    | roles
--------------------+-------------------------------+--------+-----------------
 relationship_types | relationship_types_delete_own | DELETE | {authenticated}
 relationship_types | relationship_types_insert_own | INSERT | {authenticated}
 relationship_types | relationship_types_select_own | SELECT | {authenticated}
 relationship_types | relationship_types_update_own | UPDATE | {authenticated}

 grantee       | privileges
---------------+---------------------------------------------------------
 authenticated | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
 postgres      | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
 service_role  | REFERENCES,TRIGGER,TRUNCATE

 conname                           | confdeltype
-----------------------------------+-------------
 relationships_user_id_fkey        | c
 relationships_character_a_id_fkey | c
 relationships_character_b_id_fkey | c
 relationships_custom_type_id_fkey | a
```

`anon` appears in no grant row — that absence IS the denial, and it is what Studio renders as
"API DISABLED". `service_role` holds only the `Dxtm` default with no DML, matching `CLAUDE.md`.

---

## Phase 2: Define a type and use it

### Overview

The north star: a reader defines a type for a book, picks it in a connection form alongside the
five, and reads it back in the cast. No rename, no delete yet.

### Changes Required:

#### 1. Shared types and validation

**File**: `src/types.ts`

**Intent**: Describe the new row, and widen the relationship commands so one form field can
carry either a shared literal or a custom type's id. Keep `RELATIONSHIP_TYPES` as the single
source of truth for the five.

**Contract**: `RelationshipTypeRow` mirroring the table; `createRelationshipTypeSchema` (name,
trimmed, length-capped, non-empty); `Relationship.type` becomes nullable and gains
`custom_type_id: string | null`. `createRelationshipSchema` / `updateRelationshipSchema` replace
`type: z.enum(RELATIONSHIP_TYPES)` with a union of that enum and `z.uuid()`, so the endpoint can
branch on shape.

#### 2. Create a type

**File**: `src/pages/api/books/[id]/relationship-types.ts`

**Intent**: New endpoint following the established idiom — `formData()` → Zod → `?error=`
redirect back to the book. Confirm the book is the reader's own before writing (RLS makes
another reader's book not found), and translate the unique-index and name-collision violations
into sentences rather than letting a raw database error reach the reader.

**Contract**: `POST`, `prerender = false`; on success redirects to `/books/<id>`; duplicate name
and collision-with-a-shared-type both return a reader-facing message.

#### 3. Write a connection with either type source

**Files**: `src/pages/api/characters/[id]/relationships.ts`, `src/pages/api/relationships/[id].ts`

**Intent**: Resolve the submitted type to exactly one column. A shared literal writes `type`;
a UUID writes `custom_type_id` after confirming the type row belongs to the same book as the
anchor character — the same check these routes already perform for the other character.

**Contract**: exactly one of the two columns is ever written, and the other is set to `null` on
update so an edit can move a connection between the two sources. A UUID that is not this book's
type returns `"That type is not in this book"`.

#### 4. Connection resolution as a named function

**File**: `src/lib/connections.ts` (new), consumed by `src/pages/books/[id].astro`

**Intent**: Lift the loop that indexes each relationship under both of its ends out of page
frontmatter into an exported function, and give it the second name source it now needs. This is
the project's clearest piece of non-CRUD business logic — undirected indexing plus coalescing
two type sources into one label — and while it lives in frontmatter no test can reach it. Phase
2 rewrites this loop anyway, so extracting it costs the diff and not the work.

**Contract**: takes the cast, the relationship rows and the book's custom types; returns the
`Map<string, Connection[]>` the page renders, with each `Connection` carrying its resolved
label. Pure — no Supabase client, no `Astro` globals — so it is callable from a test.

#### 5. Unit tests for the resolution function

**Files**: `src/lib/connections.test.ts` (new), `package.json`, `vitest.config.ts` (new)

**Intent**: The project has no test runner and no tests. It needs one here specifically: the
two-source contract has no other check. The compiler cannot see it (`src/db/database.types.ts`
is imported by nothing, so the schema's `type: string | null` and `src/types.ts`'s
`RelationshipType` are never reconciled), and no page-level check would catch a label silently
rendering as `undefined`. Install Vitest, add `npm test`, and cover the contract.

**Contract**: Vitest as a dev dependency with `"test": "vitest run"` in `package.json`; tests
require no database because the function is pure. Cases, at minimum:

- a connection carrying a shared literal resolves to that literal;
- a connection carrying a `custom_type_id` resolves to the custom name;
- a connection whose `custom_type_id` is absent from the type map does NOT render as
  `undefined` — the case the compiler cannot catch and a reader would see as a blank label;
- a connection is indexed under BOTH characters (the undirected invariant M-1 established).

Do not wire CI here — that is its own change.

#### 6. Read and render

**File**: `src/pages/books/[id].astro`

**Intent**: Load the book's custom types once, resolve each connection to a display label from
either source, and offer one merged `<select>` in both connection forms with the five and the
reader's own separated into groups. Add the "Relationship types" disclosure with the add form
only.

**Contract**: the page loads the book's types, calls `buildConnections` from
`src/lib/connections.ts`, and renders the result; `Connection` gains a resolved
`typeLabel: string` and drops the assumption that the stored value is the displayed one; both
`<select>` elements use `<optgroup>` (native, so the forms keep working with JavaScript
disabled). The stale comment block above `dateFormatter` (`:54`) moves back above the
relationships query it describes.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Formatting clean on touched files: `npx prettier --check <files>`
- Isolation still green: `npm run db:verify-rls`
- `src/lib/connections.ts` exports the resolution function and the page imports it — the loop no
  longer lives in frontmatter
- Unit tests pass: `npm test` — covering both type sources, a missing type-map entry, and the
  index-under-both-characters invariant
- Migration reaches production: `npx supabase db push` applied, and `relationship_types`
  present in the remote schema. Deliberately deferred out of Phase 1 — the two-column shape
  is not proven by real use yet, and a corrective migration against production costs more
  than waiting one phase. It is a checkbox because this project has twice shipped code
  against an unpushed schema, both times surfacing on the live app as
  "Could not find the table ... in the schema cache"

#### Manual Verification:

- A type named `lives with` added on one book appears in that book's connection forms and not in
  another book's
- A connection recorded with a custom type renders under both characters with the custom name
- A connection recorded with a shared type still renders exactly as before
- Editing a connection can move it from a shared type to a custom one and back
- A character with no connections still renders no relationship section at all — not an empty
  heading, not "None"
- The whole flow works at a 364px viewport with no horizontal scrolling, and a reader who never
  opens the disclosure sees no change to the page

### Verification note (Phase 2, criterion 2.7, recorded 2026-09-10):

The migration was already applied remotely, so no `db push` ran. The migration-history
table said so too, but that is not evidence -- it records what was pushed, not what exists.
The decisive probe is the remote REST API, with a negative control:

```
relationship_types     HTTP 401   permission denied for table relationship_types
nie_ma_takiej_tabeli   HTTP 404   Could not find the table 'public.nie_ma_takiej_tabeli'
                                  in the schema cache
```

A table absent from the remote schema answers 404 with that second string -- the one this
project hit twice. A table that exists but denies `anon` answers 401. So `relationship_types`
is present and `anon` is structurally denied, which is the intended state.

---

## Phase 3: Rename, then delete a type -- and make the vocabulary findable

### Overview

Management: rename a type once and have every connection follow, and be refused when deleting a
type still in use. Rename lands first and delete second, because they are not one cut line.
**Rename is what repairs a typo — delete cannot, since the FK refuses to remove a type in use.**
Rename is one endpoint plus one form with no counting logic; delete needs the count and its
message. If the deadline bites, cut delete and keep rename.

### Changes Required:

#### 1. Rename

**File**: `src/pages/api/relationship-types/[id].ts`

**Intent**: New endpoint, same idiom. A rename changes one row, so every connection holding it
shows the new name with no further writes — the reason for the foreign key.

**Contract**: `POST`, validates with `updateRelationshipTypeSchema`; the unique-index and
collision violations translate to the same sentences Phase 2 established.

#### 2. Delete, with a refusal that counts

**File**: `src/pages/api/relationship-types/[id]/delete.ts`

**Intent**: Count the connections holding the type to build the message, then delete. The count
is for the sentence; the foreign key is the guarantee, so a type in use cannot be removed even
if the count is stale.

**Contract**: `POST`; when the count is non-zero, redirect with `"This type is used by N
connection(s). Change them first."`; a foreign-key violation surfacing anyway is translated the
same way rather than shown raw.

#### 3. Management UI

**File**: `src/pages/books/[id].astro`

**Intent**: Fill in the disclosure from Phase 2 — each type listed with a rename form and a
delete behind the nested-`<details>` confirmation already used for characters and connections.

**Contract**: the confirmation names the type; the destructive submit does not exist in the DOM
until the disclosure is opened, matching `ceb5bca`.

#### 4. Make the vocabulary findable

**File**: `src/pages/books/[id].astro`

**Intent**: Phase 2 shipped the input but not the path to it — evidence being that the person
who commissioned the feature could not find it. The markup renders correctly; the placement
fails its purpose. It sits below the entire cast, which on a phone with three characters and
their connections is a long scroll, and the summary names a category ("Relationship types")
rather than offering anything. Fix discoverability only: the disclosure stays closed by
default, because the reader who wants nothing beyond the five must not pay for this.

**Contract**: a small link beside the type `<select>` in BOTH connection forms ("Need another
word?") pointing at the disclosure, so the reader meets the entry point while choosing a type
— the moment the vocabulary is actually missing — rather than while scrolling past the cast.
The summary reads "Relationship types — add your own". No schema change, no new route, no
JavaScript: the link is a fragment anchor, and the id sits on content inside the `<details>`
so browsers that auto-expand a fragment target open it, while the rest simply scroll to it.

#### 5. Type before person in the add-relationship form

**File**: `src/pages/books/[id].astro`

**Intent**: The add form currently asks for the other character first and the type second.
Swap them: the type comes first. A reader adding a connection knows what the relationship IS
before they pick who it is with, and putting the type first is also where the "Need another
word?" link belongs.

**Contract**: field order only — no name changes, no endpoint change. `other_character_id`
and `type` are read from `formData()` by name, so the submitted payload is unaffected.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Isolation and the type-in-use refusal assertion still green: `npm run db:verify-rls`

#### Manual Verification:

- Renaming a type updates the name on every connection holding it, in one action
- Deleting a type in use is refused with the correct count and the type is STILL PRESENT afterwards — the pass condition is the refusal, not a deletion
- Deleting an unused type succeeds and it disappears from the forms
- A rename to a name already used in that book is refused with a readable message
- Reader B cannot reach reader A's type. Recorded as a split, because the two halves were
  checked in different places and a single tick would imply more than happened:
  - **Browsable half — verified on the deployed app, two real accounts.** As reader B, opening
    reader A's book URL directly returns a 404 indistinguishable from a missing book. This is
    the reader-facing half and the one worth running against production, where RLS is enforced
    by a different database than the local stack.
  - **Crafted-POST half — measured locally, not on production.** Reader B gets "Relationship
    type not found" on both rename and delete, and "Book not found" when adding a type to
    reader A's book; reader A's row is unchanged afterwards. Also covered in both directions by
    the `relationship_types` block in `supabase/tests/rls_books.sql`, which runs against the
    same policies the migration installs.

### Verification note (Phase 3, criterion 3.8, recorded 2026-09-10):

Deployment confirmed read-only before the isolation check, so the check ran against the new
code: the book page summary reads "Relationship types — add your own (1 so far)", a string only
Phase 3 emits, and a real book renders "Marta — mieszka z — Kasia" under both characters — the
slice working on real data rather than only on seed rows.

Both Phase-3-only endpoints answer 302 → `/auth/signin` on the deployed app while a route
present in no version answers 404, so the probe could distinguish present from absent (see
`lessons.md` entry #4).

What was NOT done: the crafted-POST half was not repeated against production. The local run and
the harness cover it, and re-running it in production would mean sending forged writes at a live
database to learn something two other checks already establish.

---

## Testing Strategy

### Automated:

- `supabase/tests/rls_books.sql` is the regression suite for this change: per-user isolation on
  the new table in both directions, plus the two structural guarantees (XOR on the type source,
  referential refusal on a type in use).
- **`npx astro check` does NOT cover the nullability ripple, and must not be trusted as if it
  did.** `createServerClient` (`src/lib/supabase.ts`) is called without the `<Database>`
  generic, and the relationships read hand-asserts its row shape via
  `.overrideTypes<RelationshipRow[], { merge: false }>()`. The compiler therefore believes
  `src/types.ts`, not the schema: a read site that forgets `type` can now be `null` stays green
  and fails at runtime as a blank label. Measured on 2026-09-10: `src/db/database.types.ts` is
  imported by **nothing** in `src/`, so the generated file is not consulted at all — it is not
  merely the missing generic. Step 1.3 does update that file (it now records
  `type: string | null` and the new table, which `src/types.ts` does not), so keep it for the
  record — but it is documentation, not a safeguard.
- What replaces that safeguard is Phase 2's extraction of the connection-resolution loop into
  `src/lib/connections.ts`: once it is a named function rather than page frontmatter, the
  coalescing logic is reachable by a test at all.

### Manual Testing Steps:

1. Add `lives with` to book A. Confirm it appears in book A's forms and not book B's.
2. Record a connection with it; confirm both characters show it.
3. Rename it to `lives with (Solaris)`; confirm every connection follows in one action.
4. Try to delete it; confirm the refusal names the right count.
5. Remove the connections, delete the type, confirm it is gone from the forms.
6. Sign in as reader B; confirm none of reader A's types are visible or actionable.
7. Repeat 1–3 at 364px.

## Migration Notes

Existing rows need no migration: every current relationship has `type` set and
`custom_type_id` NULL, which satisfies the XOR constraint as written. The change is additive and
backwards-compatible at the data level — a rollback would need to drop `custom_type_id` and
restore `not null` on `type`, which is only safe while no custom type is in use.

## References

- Roadmap item and settled design: `context/foundation/roadmap.md` § Slices → S-01
- RLS template and its four non-derivable rules: `CLAUDE.md` § Supabase migrations
- Worked example: `supabase/migrations/20260909155950_create_books_with_rls.sql`
- Recurring rules: `context/foundation/lessons.md` (all three apply — the Astro `return` trap,
  verifying scripted edits structurally, and pins tested only by the environment that reads them)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema, isolation and generated types

#### Automated

- [x] 1.1 Migration applies from scratch: `npx supabase db reset` succeeds — 037a9e3
- [x] 1.2 Isolation and structural assertions pass: `npm run db:verify-rls` — 037a9e3
- [x] 1.3 Generated types match the schema: `npm run db:types` leaves no diff on a second run — 037a9e3
- [x] 1.4 Type checking passes: `npx astro check` — 037a9e3
- [x] 1.5 Linting passes: `npm run lint` — 037a9e3
- [x] 1.6 Seeded accounts survive the reset — 037a9e3

#### Manual

- [x] 1.7 Catalog confirms RLS on, four `{authenticated}` policies, no `anon` grant, FK `confdeltype = a` — 037a9e3

### Phase 2: Define a type and use it

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 2c08fb7
- [x] 2.2 Linting passes: `npm run lint` — 2c08fb7
- [x] 2.3 Formatting clean on touched files — 2c08fb7
- [x] 2.4 Isolation still green: `npm run db:verify-rls` — 2c08fb7
- [x] 2.5 `src/lib/connections.ts` exports the resolution function and the page imports it — 2c08fb7
- [x] 2.6 Unit tests pass: `npm test` (both type sources, missing map entry, both-ends indexing) — 2c08fb7
- [x] 2.7 Migration reaches production: `relationship_types` confirmed in the remote schema — 2c08fb7

#### Manual

- [x] 2.8 A type added on one book appears only in that book's forms — 2c08fb7
- [x] 2.9 A connection with a custom type renders under both characters — 2c08fb7
- [x] 2.10 A connection with a shared type renders exactly as before — 2c08fb7
- [x] 2.11 An edit can move a connection between a shared and a custom type, both ways — 2c08fb7
- [x] 2.12 A character with no connections renders no relationship section at all — 2c08fb7
- [x] 2.13 Whole flow works at 364px; a reader ignoring the disclosure sees no change — 2c08fb7

### Phase 3: Rename and delete a type

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 7a500f2
- [x] 3.2 Linting passes: `npm run lint` — 7a500f2
- [x] 3.3 Isolation and the type-in-use refusal assertion still green: `npm run db:verify-rls` — 7a500f2

#### Manual

- [x] 3.4 A rename updates every connection holding the type, in one action — 7a500f2
- [x] 3.4a The "Need another word?" link appears beside the type select in both connection forms and reaches the disclosure — 7a500f2
- [x] 3.4b The summary reads "Relationship types — add your own" — 7a500f2
- [x] 3.4c The add-relationship form asks for the type before the person — 7a500f2
- [x] 3.5 Deleting a type in use is REFUSED with the correct count and the type is still present afterwards — 7a500f2
- [x] 3.6 Deleting an unused type succeeds and it leaves the forms — 7a500f2
- [x] 3.7 A rename to an existing name in that book is refused readably — 7a500f2
- [x] 3.8 Reader B cannot reach reader A's type — split evidence, see the Phase 3 verification note — 7a500f2
