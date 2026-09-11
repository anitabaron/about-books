---
change_id: book-edit-and-delete
title: Reader can fix a book's title or author, and delete a book
status: archived
created: 2026-09-10
updated: 2026-09-11
archived_at: 2026-09-11T10:42:00Z
---

## Notes

Scope: a reader can fix a typo in a book's title or author, and delete a book
they no longer want. Nothing else.

Why now: FR-002 covers adding a book only, so this was never a PRD gap and it
has sat in the roadmap's Parked list since M-1 planning. It surfaced as a real
one in use — a mistyped title is currently permanent, and the app that fixes
character names cannot fix the name of the book they live in. Pull it out of
Parked as a defect-driven fix, not as an M-2 slice: M-2's intent is the
reader's own vocabulary, and filing this under that milestone would dilute its
Done-when. Say so explicitly in change.md so the roadmap stays honest.

Skip /10x-research. There is nothing to discover — this is a copy of a pattern
the codebase already runs twice, and the research step would cost more than the
change.

What exists to build on:
- `updateBookSchema` is already in src/types.ts, written during M-1 and unused
  since. Use it; do not write a second schema.
- src/pages/api/characters/[id].ts and src/pages/api/characters/[id]/delete.ts
  are the exact shape to copy: POST, prerender = false, formData() → Zod →
  redirect with ?error= on failure.
- The nested-<details> delete confirmation from ceb5bca is the interaction
  pattern; the destructive submit must not exist in the DOM until the reader
  opens it.
- books RLS already carries all four per-operation policies and the harness
  proves them in both directions, so there is no new isolation work — but do
  confirm reader B cannot update or delete reader A's book before calling it
  done.

Endpoints: POST /api/books/[id] (update) and POST /api/books/[id]/delete.
Management lives on the book page /books/[id], next to where the title is
rendered, not on the collection list — same place a reader manages everything
else about that book.

The delete confirmation names the book and says plainly that its characters and
their connections go with it. No count needed; this is a warning, not a
refusal.

One thing that is NOT routine, and is the reason this change deserves a careful
verification pass rather than a quick one. Deleting a book is the first
operation that fires the whole cascade at once: books → characters →
relationships, and books → relationship_types, whose id is referenced by
relationships.custom_type_id. That FK is NO ACTION rather than RESTRICT
precisely so the cascade resolves at end of statement instead of failing on
whichever branch happens to fire first. Until now that path was unreachable,
because nothing could delete a book. This change makes it reachable, and it
makes the book-delete cascade assertion added in Phase 1 load-bearing rather
than anticipatory.

So the verification must include, explicitly: delete a book that has characters,
connections between them, at least one reader-defined type, and at least one
connection using that type. It must succeed and leave nothing orphaned. Run
`npm run db:verify-rls` as well — the assertion is already in there.

Do not add unit tests for this; it is plain CRUD with no logic to extract, and
the certification criterion for CRUD is already met by characters and
relationships. Do not touch the schema. One phase is enough.

## Milestone placement

Deliberately NOT an M-2 slice. M-2 (`readers-own-vocabulary`) is scoped to
FR-004's amended vocabulary work, and folding a books-CRUD fix into it would
dilute its Done-when. This is a defect-driven fix pulled out of the roadmap's
Parked list, tracked by its own change folder with no roadmap item — so
`/10x-plan` and `/10x-archive` will both report "no item with Change ID
book-edit-and-delete", which is the correct and expected outcome here, not a
lookup failure.
