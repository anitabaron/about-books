# Cast and Relationships View Implementation Plan

## Overview

Let a reader name an undirected relationship between two characters and see those connections
rendered **inline beneath each character** in the existing cast list — so reaching any
character's links costs zero further interactions.

This is roadmap item **S-03**, the north star: the slice that decides whether the product's
central claim holds, that a reader returning after a gap can orient from their own notes.

## Current State Analysis

- **The surface already exists.** `src/pages/books/[id].astro` renders the book, an
  add-character island, and the cast as `<li>` rows, each with a native `<details>` holding
  inline edit and delete forms (lines 110–160). This slice extends those rows; it adds no new
  page.
- **The cast query** filters `characters` by `book_id` and orders `created_at desc`. The cast's
  ids are therefore already scoped to the book, which is why `relationships` needs no
  `book_id` column of its own.
- **The RLS template is on its third use.** `books` and `characters` were both written from it;
  `CLAUDE.md` carries the template plus the four non-derivable rules, and F-01 proved it
  executable as a `characters` table.
- **`supabase/tests/rls_books.sql`** has two blocks and both controls (too-broad and
  too-narrow), sharing two fixture readers and a single `rollback`.
- **`src/types.ts`** holds `Book` and `Character` entities plus their command schemas;
  `src/db/database.types.ts` is generated.
- **Full CRUD is required.** FR-004 names add, edit and delete explicitly, so edit cannot be
  parked the way book editing was in S-01.
- **A top-level `return` in Astro frontmatter crashes the linter** — recorded in
  `context/foundation/lessons.md`. This slice touches a dynamic route, so it applies.

## Desired End State

On `/books/[id]`, each character in the cast shows its relationships directly under its name:
the other character and the relationship type, with no clicking. Expanding a character's
existing disclosure offers one select for the other character plus one for the type to add a
connection, and the same pair of controls to correct an existing one, or delete it. A reader
scanning the page sees the whole web of the cast at once.

Verification: `npm run db:verify-rls` passes with a relationships block and both controls,
`npx astro check` and `npm run build` are clean, and a relationship added under one character
appears under both.

### Key Discoveries:

- `src/pages/books/[id].astro:110` — the `characters.map` row is the extension point; the
  `<details>` at 117 already holds per-character forms.
- `src/pages/api/books/[id]/characters.ts` — the route idiom: guard `locals.user`, load the
  parent through the RLS-filtered client, treat "not found" as the rejection path.
- S-02's `authorField`/`description` pattern (`""` → `null`) is not needed here: both
  relationship fields are required.
- `context/foundation/lessons.md` — use `Astro.response.status`, never a top-level `return`.

## What We're NOT Doing

- **No visual relationship diagram.** Parked in the roadmap; FR-007's own resolution makes the
  list the primary readable view.
- **No character detail page.** "One interaction" is satisfied by rendering inline, and a
  detail page would add a navigation layer and another dynamic route for no gain.
- **No directed relationships.** One row, `character_a_id` / `character_b_id` / `type`,
  rendered under both. FR-004's vocabulary is symmetric: "ally" and "antagonist" read the same
  from either side. Role labels like "son / mother" would need direction, and the PRD has none;
  that nuance belongs in the character's note.
- **No unique index on the character pair.** A reader can enter A↔B and then B↔A as two rows.
  Recorded as a risk, not solved: they would be doing it deliberately, and
  `unique (least(a,b), greatest(a,b))` can be added later if time remains after the slice works.
- **No linked events.** FR-005 is parked; this must satisfy US-01 for relationships alone
  without designing itself into a corner when events arrive.
- **No book status** (S-04), **no book edit/delete** (still parked).
- **No test runner**, unchanged since F-01.
- **No deployed-verification phase** — S-01 proved the deployed cookie → JWT → policy path, and
  this slice reuses it with the same policy shape.

## Implementation Approach

Three phases, mirroring S-02's proven shape. Phase 1 lands the `relationships` table and
extends the harness, so isolation exists before any UI can write. Phase 2 delivers the north
star itself: relationships rendered inline under every character, plus the per-character add
form. Phase 3 completes FR-004's CRUD with edit and delete.

## Critical Implementation Details

**The anchor character can be in either column.** A relationship `(A, B)` renders under both A
and B. When editing from A's row, "the other character" is `character_b_id`; when the row was
created from B, A sits in `character_b_id` and the other is `character_a_id`. The update route
must read the existing row, work out which column holds the anchor, and write the replacement
into the other one. Assuming the anchor is always `character_a_id` will silently rewrite the
wrong end.

**Cross-book relationships must be refused in the route.** Policies check `auth.uid() =
user_id` only, so a hand-crafted post could relate a character in one book to a character in
another — both the reader's own, so no leak, but it would render as a dangling connection
whose other end is not in the cast. The guard is cheap: load both characters through the
RLS-filtered client and reject unless both exist and share the same `book_id`.

**Rendering must tolerate an unresolvable other end.** The page resolves the other character's
name from the cast map. If a relationship ever points outside the cast, skip the row rather
than rendering "undefined" — a defensive branch, not a feature.

## Phase 1: Relationships data layer and isolation harness

### Overview

Create `relationships` from the `CLAUDE.md` template, extend the harness to cover it in both
directions, and regenerate the types.

### Changes Required:

#### 1. Relationships migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_relationships_with_rls.sql` (new)

**Intent**: Land the third domain table on the established convention, so isolation and
`updated_at` behaviour are inherited rather than re-invented.

**Contract**: Table `public.relationships` following the `CLAUDE.md` template verbatim for
ownership, RLS, the four `authenticated`-only policies, the grant, the revoke and the trigger
attachment. Domain columns: `character_a_id` and `character_b_id`, both
`uuid not null references public.characters (id) on delete cascade`, and
`type text not null check (type in ('family','ally','antagonist','romantic','other'))` — a
check rather than a Postgres enum, because extending a check is one line and reversing an
`ALTER TYPE` is not. Plus `check (character_a_id <> character_b_id)`. Indexes: the template's
`(user_id, created_at desc)`, plus one on `character_a_id` and one on `character_b_id`, because
the lookup matches either column. No `book_id`: the cast's ids already scope every query, and a
second source of truth could disagree with the characters' book.

#### 2. Relationships isolation assertions

**File**: `supabase/tests/rls_books.sql`

**Intent**: Extend the harness so the new table is covered by the same one command, per the
`CLAUDE.md` rule.

**Contract**: A relationships block as a third `DO` block, reusing the two fixture readers and
adding a second character per reader so a pair exists. Both directions: reader B cannot select,
update, delete or forge ownership of reader A's relationships, and reader A can insert with no
`user_id`, then update and delete their own row with `row_count = 1`. Still one `rollback`.

#### 3. Regenerated database types

**File**: `src/db/database.types.ts`

**Contract**: Output of `npm run db:types`. Generated; excluded from lint and prettier already.

### Success Criteria:

#### Automated Verification:

- Migration applies from scratch: `npx supabase db reset`
- Harness passes with the relationships block: `npm run db:verify-rls`
- Negative control: broaden `relationships_select_own` to `using (true)`, confirm the check
  FAILS, then restore
- Positive control: narrow `relationships_update_own` to `using (false)`, confirm the check
  FAILS on the owner-can-update assertion, then restore
- Types regenerate and contain a `relationships` row type: `npm run db:types`
- Type checking and build pass: `npx astro check`, `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Studio shows `relationships` with RLS enabled and exactly four `authenticated` policies
- Deleting a character cascades its relationships away
- The type check rejects a value outside the five names, and the self-relationship check
  rejects `a = b`

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful
before proceeding to the next phase.

---

## Phase 2: Relationships inline under every character

### Overview

The north star. Each character's connections render directly under its name, and a
per-character form adds one with a single select.

### Changes Required:

#### 1. Relationship types and commands

**File**: `src/types.ts`

**Intent**: Add the shared shapes, following the `Book` and `Character` precedent.

**Contract**: A `Relationship` entity mirroring the migration's columns one-to-one; a
`RELATIONSHIP_TYPES` tuple as the single source of the five names, shared by the Zod schema and
the form's select so they cannot drift; `createRelationshipSchema` (`other_character_id` as a
uuid, `type` constrained to the tuple) and `updateRelationshipSchema`, with their command types
inferred. `user_id`, `id` and timestamps are never accepted from a client.

#### 2. Create-relationship route

**File**: `src/pages/api/characters/[id]/relationships.ts` (new)

**Intent**: Accept the per-character add form: this character, plus the one chosen in the
select.

**Contract**: `POST` plus `prerender = false`. Guards `locals.user`; loads the anchor character
by `params.id` and the chosen other character, both through the RLS-filtered client; rejects
unless both exist and share a `book_id` (see Critical Implementation Details). Validates with
`createRelationshipSchema` and inserts `{character_a_id: anchor, character_b_id: other, type}`
with no `user_id`. Redirects to `/books/<book_id>` on success, or back with `?error=`.

#### 3. Relationship rendering and add form

**File**: `src/pages/books/[id].astro`

**Intent**: Deliver US-01's "one interaction" by making it zero: the connections are already on
screen.

**Contract**: After loading the cast, fetch the reader's relationships touching those ids
(`.or()` across both columns) and build a per-character map plus an id→name map from the cast.
Each `<li>` renders its character's connections beneath the description as "type — other
name", skipping any whose other end is not in the cast. Inside the existing `<details>`, a
native POST form to `/api/characters/<id>/relationships` with a select of the _other_ cast
members (excluding this character) and a select of the five types. No island; no client
JavaScript.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean on the files this phase touched (`npx prettier --check` on them)
- Harness still passes: `npm run db:verify-rls`

#### Manual Verification:

- **A relationship added under one character appears under BOTH characters** — this is the
  undirected model made visible, and the north star's core behaviour
- **Connections are visible without any clicking** — US-01's "one interaction" is satisfied at
  zero, which is the criterion this slice exists to meet
- The other-character select excludes the character whose row it is in
- **A character with no relationships renders NO relationship section at all** — not an empty
  heading, not "None", not a bare separator. Same class as the blank-author and
  blank-description cases from S-01 and S-02, but it bites harder here: a reader adds several
  characters before adding a single relationship, so the zero-relationship state is what the
  cast view looks like the first time anyone sees it. An empty heading under every name makes a
  working page look broken at exactly the moment the reader is deciding whether the app is
  worth their time
- At 375px the page needs no zooming and scrolls only vertically
- With JavaScript disabled the add form still submits
- A second account's characters never appear in the select

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful
before proceeding to the next phase.

---

## Phase 3: Edit and delete a relationship

### Overview

Complete FR-004's CRUD: correct either the type or the other character, or remove the
connection.

### Changes Required:

#### 1. Update-relationship route

**File**: `src/pages/api/relationships/[id].ts` (new)

**Intent**: Apply an edit from the row of whichever character it was opened under.

**Contract**: `POST` plus `prerender = false`. Guards `locals.user`. Reads the existing row to
determine which column holds the anchor character (submitted as a hidden `anchor_id`), then
writes the new other-character id into the opposite column and the new type. Validates the
replacement character the same way the create route does — same book, reader's own. RLS scopes
the update to the reader's own row; zero rows affected means "not found", not an error.
Redirects to `/books/<book_id>` read from the updated row.

#### 2. Delete-relationship route

**File**: `src/pages/api/relationships/[id]/delete.ts` (new)

**Intent**: Remove one connection. A separate route because HTML forms cannot issue DELETE.

**Contract**: `POST` plus `prerender = false`. Guards `locals.user`, deletes by `params.id`
under RLS, returns `book_id` from the deleted row for the redirect.

#### 3. Inline edit and delete controls

**File**: `src/pages/books/[id].astro`

**Contract**: Each rendered connection gains a native POST form to `/api/relationships/<id>`
carrying a hidden `anchor_id`, a select of the other cast members preset to the current other
end, and a type select preset to the current type; plus a sibling form posting to
`/api/relationships/<id>/delete`. Both inside the character's existing `<details>`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean on touched files
- Harness still passes: `npm run db:verify-rls`

#### Manual Verification:

- Changing a relationship's type updates it under both characters
- Changing the other character moves the connection, and it disappears from the previous
  partner's row
- **Editing from the row of the character stored in `character_b_id` rewrites the correct end**
  — the anchor-column trap from Critical Implementation Details
- Deleting a relationship removes it from both characters' rows
- Edit and delete both work with JavaScript disabled
- A second account cannot edit or delete the first account's relationship by id

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

None — no test runner, unchanged since F-01.

### Integration Tests:

- `npm run db:verify-rls` extended with a relationships block, both directions, and both
  controls: a too-broad policy must fail the check and so must a too-narrow one.

### Manual Testing Steps:

1. `npx supabase start`, `npx supabase db reset`, then `npm run db:verify-rls`.
2. `npm run dev`, sign in, open the _Dune_ test book with its existing characters.
3. Add a third character so a pair and a spare exist.
4. Under character 1, add a relationship to character 2 with type "ally".
5. Confirm it renders under BOTH character 1 and character 2, with no clicking.
6. Confirm character 1's select does not offer character 1.
7. From character 2's row — the one stored in `character_b_id` — change the other end to
   character 3 and confirm the connection moves off character 1.
8. Change a type; confirm both rows update.
9. Delete a relationship; confirm it leaves both rows.
10. Delete a character; confirm its relationships vanish from the remaining rows.
11. Narrow to 375px and repeat steps 4–5. Disable JavaScript and repeat steps 4, 8 and 9.
12. As a second reader, confirm none of the first reader's characters or relationships appear.

## Performance Considerations

The relationships lookup matches either column, so it uses the two single-column indexes rather
than a composite. Grouping happens in the page over a personal-scale result set. Page length
grows with the cast — accepted for now and solved by collapsing later, not by pagination.

## Migration Notes

One new table, no data to migrate. Rollback is deleting the migration and running
`npx supabase db reset`; relationships rows are development data only. The remote schema needs
`npx supabase db push` when this deploys — the two databases are distinct, so that step is not
implicit.

## References

- Roadmap item: `context/foundation/roadmap.md` § Slices → S-03
- Extension point: `src/pages/books/[id].astro:110`
- Route idiom: `src/pages/api/books/[id]/characters.ts`
- RLS template and conventions: `CLAUDE.md` § Key conventions
- Recurring rules: `context/foundation/lessons.md`
- Prerequisite slice: `context/archive/2026-09-10-character-notes-crud/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Relationships data layer and isolation harness

#### Automated

- [x] 1.1 Migration applies from scratch: `npx supabase db reset`
- [x] 1.2 Harness passes with the relationships block: `npm run db:verify-rls`
- [x] 1.3 Negative control: too-broad `relationships_select_own` makes the check FAIL, then restored
- [x] 1.4 Positive control: too-narrow `relationships_update_own` makes the check FAIL, then restored
- [x] 1.5 Types regenerate and contain a `relationships` row type: `npm run db:types`
- [x] 1.6 Type checking and build pass: `npx astro check`, `npm run build`
- [x] 1.7 Linting passes: `npm run lint`

#### Manual

- [x] 1.8 Studio shows `relationships` with RLS enabled and exactly four `authenticated` policies
- [x] 1.9 Deleting a character cascades its relationships away
- [x] 1.10 The type check rejects an unknown value and the self-relationship check rejects a = b

### Phase 2: Relationships inline under every character

#### Automated

- [ ] 2.1 Type checking passes: `npx astro check`
- [ ] 2.2 Production build succeeds: `npm run build`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 Formatting is clean on touched files
- [ ] 2.5 Harness still passes: `npm run db:verify-rls`

#### Manual

- [ ] 2.6 A relationship added under one character appears under BOTH characters
- [ ] 2.7 Connections are visible without any clicking (US-01 satisfied at zero interactions)
- [ ] 2.8 The other-character select excludes the character whose row it is in
- [ ] 2.9 A character with no relationships renders NO relationship section at all — no empty heading, no "None", no bare separator
- [ ] 2.10 At 375px no zooming, vertical scrolling only
- [ ] 2.11 With JavaScript disabled the add form still submits
- [ ] 2.12 A second account's characters never appear in the select

### Phase 3: Edit and delete a relationship

#### Automated

- [ ] 3.1 Type checking passes: `npx astro check`
- [ ] 3.2 Production build succeeds: `npm run build`
- [ ] 3.3 Linting passes: `npm run lint`
- [ ] 3.4 Formatting is clean on touched files
- [ ] 3.5 Harness still passes: `npm run db:verify-rls`

#### Manual

- [ ] 3.6 Changing a relationship's type updates it under both characters
- [ ] 3.7 Changing the other character moves the connection off the previous partner
- [ ] 3.8 Editing from the `character_b_id` side rewrites the correct end
- [ ] 3.9 Deleting a relationship removes it from both characters' rows
- [ ] 3.10 Edit and delete both work with JavaScript disabled
- [ ] 3.11 A second account cannot edit or delete the first account's relationship by id
