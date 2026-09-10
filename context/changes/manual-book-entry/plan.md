# Add a Book to Your Own Collection Implementation Plan

## Overview

Give a signed-in reader one `/books` page where they can add a book by typing title and
author, and see their own collection — nobody else's. Then prove, on the deployed app, that
the isolation guarantee F-01 built actually holds through the real request path.

This is roadmap item **S-01**, the first vertical slice: the first user-visible capability
in the product, and the first consumer of F-01's schema, policies, types and Zod commands.

## Current State Analysis

- **Everything below the UI already exists.** F-01 (archived at
  `context/archive/2026-09-09-private-by-default-data-contract/`) landed the `books` table
  with four `authenticated`-only RLS policies, `user_id` defaulting to `auth.uid()` with
  cascade, the `(user_id, created_at desc)` index, `src/types.ts` with the `Book` entity and
  `createBookSchema`, and `src/db/database.types.ts`. No schema, policy or validation
  decisions are open.
- **Auth is fully wired and is the pattern to copy.** `src/middleware.ts:9` resolves
  `context.locals.user` and guards `PROTECTED_ROUTES = ["/dashboard"]`.
- **Forms are native POSTs, not fetch.** `src/components/auth/SignInForm.tsx:60` renders
  `<form method="POST" action="/api/auth/signin">`; React only adds client-side validation
  and gates submission with `preventDefault`. The form works with JavaScript disabled.
- **Routes read `formData()`, not JSON.** `src/pages/api/auth/signin.ts:5`. No existing route
  uses `request.json()`, and no existing route uses Zod — despite `CLAUDE.md` naming both.
  This slice is the first route to validate with Zod, and it does so on a formData-derived
  object rather than on JSON.
- **Errors round-trip via redirect.** The route redirects to `/auth/signin?error=<message>`;
  the page reads `Astro.url.searchParams` (`src/pages/auth/signin.astro:5`) and passes it
  into the island as `serverError`.
- **No `locals.supabase`.** Each auth route calls `createClient(...)` itself
  (`signin.ts:8`), and `src/env.d.ts` types only `App.Locals.user`.
- **Reusable form primitives** live in `src/components/auth/`: `FormField`, `SubmitButton`,
  `ServerError`, `PasswordToggle`.
- **Visual language** is a distinctive "cosmic" glassmorphism — `bg-cosmic`,
  `backdrop-blur-xl`, gradient-clipped headings (`dashboard.astro`, `signin.astro`).
- **`src/types.ts` validation messages are Polish**, following `src/lib/config-status.ts`.
  Every other authored surface is English, including `<html lang="en">`.

## Desired End State

A signed-in reader visits `/books`, types a title and an author, submits, and sees the book
appear in a list below the form. Their collection contains only their own books. An
unauthenticated visitor to `/books` is redirected to sign-in. On a phone the page needs no
zooming and scrolls only vertically. And the isolation guarantee is proven on the deployed
app, not just in the database.

Verification: `npm run db:verify-rls` still passes, `npx astro check` and `npm run build` are
clean, and on the deployed app a book created by reader A is invisible to reader B.

### Key Discoveries:

- `src/components/auth/SignInForm.tsx:60` — native POST plus a client-side `validate()` gate
  is the established form idiom; copy it rather than introducing fetch.
- `src/pages/api/auth/signin.ts:5` — `formData()`, and errors as a redirect with
  `?error=<encoded message>`.
- `src/middleware.ts:9` — `PROTECTED_ROUTES` is a prefix list; adding `"/books"` protects the
  page.
- F-01's `authorField` transform maps `""` to `null`. A cleared text input submits `""`, so
  this handles the formData case exactly — an unplanned but load-bearing fit.
- `books.user_id` defaults to `auth.uid()`, so the insert must NOT send a user id, and the
  insert policy would reject one anyway.
- Polish diacritics (ą ć ę ł ń ó ś ż ź) round-trip correctly from form to database to view —
  verified manually in Phase 1. The columns are UTF-8 `text` and nothing normalises input
  anywhere in the path, so S-02's character names will behave the same. Worth knowing for an
  app whose books are largely Polish.

## What We're NOT Doing

- **No editing or deleting books.** Parked to a follow-up after S-01 (recorded in the
  roadmap's `## Parked`). FR-002 covers adding only; FR-003's full CRUD is about characters.
  Two days remain for S-01–S-04 and S-03 is the north star, so title-editing is the wrong
  place to spend half of it.
- **No PRD amendment.** `prd_version` stays 2 and FR-002 stays as written. The amendment
  existed only to justify edit/delete.
- **No browse or search** (FR-008, phase 2) — a plain unsorted list is the whole surface.
- **No external metadata lookup** (FR-002b, phase 2) — no cover, ISBN or author prefill.
- **No book status** (FR-009) — that is S-04's slice; no `status` column is added.
- **No characters or relationships** — S-02 and S-03.
- **No `locals.supabase` refactor.** Each route creates its own client, matching
  `signin.ts:8`. If S-02–S-04 duplicate it several more times, promoting it becomes a
  worthwhile cleanup then.
- **No relocation of the auth form components.** `FormField` and friends are imported from
  `src/components/auth/` in place. The naming is mildly wrong for a book form; that is a
  better trade than touching the one flow that already works.
- **No test runner.** Still out of scope, as in F-01.
- **No retranslation of the starter's Polish scaffolding** — `src/lib/config-status.ts` and
  `Layout.astro`'s config banner stay as they are. Only strings this slice actually shows a
  reader are changed.

## Implementation Approach

Two phases. Phase 1 builds the whole vertical slice — page, form, route, list, protection —
following the auth flow's idioms so that S-02 and S-03 have one pattern to copy rather than
two. Phase 2 does the thing that cannot be automated: deploys, and checks with two real
remote accounts that a book created through the deployed UI is invisible to the other reader.
Phase 1 is entirely local and revertible; Phase 2 touches the deployed app.

## Critical Implementation Details

**The insert must not send `user_id`.** The column defaults to `auth.uid()` and the insert
policy's `with check (auth.uid() = user_id)` would reject a forged value. `createBookSchema`
has no `user_id` field at all, so passing its parsed output straight to `.insert()` is
correct — and adding the field "for clarity" would break it.

**A cleared text input submits `""`, not `undefined`.** F-01's `authorField` transforms `""`
to `null`, which is what makes formData work without special-casing. Do not "simplify" that
transform away.

## Phase 1: Add and list books

### Overview

The full vertical slice: a protected `/books` page with an add form above a server-rendered
list of the reader's own books, backed by one POST route that validates with Zod and reports
failures the way the auth flow does.

### Changes Required:

#### 1. English validation messages

**File**: `src/types.ts`

**Intent**: Apply the language decision before any new UI is written, so no new Polish
strings get authored in this slice. Every authored product surface is English, including
`<html lang="en">`; the Polish precedent F-01 followed was starter scaffolding.

**Contract**: The four Zod message strings in `titleField`, `authorField` and
`updateBookSchema` become English. No schema shape, field name or type changes —
`CreateBookCommand` and `UpdateBookCommand` are unaffected.

#### 2. Route protection

**File**: `src/middleware.ts`

**Intent**: An unauthenticated visitor to `/books` should land on sign-in rather than an
empty page, matching how `/dashboard` behaves.

**Contract**: `"/books"` added to `PROTECTED_ROUTES`. Prefix matching already exists; no
logic change.

#### 3. Create-book route

**File**: `src/pages/api/books.ts` (new)

**Intent**: Accept the form post, validate it, insert the row for the current reader, and
return them to `/books` — the first route in this codebase to actually use Zod, as
`CLAUDE.md` requires.

**Contract**: `export const POST: APIRoute`, plus `export const prerender = false`. Reads
`formData()`, builds `{ title, author }`, parses with `createBookSchema`. On a Zod failure or
a Supabase error, redirects to `/books?error=<encodeURIComponent(message)>`; on success
redirects to `/books`. Guards on `context.locals.user` before touching the database. Creates
its own client via `createClient(context.request.headers, context.cookies)` and inserts the
parsed object verbatim — no `user_id`.

#### 4. Add-book form island

**File**: `src/components/books/AddBookForm.tsx` (new)

**Intent**: A native POST form with a client-side validation gate, so the common error case
never costs a round trip while the form still works without JavaScript.

**Contract**: Default-exported component taking `serverError?: string | null`. Renders
`<form method="POST" action="/api/books">` with `title` (required) and `author` (optional)
fields, mirroring `SignInForm`'s structure: local state per field, a `validate()` that
gates `onSubmit` via `preventDefault`, `clearError` on change, `<ServerError>`, and
`<SubmitButton>`. Imports `FormField`, `SubmitButton` and `ServerError` from
`@/components/auth/`. Client-side rules mirror `createBookSchema` (title required after
trim, 300-char cap) so the two do not contradict each other.

#### 5. Books page

**File**: `src/pages/books.astro` (new)

**Intent**: The one screen this slice delivers — add at the top, own collection below, so
adding and confirming happen without navigation.

**Contract**: Uses `Layout` with a title. Reads `Astro.url.searchParams.get("error")` and
passes it to `<AddBookForm client:load />`. Server-side, creates a Supabase client and
selects the reader's books ordered by `created_at desc`, rendering title, author and added
date. Renders an empty state when there are none. Matches the cosmic glassmorphism of
`dashboard.astro`. Layout must not require horizontal scrolling or zooming at 375px width.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean on the files this phase touched (`npx prettier --check` on them; do NOT
  run `npm run format` — see F-01's plan, criterion 3.4)
- No regression in the isolation harness: `npm run db:verify-rls`
- No Polish strings remain in `src/types.ts`: `grep -nE "[ąćęłńóśźż]" src/types.ts` returns
  nothing

#### Manual Verification:

- Signed in locally, adding a title and author shows the book in the list below the form
- A book added with the author field left blank is stored with no author and renders without
  an empty-string artifact
- Submitting an empty title is refused client-side without a page load; a title of only
  spaces is refused too
- `/books` while signed out redirects to `/auth/signin`
- At 375px width the page needs no zooming and scrolls only vertically
- With JavaScript disabled the form still submits and the book still appears
- Two local accounts: reader A's books are not visible in reader B's list

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful
before proceeding to the next phase.

---

## Phase 2: Deployed-path isolation verification

### Overview

Close F-01's deferred criterion 4.7. The database policies are proven; what has never been
exercised is the deployed app's own request path. This phase deploys and checks it with two
real remote accounts.

### Changes Required:

#### 1. Deploy the slice

**File**: none (deployment operation)

**Intent**: Get Phase 1 onto the deployed Worker so the guarantee can be tested where readers
actually use it.

**Contract**: Push to `main`, which auto-deploys per the confirmed Cloudflare Git
integration. No code or config changes originate in this phase; if a deploy-time
configuration gap appears (a missing secret, for instance), that is a finding to report, not
something to fix silently here.

### Success Criteria:

#### Automated Verification:

- Production build succeeds locally before pushing: `npm run build`
- Remote schema still carries the migration: `npx supabase migration list` shows the same
  timestamp under Local and Remote

#### Manual Verification:

- The deployed `/books` page loads for a signed-in reader and the add form works
- A book created by remote reader A appears in reader A's list
- Signed in as remote reader B, reader A's book is NOT visible — an empty list, not an error.
  This is F-01's criterion 4.7, and it is the last unproven part of that guarantee
- `/books` on the deployed app while signed out redirects to sign-in

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

None — there is still no test runner, and adding one remains out of scope. `createBookSchema`
is exercised for real by the route in Phase 1, which is the first time F-01's schema is used
by running code.

### Integration Tests:

- `npm run db:verify-rls` runs unchanged as a regression check: this slice must not weaken
  the isolation the harness asserts.

### Manual Testing Steps:

1. `npx supabase start` (Docker must be running — it needed starting by hand during F-01),
   then `npm run dev`.
2. Sign in, visit `/books`, confirm the empty state.
3. Add a book with title and author; confirm it appears below the form.
4. Add a book with the author blank; confirm no empty-string artifact.
5. Submit an empty title, then a whitespace-only title; both refused without a page load.
6. Disable JavaScript and add a book; it still works.
7. Narrow the viewport to 375px; no horizontal scroll, no zoom needed.
8. Sign out, visit `/books`; redirected to sign-in.
9. Create a second local account; confirm each reader sees only their own books.
10. After deploying (Phase 2), repeat steps 2–4 and 9 against the deployed app with two
    remote accounts.

## Performance Considerations

Negligible at this scale (PRD `target_scale.users: small`). The list query filters by
`user_id` and orders by `created_at desc`, which is exactly the index F-01 created, so it is
an index scan rather than a sort. No pagination: FR-008 is phase 2, and a personal collection
of unbounded size is not a phase-1 concern.

## Migration Notes

No schema changes — F-01's migration is already applied locally and remotely. Phase 1 is pure
application code and is revertible by reverting the commit. Phase 2 changes no code; a
rollback there means redeploying a previous commit.

## References

- Roadmap item: `context/foundation/roadmap.md` § Slices → S-01
- Change identity: `context/changes/manual-book-entry/change.md`
- Foundation this consumes: `context/archive/2026-09-09-private-by-default-data-contract/`
- Form idiom to copy: `src/components/auth/SignInForm.tsx:60`
- Route idiom to copy: `src/pages/api/auth/signin.ts:5`
- Conventions, including the RLS template and the `npm run format` caveat: `CLAUDE.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Add and list books

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — 22f364d
- [x] 1.2 Production build succeeds: `npm run build` — 22f364d
- [x] 1.3 Linting passes: `npm run lint` — 22f364d
- [x] 1.4 Formatting is clean on touched files (repo-wide `--write` not run) — 22f364d
- [x] 1.5 No regression in the isolation harness: `npm run db:verify-rls` — 22f364d
- [x] 1.6 No Polish strings remain in `src/types.ts` — 22f364d

#### Manual

- [x] 1.7 Adding a title and author shows the book in the list below the form — 22f364d
- [x] 1.8 A book added with a blank author stores no author and renders cleanly — 22f364d
- [x] 1.9 Empty and whitespace-only titles are refused client-side without a page load — 22f364d
- [x] 1.10 `/books` while signed out redirects to `/auth/signin` — 22f364d
- [x] 1.11 At 375px width the page needs no zooming and scrolls only vertically — 22f364d
- [x] 1.12 With JavaScript disabled the form still submits and the book appears — 22f364d
- [x] 1.13 Two local accounts: reader A's books are not visible to reader B — 22f364d

### Phase 2: Deployed-path isolation verification

#### Automated

- [x] 2.1 Production build succeeds locally before pushing: `npm run build` — 20acf13
- [x] 2.2 Remote schema still carries the migration: `npx supabase migration list` — 20acf13

#### Manual

- [x] 2.3 Deployed `/books` loads for a signed-in reader and the add form works — 20acf13
- [x] 2.4 A book created by remote reader A appears in reader A's list — 20acf13
- [x] 2.5 Reader A's book is NOT visible to remote reader B — empty list, not an error (F-01 criterion 4.7) — 20acf13
- [x] 2.6 Deployed `/books` while signed out redirects to sign-in — 20acf13
