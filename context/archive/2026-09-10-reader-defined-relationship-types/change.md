---
change_id: reader-defined-relationship-types
title: Reader-defined relationship types, scoped per book
status: archived
created: 2026-09-10
updated: 2026-09-10
archived_at: 2026-09-10T15:58:00Z
---

## Notes

Chcę mieć więcej typów relacji — kilka podstawowych współdzielonych, ale też możliwość
wpisania z palca czegoś innego, nowego, dotyczącego tylko tej danej książki, np. "mieszka z".

Roadmap: M-2 `readers-own-vocabulary`, S-01 (north star). PRD: FR-004 as amended 2026-09-10
(prd_version 3), US-01.

Design decided before planning — see the **Decided up front** block in
`context/foundation/roadmap.md` § Slices → S-01. Summary: the five shared types stay
immutable in code; custom types are rows in a per-book table alongside them; a relationship
points at a custom type's row via a nullable FK (never stores its name as text) with exactly
one of the two columns filled; the foreign key makes the database refuse deleting a type in use
(NO ACTION, so a cascading book delete is unaffected) and the app only translates the error; table scope is name + book + owner, nothing else.

Reversed during planning on 2026-09-10: **no Polish display map** — the UI stays English
throughout, and custom types are themselves the answer to "ally" reading as fantasy-saga in
domestic fiction. This also closes the UI-language question left open since S-01.

Settled during planning from the codebase, not by decision: `relationships` has no `book_id`,
but both write endpoints already resolve the book through `characters` and reject a cross-book
pair that way (`src/pages/api/characters/[id]/relationships.ts:47`). Scoping a custom type is
the same comparison in the same branch — no trigger, no denormalised column.
