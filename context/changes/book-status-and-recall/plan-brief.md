# Book Status and Finished-Book Recall — Plan Brief

> Full plan: `context/changes/book-status-and-recall/plan.md`
> Roadmap item: `context/foundation/roadmap.md` § Slices → S-04 (last slice of M-1)

## What & Why

A book gets a finished state with the date it happened, a reader can mark it or reopen it, and
the collection can be filtered by status. This is the last slice of phase 1 as the PRD declared
it — FR-009 and US-04 — so finishing it closes milestone M-1.

## Starting Point

`books` has six columns and no status of any kind. `/books` lists everything ordered by date
added. And crucially, `/books/[id]` after S-03 already renders the cast with every character's
relationships inline — which is the recall reference US-04 asks for, decided before planning.

## Desired End State

Opening a finished book shows "Finished on 12 September 2026" and a control to reopen it; an
unfinished one offers to mark it finished. `/books` lists everything by default, with links
narrowing to currently-reading or finished and a quiet marker on each row. A finished book's
page still shows every character and connection the reader recorded.

## Key Decisions Made

| Decision         | Choice                                        | Why (1 sentence)                                                                             | Source |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| Recall view      | None — `/books/[id]` already is it            | S-03 renders cast and relationships inline; a second presentation of the same data is waste. | User   |
| Schema           | One nullable `finished_at`, status derived    | One column carries both facts FR-009 needs, so it cannot contradict itself.                  | User   |
| Filter default   | All books; links narrow to active or finished | Nothing is hidden by default, so the empty-default-view case cannot arise.                   | User   |
| Control          | On the book page, reversible                  | You finish a book while looking at it, and undoing a mis-tap costs only the date.            | User   |
| Toggle semantics | Form submits the target state, never "flip"   | A double submit on a slow phone would otherwise finish and immediately reopen the book.      | Plan   |
| Harness          | No new assertions, regression run only        | Policies act on whole rows, so a nullable column adds no access path they do not cover.      | Plan   |

## Scope

**In scope:** `finished_at` migration; regenerated types; a finish/reopen route taking the
desired state; status and control on the book page; `?status=` filter with three links and a
row marker; the US-04 verification.

**Out of scope:** any separate finished-book view; progress tracking of any kind (§ Non-Goals);
a third state; a `status` column; events (FR-005); sorting or search (FR-008); new harness
assertions; reader-defined relationship types (next milestone).

## Architecture / Approach

`finished_at` is the status: null means currently reading, a timestamp means finished on that
date, and the filter is `is null` / `is not null`. There is no flag to contradict it. The
control is a native POST carrying the state it wants, so it is idempotent under a double tap.
Nothing here needs client JavaScript, and RLS covers the new column for free because policies
act on whole rows.

## Phases at a Glance

| Phase                                          | What it delivers                                     | Key risk                                                             |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Mark a book finished, and reopen it         | Column, types, route, status and control on the page | A "flip" toggle would be non-idempotent under a double submit        |
| 2. Filter the collection, read a finished book | `?status=` filter, row markers, US-04 verification   | Drift toward progress tracking, which § Non-Goals explicitly forbids |

**Prerequisites:** Docker for the local stack; S-01 done (and S-02/S-03, which make US-04 fully
checkable). Test data present: _Dune_ with three characters and one relationship.
**Estimated effort:** Short — one column, one route, one filter. Every idiom is inherited.

## Open Risks & Assumptions

- **Reopening a finished book is beyond FR-009 as written**, which names only "mark as
  finished". Included because a mis-tap would otherwise be permanent, and the cost of undoing
  is one discarded date. Recorded rather than assumed.
- **US-04 mentions "key events"**, which are FR-005 and parked. The criterion is satisfied by
  characters and relationships alone — the roadmap's S-04 Risk line anticipated exactly this.
- **The remote schema needs `db push`** when this deploys; the two databases are distinct.
- **`finished_at` has no index.** At personal-collection scale it would cost more to maintain
  than it saves; add one only if a collection ever grows past thousands.

## Success Criteria (Summary)

- A reader can tell at a glance what they are reading now and what they have finished.
- A book finished months ago still opens onto its full cast and connections — the recall
  moment the product was built for.
- Marking and unmarking leaves no trace but the presence or absence of a date.
