---
change_id: private-by-default-data-contract
title: Private-by-default data contract (roadmap F-01)
status: implemented
created: 2026-09-09
updated: 2026-09-09
archived_at: null
---

## Notes

F-01 z @roadmap.md

Resolved: roadmap F-01 — first domain migration with row-level security and granular
per-operation, per-role policies, shared entity/DTO types, and a checked cross-reader
isolation path. Unlocks S-01–S-04. Open unknown to settle here: does RLS alone carry the
PRD's isolation guarantee with the cookie-based SSR session?

PRD refs: FR-001 (auth — every domain row belongs to a signed-in reader);
§ Non-Functional Requirements ("a reader's books, characters, relationships, and events are
visible only to that reader. No cross-user data access is possible"); § Access Control (flat
user model, no admin role, strictly private collections, no shared collections).
Roadmap: `context/foundation/roadmap.md` § Foundations, F-01.

## Phase 2 acceptance conditions (from manual review of Phase 1)

Studio's Policies page badges `books` as "API DISABLED" with "This table has custom Data
API permissions", while the Table Editor shows the globe icon meaning the opposite. The two
views disagree; only a real request settles it. Hypothesis to disprove: the badge is a
consequence of `revoke all from anon`, which is intended. Treat the manual token pass as the
deciding evidence, and make these three outcomes explicit in the Phase 2 results:

1. The negative control must FAIL. If broadening a policy to `using (true)` still passes,
   the harness is not running as `authenticated` and proves nothing.
2. Reader A's token must return A's row through the local REST endpoint on 54321 — that is
   what disproves the "API DISABLED" reading.
3. Reader B must get an EMPTY result for A's rows, not a permission error. RLS filters
   rather than refuses; a 403 or "permission denied" points at grants, not policies, and
   must be diagnosed before the phase closes.

If reader A comes back empty or denied, STOP and diagnose before touching the policies.
Ruled out during Phase 1: `usage on schema public` is granted to authenticated (verified
via has_schema_privilege), so a failure is not that.

## Deferred to S-01

Criterion 4.7 closes unticked, by decision, not by oversight. It asks that a book row be
invisible to a second remote account **on the deployed app**, and no screen creates a book
until S-01 lands, so the deployed request path was never exercised.

Established by this change: the migration is applied remotely (`supabase migration list`
reports matching Local/Remote timestamps against the remote database), the remote table
reports RLS enabled with the same four `authenticated` policies, and the deployed site loads
with an intact session after the push.

NOT established: that the deployed app's own request path honours the policies. The local
harness (`npm run db:verify-rls`) proves the policies; it does not prove the deployment uses
them. S-01 must verify a book created through the deployed UI is invisible to a second remote
account, and should extend `supabase/tests/rls_books.sql` if it adds tables.
