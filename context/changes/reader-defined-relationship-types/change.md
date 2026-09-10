---
change_id: reader-defined-relationship-types
title: Reader-defined relationship types per book, with Polish display names
status: new
created: 2026-09-10
updated: 2026-09-10
archived_at: null
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
one of the two columns filled; `on delete restrict` makes the database refuse deleting a type
in use and the app only translates the error; a Polish display map lands in this same slice
with database values staying English; table scope is name + book + owner, nothing else.

Open for planning to settle: `relationships` has no `book_id` (the book is reached through
`characters`), so "this custom type belongs to the same book as these two characters" cannot
be a check constraint.
