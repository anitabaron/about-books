# Reader-defined relationship types — Plan Brief

> Full plan: `context/changes/reader-defined-relationship-types/plan.md`

## What & Why

FR-004's five shared relationship types (family / ally / antagonist / romantic / other) turned
out too narrow once the app was actually used. The connections a reader wants to record are
often book-specific — "lives with", "serves" — and forcing them into `other` loses exactly the
information the note was for. This slice lets a reader define their own types, scoped to one
book, and use them alongside the five, which stay immutable.

## Starting Point

M-1 shipped relationships with a fixed vocabulary: `RELATIONSHIP_TYPES` in `src/types.ts` is the
single source of truth for the Zod schemas, both `<select>` elements and (independently) the
migration's check constraint. `relationships` carries `type text not null` and no `book_id` — the
book is reached through `characters`, and both write endpoints already resolve it that way to
reject cross-book pairs.

## Desired End State

A reader opens a book, opens "Relationship types", types `lives with`, and it appears in that
book's connection forms in a group separate from the shared five. The connection renders under
both characters. Renaming the type once updates every connection holding it. Deleting a type
still in use is refused with a sentence naming how many connections hold it. A reader who never
opens that disclosure sees exactly the app they had before.

## Key Decisions Made

| Decision                              | Choice                                                | Why (1 sentence)                                                                                              | Source  |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| The shared five                       | Stay in code, immutable                               | A reader who wants nothing more never meets the extra machinery.                                              | Roadmap |
| How a connection stores a custom type | Foreign key to the type's row, never the name as text | One row holds the name, so a rename propagates to every connection at once.                                   | Roadmap |
| Type-source shape                     | Two nullable columns, exactly one filled (XOR check)  | Keeps the five in the existing check constraint while custom types get referential integrity.                 | Roadmap |
| Deleting a type in use                | Foreign key (NO ACTION), app translates the error     | The database enforces the refusal; NO ACTION defers the check, so a cascading book delete is unaffected.      | Roadmap |
| Table scope                           | name, book, owner — nothing else                      | This table invites growth (colours, icons, ordering); the guard is explicit so planning cannot drift.         | Roadmap |
| **Language**                          | **English throughout; no Polish display map**         | Reversed 2026-09-10 — and custom types are themselves the answer to "ally" reading wrong in domestic fiction. | Plan    |
| Per-book scoping of a type            | Application-level check in the write endpoints        | The endpoints already compare `book_id` the same way for characters; a trigger would be a new mechanism.      | Plan    |
| Where management lives                | Nested `<details>` on the book page                   | No new route or navigation, and the pattern is already used three times in that file.                         | Plan    |
| Type picker                           | One `<select>` with `<optgroup>`                      | One field and one click keeps US-02's 30-second bar; `<optgroup>` is native so the form works without JS.     | Plan    |
| Name resolution on read               | Second query plus a `Map`                             | Mirrors the existing `nameById`, keeps `.or()` untouched, and avoids betting the read on PostgREST embedding. | Plan    |

## Scope

**In scope:** the `relationship_types` table with full RLS and the harness block; two nullable
columns with an XOR constraint on `relationships`; create / rename / delete endpoints; a merged
grouped type picker in both connection forms; the cast read resolving either source; a
management disclosure on the book page; the refusal message with its count.

**Out of scope:** the Polish display map (reversed); any change to the five; anything on the
table beyond name/book/owner; reuse or copying of types across books; the duplicate-pair fix
(S-02, blocked); a separate management route.

## Architecture / Approach

`relationship_types` is one row per reader-defined name per book, owned via `user_id` and
isolated by the same four-policy RLS template every other table uses. A connection points at
either a shared literal (`type`) or a custom row (`custom_type_id`), never both and never
neither. Writes resolve the submitted value by shape and confirm a custom type belongs to the
anchor character's book. The read loads the book's types once and resolves each connection to a
display label, which is the one place the two sources converge.

## Phases at a Glance

| Phase                       | What it delivers                                        | Key risk                                                                                                |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1. Schema, isolation, types | Table + RLS + XOR shape, harness block, generated types | New harness assertions must catch their own exceptions or the script aborts; production needs `db push` |
| 2. Define a type and use it | The north star — define, pick, save, read back          | One form field carrying two meanings; a UUID that isn't this book's type                                |
| 3. Rename, then delete      | Rename propagation, then the counted refusal            | Rename is what repairs a typo; delete is the cut line, not the pair                                     |

**Prerequisites:** M-1 shipped (`cast-and-relationships-view`); local Supabase running for the
harness; `psql` on PATH for `db:verify-rls`. Reaching production additionally needs
`npx supabase db push` — a separate deploy from `git push`, missed twice on this project.
**Estimated effort:** three phases, each one sitting behind a manual gate.

## Open Risks & Assumptions

- **The common case must not get worse.** If the connection form grows a step or a longer select
  before it grows value, the slice has made the frequent path worse to serve the rare one — and
  US-02's 30-second capture bar is what would break.
- **`type` becoming nullable is a type-level ripple that the compiler will NOT catch.**
  `createServerClient` is called without the `<Database>` generic and the relationships read
  hand-asserts its row shape, so `astro check` believes `src/types.ts` rather than the schema —
  a missed read site stays green and fails at runtime as a blank label. Extracting the
  resolution loop into `src/lib/connections.ts` (Phase 2) is what makes that logic reachable by
  a test at all; adding the generic is its own change.
- **A typo becomes vocabulary if rename is cut.** Add ships in Phase 2, rename and delete in
  Phase 3 — rename first, because it is the half that repairs a typo. Delete cannot repair one:
  the foreign key refuses to remove a type in use. So the cut line is delete, not the pair.
- Assumed: `relationship_types` needs no `updated_at` consumer beyond convention, but the trigger
  is attached anyway because omitting it yields a column that looks right and lies.

## Success Criteria (Summary)

- A reader can record "lives with" on one book and read it back under both characters, with the
  shared five behaving exactly as before.
- Fixing a typo in a custom name fixes it everywhere, in one action.
- A second reader can neither see nor act on any of it — proven by `npm run db:verify-rls` and,
  for Phase 3, against the deployed app with two real accounts.
