# Add a Book to Your Own Collection — Plan Brief

> Full plan: `context/changes/manual-book-entry/plan.md`
> Roadmap item: `context/foundation/roadmap.md` § Slices → S-01
> Foundation consumed: `context/archive/2026-09-09-private-by-default-data-contract/`

## What & Why

The first user-visible capability in the product: a signed-in reader adds a book by typing
title and author, and sees their own collection. Every later slice hangs off a book row —
characters belong to a book, relationships belong to characters — so nothing else in the
milestone can start until this exists.

## Starting Point

Everything below the UI is already built. F-01 landed the `books` table with four
`authenticated`-only RLS policies, `user_id` defaulting to `auth.uid()`, the matching index,
`src/types.ts` with the `Book` entity and `createBookSchema`, and generated database types.
Auth is fully wired. What is missing is any screen or route that touches a book — the
deployed app does not yet know the table exists.

## Desired End State

A reader visits `/books`, adds a book, and watches it appear in a list below the form.
Signed out, `/books` redirects to sign-in. On a phone the page needs no zooming and scrolls
only vertically. And the isolation guarantee is finally proven where readers actually use
it: a book created by one reader on the deployed app is invisible to another.

## Key Decisions Made

| Decision         | Choice                                      | Why (1 sentence)                                                                                  | Source |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| Form submission  | Native POST + formData + redirect           | Matches the only form precedent in the repo, and keeps working with JavaScript disabled.          | Plan   |
| Error reporting  | Client-side gate, server Zod, `?error=`     | Identical to the auth flow; client gating makes a lossy server round-trip rare.                   | Plan   |
| Page structure   | One `/books` page — form above, list below  | Add-then-confirm in one screen, no navigation, which suits phone-first capture.                   | Plan   |
| CRUD scope       | Add + list only; edit/delete parked         | FR-002 covers adding only, and two days remain for four slices with S-03 as the north star.       | Plan   |
| PRD amendment    | None — `prd_version` stays 2                | It existed only to justify edit/delete; parking that work removes the need.                       | Plan   |
| UI language      | English; retranslate F-01's four messages   | Every authored surface is English incl. `<html lang="en">`; the Polish precedent was scaffolding. | Plan   |
| Supabase client  | Per route, matching `signin.ts:8`           | Avoids changing shared middleware; promotion to `locals` recorded as later cleanup.               | Plan   |
| Form components  | Reused from `src/components/auth/` in place | Mildly wrong naming beats touching the one flow that already works.                               | Plan   |
| 4.7 verification | Its own final phase, human-gated            | Needs a deploy and two remote accounts, so it cannot be automated or bundled.                     | Plan   |

## Scope

**In scope:** `/books` page with add form and own-collection list; `POST /api/books` with Zod
validation and redirect-based errors; `/books` added to `PROTECTED_ROUTES`; empty state;
375px-friendly layout; English validation messages; deployed two-account isolation check.

**Out of scope:** editing or deleting books (parked as an S-01 follow-up); any PRD change;
browse/search (FR-008); external metadata (FR-002b); book status (FR-009 → S-04); characters
and relationships (S-02, S-03); a `locals.supabase` refactor; relocating the auth form
components; a test runner; the starter's remaining Polish scaffolding strings.

## Architecture / Approach

The whole slice follows the auth flow's idiom rather than inventing a second one. A React
island renders a plain `<form method="POST" action="/api/books">` and adds a client-side
validation gate; the route reads `formData()`, validates with F-01's `createBookSchema`, and
inserts the parsed object verbatim — no `user_id`, because the column defaults to
`auth.uid()` and the insert policy would reject a forged one. Failures redirect to
`/books?error=…`, which the page reads from `Astro.url.searchParams` and hands to the island,
exactly as `signin.astro` does. The list is server-rendered in the `.astro` page, so no
client JavaScript is needed to read your collection.

## Phases at a Glance

| Phase                                   | What it delivers                                                 | Key risk                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Add and list books                   | `/books` page, add form, POST route, protection, English strings | Sets the form/route/error idiom that S-02 and S-03 copy — a wrong choice propagates three times |
| 2. Deployed-path isolation verification | F-01's criterion 4.7 finally proven on the deployed app          | Needs two real remote accounts; a second deferral would make it permanent                       |

**Prerequisites:** Docker running for the local stack (it needed starting by hand in F-01);
F-01 complete (it is, and archived); two remote accounts for Phase 2.
**Estimated effort:** One session for Phase 1; Phase 2 is a deploy plus a two-account check.

## Open Risks & Assumptions

- **No way to fix a typo'd title until edit returns.** A deliberate trade: the parked
  follow-up is recorded in the roadmap, but you will feel this while creating test data for
  S-02 and S-03.
- **The form idiom is a precedent, not just a choice.** S-02's "add a character in under 30
  seconds on a phone" will copy this shape, so if the redirect-based error round-trip proves
  annoying here it will be annoying three more times.
- **Client-side and server-side validation are duplicated by hand** — the island's rules
  mirror `createBookSchema` rather than deriving from it. They can drift; the server remains
  authoritative, so drift degrades UX rather than safety.
- **Zod length caps still have no schema counterpart** (inherited from F-01): a title longer
  than 300 characters written by any other path would be readable but not editable.
- **Local and production databases are now distinct.** `.dev.vars` was switched to the local
  stack during Phase 1, so development data no longer lands in production and
  `npm run db:verify-rls` again covers the database the running app actually uses. The cost:
  a schema change must be applied twice — locally (`npx supabase db reset`, or applying the
  migration) and remotely (`npx supabase db push`). Forgetting the second half leaves the
  deployed app running against an older schema, which is exactly the class of drift that is
  invisible until a query fails in production.
- **`npm run format` remains a trap** — 39 pre-existing unformatted files. Verify formatting
  only on touched files, as recorded in F-01's criterion 3.4 and in `CLAUDE.md`.

## Success Criteria (Summary)

- A reader can add a book and immediately see it, on a phone, without zooming.
- A reader's collection contains only their own books — proven on the deployed app, closing
  the last unproven piece of F-01's guarantee.
- S-02 has exactly one form-and-route pattern to copy, not two.
