# Book Status and Finished-Book Recall Implementation Plan

## Overview

Give a book a finished state with the date it happened, let a reader mark it or reopen it from
the book page, and let them filter the collection by status — with the cast and relationships
still on the page for a finished book, which is the recall reference US-04 asks for.

This is roadmap item **S-04**, the last slice of M-1. It closes phase 1 against the PRD.

## Current State Analysis

- **`books` has no status of any kind** — six columns, queried directly: `id`, `user_id`,
  `title`, `author`, `created_at`, `updated_at`. This slice adds one column, not a table.
- **`src/pages/books.astro:22`** selects `id, title, author, created_at` ordered
  `created_at desc`. The filter goes here; the row render at `:77` is where a status marker
  shows.
- **`/books/[id]` after S-03 already renders the cast with its relationships inline** — cast
  names, notes, and each character's connections, with no clicking. **This IS the recall
  reference**, decided before planning: a finished book needs no second presentation of the
  same data.
- **RLS is unaffected.** Policies act on whole rows, so a new column is covered automatically.
  The harness needs no new assertions, only a regression run.
- Every idiom is inherited: native POST + `formData()` + Zod + `?error=` redirect,
  `Astro.response.status` instead of a top-level `return`, `db:types` after a migration, and
  `db reset` locally plus `db push` remotely because the two databases are distinct.

## Desired End State

A reader opens a book they have finished and sees "Finished on 12 September 2026" with a
control to reopen it; an unfinished book shows a control to mark it finished. `/books` lists
everything by default, with links narrowing to currently-reading or finished, and each row
carries a quiet marker. A finished book's page still shows every character and connection the
reader recorded.

Verification: `npm run db:verify-rls` still passes, `npx astro check` and `npm run build` are
clean, and marking a book finished then reopening it leaves no trace but the absent date.

### Key Discoveries:

- `books` columns queried live — no status exists, so nothing needs migrating, only adding.
- `src/pages/books.astro:22` and `:77` — the two touch points for filtering and marking.
- `src/pages/api/books/[id]/characters.ts` — the route idiom to copy, including the
  RLS-filtered parent lookup that makes "not found" the rejection path.
- `context/foundation/lessons.md` — no top-level `return` in Astro frontmatter.

## What We're NOT Doing

- **No separate finished-book view.** Decided before planning: `/books/[id]` after S-03 already
  is the recall reference. Building a second presentation of the same data was the expensive
  half of this slice and it is not needed.
- **No progress tracking of any kind** — no page counters, percentages, timers or streaks.
  § Non-Goals rules them out, and drift toward them is this slice's named failure mode. If a
  progress bar appears, the slice has gone wrong.
- **No third state.** Active and finished only; "abandoned" is not in FR-009.
- **No `status` column.** A single `finished_at` carries both facts FR-009 needs.
- **No events** — FR-005 is parked, so US-04's "key events" half is satisfied by characters and
  relationships alone, as the roadmap's S-04 Risk line anticipated.
- **No sorting or search** — FR-008 is phase 2. Filtering by status is not sorting.
- **No new harness assertions** — a nullable column adds no access path RLS does not already
  cover. The harness still runs as a regression check.
- **No reader-defined relationship types** — that is the next milestone's first item.

## Implementation Approach

Two phases. Phase 1 adds the column and the toggle, so a reader can mark a book finished and
see it. Phase 2 adds the collection filter and verifies US-04's recall criterion against a
genuinely finished book. The migration rides with Phase 1 because on its own it produces
nothing a human can check.

## Critical Implementation Details

**The toggle must submit the desired state, not "flip whatever it is now."** A form that means
"invert the current value" gives a different result depending on how many times it is
submitted — a double tap on a slow phone connection would finish a book and immediately reopen
it. The form carries the target state explicitly, so submitting twice is idempotent.

**`finished_at` is the status.** There is no separate flag, so nothing can contradict anything:
`null` means currently reading, a timestamp means finished on that date. The filter is
`is null` / `is not null`. Do not add a boolean "for convenience" — that reintroduces exactly
the contradiction this shape removes.

## Phase 1: Mark a book finished, and reopen it

### Overview

The column, the regenerated types, the route, and the control on the book page.

### Changes Required:

#### 1. Finished-at migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_books_finished_at.sql` (new)

**Intent**: Record whether a book is finished and when, in one column that cannot contradict
itself.

**Contract**: `alter table public.books add column finished_at timestamptz` — nullable, no
default, so every existing book reads as currently reading. No RLS change: policies act on
whole rows and already cover the new column. No index: the filter runs over a personal
collection and `books` already carries `(user_id, created_at desc)`.

#### 2. Regenerated database types

**File**: `src/db/database.types.ts`

**Contract**: Output of `npm run db:types`. Generated; already excluded from lint and prettier.

#### 3. Finish/reopen route

**File**: `src/pages/api/books/[id]/finish.ts` (new)

**Intent**: Set or clear the finished date for one book.

**Contract**: `POST` plus `prerender = false`. Guards `context.locals.user`. Reads a `finished`
field from `formData()` and validates it with a Zod schema accepting exactly `"true"` or
`"false"` — the desired state, never a flip. Updates `finished_at` to `new Date().toISOString()`
or `null` accordingly, scoped by `.eq("id", params.id)` under RLS, so another reader's book is
simply not found. Redirects to `/books/<id>`, or to `/books` with `?error=` when the book is not
the reader's.

#### 4. Status and control on the book page

**File**: `src/pages/books/[id].astro`

**Intent**: Show whether the book is finished and when, and offer the one control that changes
it — you finish a book while looking at it.

**Contract**: The book query gains `finished_at`. The header renders "Finished on <date>" using
the existing `dateFormatter` when set, and nothing when null. A native POST form to
`/api/books/<id>/finish` carries a hidden `finished` field — `"true"` when the book is currently
reading, `"false"` when it is finished — with the button labelled to match. No island; no client
JavaScript.

### Success Criteria:

#### Automated Verification:

- Migration applies from scratch: `npx supabase db reset`
- Types regenerate and contain `finished_at` on the books row type: `npm run db:types`
- Harness still passes as a regression check: `npm run db:verify-rls`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Linting passes on the files this phase touched:
  `npx eslint src/types.ts src/pages/api/books/[id]/finish.ts src/pages/books/[id].astro`.
  Repo-wide `npm run lint` is currently broken by another session's git worktree under
  `.claude/worktrees/`, which holds a second copy of the project: `eslint.config.js` ignores
  `src/db/database.types.ts` by exact path, so the copy at a different path gets linted. Four
  files there report errors. Not this change's code, and not this change's files to fix.
- Formatting is clean on the files this phase touched (`npx prettier --check` on them)

#### Manual Verification:

- A book with no finished date shows a control to mark it finished, and no date line
- Marking it finished shows "Finished on <today>" and the control now offers to reopen it
- Reopening it removes the date line and restores the original control
- **Submitting the same form twice in a row does not toggle back** — the state is the one the
  form asked for, not the inverse of whatever it was
- The control works with JavaScript disabled
- Another reader's book id cannot be finished — the request is refused

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful
before proceeding to the next phase.

---

## Phase 2: Filter the collection, and read a finished book back

### Overview

The status filter on `/books`, a marker on each row, and the verification that closes US-04.

### Changes Required:

#### 1. Status filter and marker

**File**: `src/pages/books.astro`

**Intent**: Let a reader separate what they are reading now from what they have finished, which
is the whole of FR-009's second sentence.

**Contract**: Reads `Astro.url.searchParams.get("status")`. **No parameter means all books** —
nothing is ever hidden by default. `active` filters `finished_at is null`; `finished` filters
`is not null`; any other value falls back to all rather than erroring. Three links — all /
currently reading / finished — with the active one marked. The query gains `finished_at`, and
each row renders a quiet marker plus the finished date when set. Ordering stays
`created_at desc`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean on touched files
- Harness still passes: `npm run db:verify-rls`

#### Manual Verification:

- `/books` with no parameter lists every book, finished and not
- `/books?status=active` lists only books with no finished date; `?status=finished` only those
  with one
- A nonsense value such as `?status=banana` falls back to all books rather than erroring or
  showing nothing
- Each row shows its status, and finished rows show the date
- **US-04: opening a finished book still shows its whole cast with relationships** — the recall
  reference, satisfied by the page S-03 already built
- At 375px the filter links and rows need no zooming and scroll only vertically
- A second reader's books never appear under any filter value

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

None — no test runner, unchanged since F-01.

### Integration Tests:

- `npm run db:verify-rls` runs unchanged as a regression check. No new assertions: a nullable
  column adds no access path the three existing blocks do not already cover, because policies
  act on whole rows.

### Manual Testing Steps:

1. `npx supabase start`, `npx supabase db reset`, `npm run db:verify-rls`.
2. `npm run dev`, sign in as `ra@t.test`, open _Dune_.
3. Mark it finished; confirm the date line and the reopened control.
4. Submit the same form twice; confirm the state does not flip back.
5. Reopen it; confirm the date line disappears.
6. Add a second book so one is finished and one is not.
7. Visit `/books`, `?status=active`, `?status=finished`, `?status=banana`.
8. Mark _Dune_ finished again and open it; confirm the cast and the Chani–Duncan connection are
   still there.
9. Narrow to 375px and repeat step 7. Disable JavaScript and repeat steps 3 and 5.
10. As `rb@t.test`, confirm none of the first reader's books appear under any filter.

## Performance Considerations

Negligible. The filter adds one predicate to a query over a personal collection, and
`(user_id, created_at desc)` already serves the ordering. No index on `finished_at`: at this
scale it would cost more to maintain than it saves.

## Migration Notes

One nullable column, no backfill: absent means currently reading, which is the correct reading
of every existing book. Rollback is `alter table public.books drop column finished_at`, and
nothing else depends on it. The remote schema needs `npx supabase db push` when this deploys.

## References

- Roadmap item: `context/foundation/roadmap.md` § Slices → S-04
- Recall reference already built: `src/pages/books/[id].astro` (S-03)
- Route idiom: `src/pages/api/books/[id]/characters.ts`
- Collection list: `src/pages/books.astro:22` and `:77`
- Recurring rules: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mark a book finished, and reopen it

#### Automated

- [x] 1.1 Migration applies from scratch: `npx supabase db reset`
- [x] 1.2 Types regenerate and contain `finished_at`: `npm run db:types`
- [x] 1.3 Harness still passes as a regression check: `npm run db:verify-rls`
- [x] 1.4 Type checking passes: `npx astro check`
- [x] 1.5 Production build succeeds: `npm run build`
- [x] 1.6 Linting passes on this phase's files (`npx eslint` on the three, exit 0); repo-wide `npm run lint` is broken by another session's worktree under `.claude/worktrees/`
- [x] 1.7 Formatting is clean on touched files

#### Manual

- [x] 1.8 An unfinished book shows a mark-finished control and no date line
- [x] 1.9 Marking it finished shows "Finished on <today>" and offers to reopen
- [x] 1.10 Reopening removes the date line and restores the original control
- [x] 1.11 Submitting the same form twice does not toggle back
- [x] 1.12 The control works with JavaScript disabled
- [x] 1.13 Another reader's book id cannot be finished

### Phase 2: Filter the collection, and read a finished book back

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 0a5f9b3
- [x] 2.2 Production build succeeds: `npm run build` — 0a5f9b3
- [x] 2.3 Linting passes: `npm run lint` — 0a5f9b3
- [x] 2.4 Formatting is clean on touched files — 0a5f9b3
- [x] 2.5 Harness still passes: `npm run db:verify-rls` — 0a5f9b3

#### Manual

- [x] 2.6 `/books` with no parameter lists every book — 0a5f9b3
- [x] 2.7 `?status=active` and `?status=finished` each list only their own — 0a5f9b3
- [x] 2.8 A nonsense status value falls back to all books rather than erroring — 0a5f9b3
- [x] 2.9 Each row shows its status, and finished rows show the date — 0a5f9b3
- [x] 2.10 US-04: a finished book still shows its whole cast with relationships — 0a5f9b3
- [x] 2.11 At 375px the filter links and rows need no zooming, vertical scrolling only — 0a5f9b3
- [x] 2.12 A second reader's books never appear under any filter value — 0a5f9b3
