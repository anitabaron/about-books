---
change_id: manual-book-entry
title: Add a book to your own collection (roadmap S-01)
status: implementing
created: 2026-09-09
updated: 2026-09-10
archived_at: null
---

## Notes

S-01 z @roadmap.md

Resolved: roadmap S-01 — user can add a book by typing title and author, and see it listed
in a collection nobody else can read. PRD refs FR-002, FR-001, US-01. Prerequisite F-01 is
done (archived at `context/archive/2026-09-09-private-by-default-data-contract/`), so the
schema, RLS policies, `Book` entity and Zod command schemas already exist — this slice wires
them to a route and a screen rather than deciding any of them again.

Two unknowns inherited from the roadmap, neither blocking:

1. **Deployed-path isolation is unproven** — F-01's criterion 4.7. Its harness
   (`npm run db:verify-rls`) proves the policies, and the remote project has the migration
   and the four `authenticated` policies, but no screen ever created a book, so the deployed
   request path was never exercised. This slice must verify a book created through the
   deployed UI is invisible to a second remote account. Owner: this slice.
2. **UI language is undecided** — validation messages in `src/types.ts` are Polish (following
   `src/lib/config-status.ts`); the rest of the UI is English. S-01 adds the first real
   screens, so it should settle this. Five strings now, fifty after S-03. Owner: user.

Deliberately thin: a plain unsorted list is the whole surface. Collection browse and search
(FR-008) and external metadata lookup (FR-002b) are both phase 2 — scope creep back into
those two is the named failure mode.
