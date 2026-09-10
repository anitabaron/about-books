---
change_id: cast-and-relationships-view
title: Cast and relationships view (roadmap S-03)
status: implemented
created: 2026-09-10
updated: 2026-09-10
archived_at: null
---

## Notes

Roadmap S-03 — **the north star**. User can name a relationship between two characters
(family / ally / antagonist / romantic / other), and read the whole cast with relationship
types and notes as a list or table, reaching any character's connections in one interaction.
PRD refs FR-004, FR-007 (list/table view only), US-01.

Prerequisite S-02 is done and archived at `context/archive/2026-09-10-character-notes-crud/`,
so `characters`, the `/books/[id]` page, the RLS template and the form idiom all exist. This
slice extends that page rather than adding another surface — decided during S-02 planning.

**The load-bearing constraint, from the roadmap's own Risk line:** US-01 requires reaching a
character's connections "in one interaction". A flat table of relationships does not satisfy
that. Linked events are phase 2 (FR-005), so this must hold for relationships alone without
designing itself into a corner when events arrive. The visual diagram stays parked — FR-007's
Socratic resolution makes the list the primary readable view.

Inherited from the three completed changes:

- RLS template in `CLAUDE.md`, now on its third use. `relationships` needs `user_id` for the
  policy predicate plus two character references; policies check `auth.uid() = user_id`
  directly, never by join.
- Extend `supabase/tests/rls_books.sql` with a relationships block, both directions, and run
  `npm run db:types` after the migration.
- Native POST + formData + Zod + `?error=` redirect; reuse the form primitives in place.
- **Astro trap:** any top-level `return` in frontmatter crashes
  `@typescript-eslint/no-misused-promises` ("Expected node to have a parent"). Use
  `Astro.response.status` instead. Recorded only in commit `cfbe4ab` so far, not in
  `lessons.md`.
- Local dev points at the local Supabase stack; a schema change needs `db reset` locally and
  `db push` remotely.
- Test data in the local stack: book *Dune* with *Paul Atreides* and *Duncan Idaho*, readers
  `ca@t.test` / `cb@t.test` (password `probe-123456`) — useful material for building
  relationships.

Deadline: `hard_deadline: 2026-09-12`.
