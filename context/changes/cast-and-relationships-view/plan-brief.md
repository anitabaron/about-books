# Cast and Relationships View — Plan Brief

> Full plan: `context/changes/cast-and-relationships-view/plan.md`
> Roadmap item: `context/foundation/roadmap.md` § Slices → S-03 (**north star**)
> Prerequisite slice: `context/archive/2026-09-10-character-notes-crud/`

## What & Why

A reader names undirected relationships between characters and sees every connection rendered
inline beneath each character in the cast they already have on screen. This is the slice that
decides whether the product's central claim holds — that a reader returning after a gap can
orient from their own notes without re-reading.

## Starting Point

`/books/[id]` already renders the book and its cast, each row carrying a native `<details>`
with inline edit and delete. Two tables exist, written from the same RLS template; the harness
covers both in both directions. What is missing is any notion of a connection between two
characters.

## Desired End State

Each character shows its connections directly under its name — type and the other character's
name — with no clicking at all. Expanding a character offers one select for the other
character and one for the type, to add a connection or correct an existing one, or delete it.
A reader scanning the page sees the whole web of the cast at once.

## Key Decisions Made

| Decision           | Choice                                               | Why (1 sentence)                                                                                 | Source |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| "One interaction"  | Inline under each character, no detail page          | US-01 asks for reaching connections in one interaction; a list already showing them needs zero.  | User   |
| Direction          | Undirected — one row, rendered under both characters | FR-004's vocabulary is symmetric; "ally" reads the same from either side.                        | User   |
| Duplicate pairs    | Accepted, recorded as a risk                         | A reader entering A↔B and B↔A is doing it deliberately; a unique index fixes it later if needed. | User   |
| Add form           | Per-character, inside the existing `<details>`       | One select instead of two, and "from whom" is implicit — half the taps on a phone.               | User   |
| Edit               | Type **and** the other character                     | Fuller than type-only; the anchor character stays fixed because the form lives in its row.       | User   |
| `book_id` column   | None on `relationships`                              | The cast's ids already scope every query; a second source of truth could disagree.               | Plan   |
| Type storage       | `text` + `check`, not a Postgres enum                | Extending a check is one line; reversing an `ALTER TYPE` is not.                                 | Plan   |
| Self-relationships | Rejected by `check (a <> b)`                         | Cheaper in the schema than in every code path that writes.                                       | Plan   |

## Scope

**In scope:** `relationships` migration from the template (two character FKs, type check, no
self-pairs); harness extended in both directions; regenerated types; inline rendering under
every character; per-character add form; edit and delete routes with inline controls.

**Out of scope:** the visual diagram (parked); a character detail page; directed relationships
and role labels; a unique index on the pair; linked events (FR-005); book status (S-04); book
edit/delete (parked); a test runner; a deployed-verification phase.

## Architecture / Approach

`relationships` is the template's third use: `user_id` for the policy predicate, two
`character_id` FKs cascading from `characters`, and a `type` constrained by a check. The page
fetches the cast, then the reader's relationships touching those ids, and groups them per
character in memory — no `book_id` column, because the cast already bounds the query. Every
form is a native POST; nothing here needs client JavaScript.

## Phases at a Glance

| Phase                                   | What it delivers                                        | Key risk                                                                           |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Relationships data layer + harness   | Table, isolation asserted both ways, regenerated types  | A too-narrow policy passes negative-only assertions                                |
| 2. Inline rendering + per-character add | **The north star** — connections visible at zero clicks | Rendering that needs a click fails US-01 however well it works otherwise           |
| 3. Edit and delete                      | Full FR-004 CRUD, inline, no JavaScript                 | The anchor character can sit in either column; assuming one rewrites the wrong end |

**Prerequisites:** Docker for the local stack; S-02 done (archived). Test data already present:
_Dune_ with two characters.
**Estimated effort:** One session; Phase 2 carries the product risk, Phase 3 the trickiest code.

## Open Risks & Assumptions

- **Duplicate pairs are possible.** Nothing stops A↔B and B↔A as two rows. Accepted for the
  MVP; `unique (least(a,b), greatest(a,b))` is the fix if time remains.
- **The anchor column is not fixed.** A relationship renders under both characters, so editing
  from one side must work out whether the anchor is `character_a_id` or `character_b_id`.
  Getting this wrong silently rewrites the wrong end — the one bug in this slice that would not
  announce itself.
- **Cross-book relationships must be refused in the route**, since policies check `user_id`
  only. No leak, but it would render as a connection whose other end is not in the cast.
- **Page length grows with the cast**, since both the connections and a form render per
  character. Accepted; collapsing solves it later.
- **A top-level `return` in Astro frontmatter crashes the linter** (`lessons.md`). This slice
  touches a dynamic route, so use `Astro.response.status`.

## Success Criteria (Summary)

- A relationship added under one character appears under both, with no clicking to see it.
- A reader can read the whole cast and its connections in a single screen-scan — US-01
  satisfied at zero interactions, which is what makes this the north star.
- The isolation guarantee still holds, proven by a command that fails on a policy that is
  either too broad or too narrow.
