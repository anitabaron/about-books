---
change_id: book-status-and-recall
title: Book status and finished-book recall (roadmap S-04)
status: implementing
created: 2026-09-10
updated: 2026-09-10
archived_at: null
---

## Notes

Roadmap S-04 — the last slice that closes phase 1 against the PRD. User can mark a book
finished (with the date recorded), filter their collection by active versus finished, and open
a finished book to read its cast and notes back as a self-contained reference.
PRD refs FR-009, US-04.

Prerequisite S-01 is done. S-02 and S-03 also landed, so US-04's acceptance is now fully
checkable — the roadmap's Risk line said to verify it last for exactly this reason, and that
ordering is no longer a constraint.

**FR-009 is deliberately tiny:** a two-state flag (active / finished) plus one timestamp on the
transition. The named failure mode is drift into progress tracking — § Non-Goals rules out page
counters, percentages, timers and streaks. If this slice grows a progress bar, it has gone
wrong.

**Answered before planning:** a finished book does NOT need a separate view. `/books/[id]`
after S-03 already shows the cast with its relationships, which is the recall reference US-04
asks for. So this slice is the flag, the date, the filter and the verification — no second
presentation of the same data.

**US-04's second acceptance criterion, for the record:** "the finished book view is
readable as a self-contained reference — names, brief notes, and key events are enough to jog
memory". Events are FR-005, parked in phase 2, so this must satisfy the criterion with
characters and relationships alone. S-03 already renders both inline on `/books/[id]`, so the
question is whether a finished book needs a different presentation at all, or whether the
existing page already is the recall view.

Inherited and settled across F-01, S-01, S-02 and S-03:

- RLS template in `CLAUDE.md` — but this slice likely adds a column, not a table, so the
  template may not apply. A column addition still needs `db reset` locally and `db push`
  remotely; the two databases are distinct.
- `npm run db:verify-rls` covers three tables in both directions; extend it if the schema
  changes in a way the existing assertions do not reach.
- `npm run db:types` after any migration.
- Native POST + formData + Zod + `?error=` redirect; reuse the form primitives in place.
- **Astro trap:** no top-level `return` in frontmatter — use `Astro.response.status`. See
  `context/foundation/lessons.md`.
- Verify scripted edits by structure, not by exit code — same file, third lesson.
- Test data in the local stack: book *Dune*, characters Paul Atreides / Chani / Duncan Idaho,
  one relationship (Chani ↔ Duncan, family). Readers `ra@t.test` / `rb@t.test`, password
  `probe-123456`.

Deadline: `hard_deadline: 2026-09-12`. S-05 (reader-defined relationship types) is sequenced
after this one and will not close M-1 before the deadline.
