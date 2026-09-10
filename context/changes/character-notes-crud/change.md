---
change_id: character-notes-crud
title: Add, edit and delete characters within a book (roadmap S-02)
status: implementing
created: 2026-09-10
updated: 2026-09-10
archived_at: null
---

## Notes

S-02 from @roadmap.md — user can add a character to a book with a name alone in under 30
seconds on a phone, then edit or delete it and fill in the description note later.
PRD refs FR-003, US-02. Prerequisite S-01 is done and archived at
`context/archive/2026-09-09-manual-book-entry/`.

Decisions given up front, not to be re-litigated:

- Route `/books/[id]` — the book's own page, form above, list below, same idiom as `/books`.
  S-03's cast view extends this page; do not invent a second shape.
- No `PROTECTED_ROUTES` change. Middleware matches by prefix, so `/books` already covers
  `/books/[id]` — verified.
- Native POST + formData + redirect, reusing FormField / SubmitButton / ServerError from
  `src/components/auth/`. Exactly S-01's idiom.
- Migration copies the RLS template from `CLAUDE.md` verbatim. `characters` carries both
  `user_id uuid not null default auth.uid()` (the RLS predicate, same as books) and
  `book_id uuid not null references public.books(id) on delete cascade` (the relation).
  Policies check `auth.uid() = user_id` directly — no join through `books` to derive
  ownership: slower, and the template is the convention four tables will share.
- Attach the `set_updated_at()` trigger; do NOT recreate the function.
- Extend `supabase/tests/rls_books.sql` with a characters block, both directions.
- `npm run db:types` after the migration.

This slice's own decisions, needing care:

1. **Edit and delete ARE in scope.** FR-003 says full CRUD and the roadmap's S-02 outcome
   names editing and deleting explicitly. Books were the exception, not the rule — do not cut
   CRUD here by analogy with S-01.
2. **US-02 sets a hard ergonomic bar:** a character must be creatable with a NAME ALONE, in
   under 30 seconds, on a phone. The description is filled in later as reading progresses. A
   form that requires anything beyond a name to submit fails the story regardless of what
   else works.

`/10x-plan-review` is deliberately skipped: the foundation earned that scrutiny, a character
form does not, and the time budget is real (hard deadline 2026-09-12).
