---
change_id: private-by-default-data-contract
title: Private-by-default data contract (roadmap F-01)
status: planned
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
