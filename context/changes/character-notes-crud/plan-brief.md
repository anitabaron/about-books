# Characters Within a Book — Plan Brief

> Full plan: `context/changes/character-notes-crud/plan.md`
> Roadmap item: `context/foundation/roadmap.md` § Slices → S-02
> Prerequisite slice: `context/archive/2026-09-09-manual-book-entry/`

## What & Why

A reader gets a page per book where characters accumulate: add one with a name alone in
seconds while reading, fill in the description later. This is the slice that makes the notes
grow, and its page is the surface S-03's cast view extends.

## Starting Point

S-01 established every idiom this copies — native form POST, `formData()` + Zod in the route,
errors as a `?error=` redirect, lists server-rendered in the page. `CLAUDE.md` carries the RLS
template, already dry-run as a `characters` table during F-01. `set_updated_at()` exists with
`search_path` pinned. Route protection already covers `/books/[id]` by prefix.

## Desired End State

From `/books` a reader opens a book, sees its title and author, adds characters by name, and
reads the cast beneath. Rows expand to correct a name or add a description, or delete. All
private per reader, proven by the same one-command harness that covers books.

## Key Decisions Made

| Decision            | Choice                                            | Why (1 sentence)                                                                 | Source   |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Route shape         | `/books/[id]` — form above, list below            | Same idiom as `/books`, and S-03 extends this page rather than adding another.    | User     |
| Route protection    | No change — prefix match already covers it        | `startsWith("/books")` matches `/books/[id]`; verified, so a second entry is dead weight. | User |
| Form idiom          | Native POST + formData + redirect                 | Exactly S-01, so there is one pattern in the codebase rather than two.           | User     |
| Ownership model     | `user_id` for RLS **and** `book_id` for relation  | Policies check `auth.uid() = user_id` directly — no join to derive ownership.     | User     |
| Trigger             | Attach `set_updated_at()`, never redefine         | The function exists with a pinned search_path; recreating it would clobber that.  | User     |
| CRUD scope          | Full CRUD — add, edit, delete                     | FR-003 says so and S-02's outcome names it; books were the exception, not the rule. | User   |
| Ergonomic bar       | Name alone must submit, under 30s, on a phone     | US-02's acceptance criterion; a form needing more than a name fails the story.    | User     |
| Plan review         | Skipped                                           | The foundation earned that scrutiny; a character form does not, and the deadline is real. | User |

## Scope

**In scope:** `characters` migration from the template (with `book_id`); harness extended in
both directions; regenerated types; `/books/[id]` page; add-character route and form;
edit and delete routes with inline `<details>` controls; a link from the collection list.

**Out of scope:** relationships (S-03); events (FR-005); book status (S-04); book edit/delete
(still parked); a textarea component; a test runner; a deployed-verification phase — S-01
already proved that path.

## Architecture / Approach

`characters` copies the RLS template verbatim and adds `book_id` as the relation, cascading
from both `auth.users` and `books`. Policies stay on `auth.uid() = user_id`, so ownership is
never derived by joining. The route guards a forged `book_id` for free: it must load the book
anyway, and that read is RLS-filtered, so another reader's book simply is not found. The page
server-renders the cast; only the add form is an island, and even that submits natively.

## Phases at a Glance

| Phase                                     | What it delivers                                            | Key risk                                                                   |
| ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Characters data layer + harness        | `characters` table, isolation asserted both ways, new types | A policy that is too narrow passes negative-only assertions                |
| 2. Book page and add a character          | `/books/[id]`, name-alone add form, cast list, link in      | Failing US-02's name-alone bar makes the slice technically-working but wrong |
| 3. Edit and delete a character            | Inline `<details>` edit plus delete, no JS required          | Redirecting back to the right book page after an edit                      |

**Prerequisites:** Docker running for the local stack; S-01 complete (done, archived).
**Estimated effort:** One session; Phase 1 is the careful part, Phases 2–3 follow S-01's shape.

## Open Risks & Assumptions

- **A forged `book_id` creates referential nonsense, not a leak.** Policies check `user_id`
  only, so a hand-crafted POST could attach a character to a book the poster does not own; RLS
  still hides it from the book's owner. Guarded in the route by the RLS-filtered book lookup.
- **`description` uses a single-line input**, because `FormField` has no textarea variant.
  Adequate for a short note; a multi-line component is a later concern.
- **Client and server validation are duplicated by hand** again, as in S-01 — the server stays
  authoritative, so drift costs the error message, not the guarantee.
- **The remote schema needs `db push`** when this deploys; the two databases are distinct now,
  so that step is no longer implicit.

## Success Criteria (Summary)

- A character is creatable from a name alone, on a phone, in seconds.
- A reader's characters are invisible to every other reader, proven by a command that fails
  when a policy is either too broad or too narrow.
- S-03 can extend `/books/[id]` rather than inventing a second per-book surface.
