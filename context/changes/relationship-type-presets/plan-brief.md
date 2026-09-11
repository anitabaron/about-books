# Relationship type presets in the database — Plan Brief

> Full plan: `context/changes/relationship-type-presets/plan.md`

## What & Why

The reader went looking for the five shared relationship types in the database and could not
find them: they exist only as a TypeScript array and two hand-written lists inside check
constraints. This plan makes them rows, removes the names from the code entirely, and proves
the new shape by renaming `other` to `friend` as a migration rather than a code change.

## Starting Point

The five are written out in three places — `RELATIONSHIP_TYPES` in `src/types.ts:120`, the two
`<select>` blocks and the "Predefined" line in `books/[id].astro`, and the check constraints in
two migrations. The write path already queries the database to resolve reader-defined types, so
validating a shared one there is the same round trip, not a new one.

## Desired End State

`relationship_type_presets` holds the five as rows, readable by any signed-in reader and
writable by none. `relationships.type` is a foreign key into it. The page renders the dropdowns
and the "Predefined" line from those rows, and the fifth type reads `friend` everywhere.

## Key Decisions Made

| Decision                                        | Choice                                                   | Why (1 sentence)                                                                                                     | Source |
| ----------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| Source of truth                                 | The list leaves `src/types.ts` entirely                  | Keeping it would leave the five in two places and only half-answer the reader's complaint.                           | Plan   |
| Shared-type validation                          | Shape (uuid vs not) plus a database lookup               | Without an array there is nothing to test membership against, and the write path already makes that query.           | Plan   |
| Shadowing rule                                  | Stays a check constraint with its list written out       | A check cannot subquery, and the reader chose the simpler mechanism over a trigger.                                  | Plan   |
| Drift between the two remaining copies          | Harness assertion that the check list and the rows match | The duplication is accepted, so the defence is making divergence fail a command.                                     | Plan   |
| `friend` collision with an existing custom type | No handling                                              | Measured zero on both environments; the migration fails transactionally if one appears, which is a safe failure.     | Plan   |
| Foreign key                                     | `on update cascade`                                      | Turns the rename into one statement instead of insert-rewrite-delete with an order that is easy to get wrong.        | Plan   |
| `label` column                                  | Not added                                                | The UI renders the slug directly; a column nobody reads differently is a commitment without a benefit.               | Plan   |
| Phasing                                         | Two phases                                               | Phase 1 is invisible to the app and independently deployable; the rename cannot ship before the app reads the table. | Plan   |

## Scope

**In scope:** the presets table with RLS and grants; `relationships.type` as a foreign key;
removal of `RELATIONSHIP_TYPES`, `RelationshipType` and `isSharedType`; preset-aware resolution
in `relationship-type.ts`; the page reading presets; the shadowing message moving to the
endpoint; the `other` → `friend` rename; harness coverage and the drift assertion; two stale
comments left by `one-way-relationships`.

**Out of scope:** a `label` / display-name column; reader-editable presets; collision handling
for a pre-existing custom `friend`; renaming the `relationships.type` column; anything about
connection direction or the unique-pair index.

## Architecture / Approach

The names move from three code locations into one table, and the two places that still need to
know them — the foreign key and the shadowing check — are both inside the database. Validation
changes character: instead of "is this string in an array", it becomes "is this a uuid, and
does the row exist", which is the question the write path was already asking about
reader-defined types.

## Phases at a Glance

| Phase                                              | What it delivers                                                      | Key risk                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1. Presets become rows                             | Table, seeded with today's five names unchanged, plus the foreign key | A select-only table passes every negative test even when the read policy is wrong — hence positive assertions too. |
| 2. Code stops enumerating them, `other` → `friend` | Names gone from `src/types.ts`, page reads rows, rename shipped       | Renaming the preset without updating the check list leaves the two copies silently disagreeing.                    |

**Prerequisites:** local Supabase running, `psql` on PATH, `one-way-relationships` deployed
(shares the `relationships` table).
**Estimated effort:** two sessions, one commit each.

## Open Risks & Assumptions

- "Zero `other` connections" and "no custom type named `friend`" are measurements from
  2026-09-11, not invariants; both environments can change before deploy, which is why the
  rename ships as an `update` and the collision is documented rather than assumed away.
- Dropping the TS union means a typo in a shared type is caught by the foreign key at runtime
  rather than by the compiler. That is the accepted cost of making the database the source.
- Phase 2 must reach production as one deploy: the migration and the app change are not
  independently safe.

## Success Criteria (Summary)

- The five shared types are visible as rows in the database.
- Adding a sixth, or renaming one, is a migration and touches no application code.
- The dropdowns and the "Predefined" line read `friend` where they used to read `other`.
