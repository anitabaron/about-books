# Private-by-Default Data Contract — Plan Brief

> Full plan: `context/changes/private-by-default-data-contract/plan.md`
> Roadmap item: `context/foundation/roadmap.md` § Foundations → F-01

## What & Why

The PRD makes a hard promise — a reader's books, characters and notes are visible only to that
reader, and "no cross-user data access is possible" — and today nothing in the repo can keep or
check it: `supabase/migrations/` does not exist. This change lands the first table behind
row-level security, proves the isolation actually holds, and leaves behind the schema, types and
policy template that slices S-01–S-04 copy instead of reinventing.

## Starting Point

Auth is fully wired: `src/lib/supabase.ts` builds a per-request client from cookies,
`src/middleware.ts` resolves `locals.user`, and `SUPABASE_KEY` is an `sb_publishable_…` key that
respects RLS rather than a `service_role` key that would bypass it. What's missing is everything
below the session: no tables, no policies, no `src/types.ts`, no `zod` (despite `CLAUDE.md`
mandating it), and no test runner of any kind.

## Desired End State

One migration creates `books` with RLS and four granular per-operation policies. A single
command — `npm run db:verify-rls` — proves reader B cannot select, update or delete reader A's
rows, and fails loudly if a policy ever regresses. `src/types.ts` exports the `Book` entity, its
DTOs and matching Zod schemas ready for S-01 to import, `CLAUDE.md` carries the copyable policy
template, and the migration is live on the linked remote project.

## Key Decisions Made

| Decision            | Choice                                | Why (1 sentence)                                                                                 | Source   |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Table scope         | `books` only                          | Smallest real instance that proves the pattern, and S-01 exercises it immediately.               | Plan     |
| Verification        | SQL assertion + one manual token pass | Automates the policy logic with zero new tooling, while still proving the real JWT session path. | Plan     |
| Migration workflow  | Local first, then push remote         | `db reset` gives a safely destructive harness; the remote only receives a migration that passed. | Plan     |
| Delete semantics    | Hard delete + cascade                 | Matches the PRD's plain "full CRUD" wording; the guardrail is about leaks and crashes, not undo.  | Plan     |
| Validation shape    | zod + types, no API route             | Gives S-01 a contract to import without adding an endpoint that has no UI.                       | Plan     |
| Convention home     | Migration + `CLAUDE.md` section       | `CLAUDE.md` is the file every agent reads first, so the pattern gets picked up automatically.     | Plan     |
| Sequencing bias     | `speed`                               | Hard deadline 2026-09-12 on 3 after-hours days.                                                  | Roadmap  |
| Foundation cap      | No layer completion                   | Roadmap Foundation rule: minimal enabler only, later slices still integrate vertically.          | Roadmap  |

## Scope

**In scope:** `books` table + RLS policies + ownership column and index; the `updated_at` trigger
convention; a repeatable SQL isolation check plus an `npm run db:verify-rls` entry point; `zod`
installed; `src/types.ts` with the `Book` entity, DTOs and schemas; the policy template in
`CLAUDE.md`; remote migration push.

**Out of scope:** `characters` / `relationships` / `events` tables (S-02, S-03, parked FR-005);
a `status` column (S-04); any API route or UI (S-01); a test runner; soft delete; external
metadata fields (parked FR-002b); `docs/reference/contract-surfaces.md`.

## Architecture / Approach

Isolation lives in the database, not the application. The reader's JWT arrives via the existing
cookie-based SSR client, Postgres resolves `auth.uid()`, and four per-operation policies scoped
to the `authenticated` role decide visibility; `anon` gets no policy and is denied by default.
`user_id` defaults to `auth.uid()`, so the app never has to send an owner id — and could not
forge one if it tried. No custom middleware sits in the path, which is the claim in
`tech-stack.md` that Phase 2 finally puts under test.

## Phases at a Glance

| Phase                                | What it delivers                                             | Key risk                                                                             |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1. Schema + RLS migration (local)    | `books` table with four granular policies, applies cleanly   | Wrong policy granularity here is inherited by every later slice                      |
| 2. Isolation verification harness    | `npm run db:verify-rls` + the real-session token check       | A SQL simulation can pass while the actual cookie-session path is broken             |
| 3. Types + validation shape          | `zod` installed; `src/types.ts` with `Book`, DTOs, schemas   | Types drifting from the migration's columns, surfacing only in S-01                  |
| 4. Convention capture + remote push  | Policy template in `CLAUDE.md`; migration live on remote     | First irreversible step — the remote push touches the only real database             |

**Prerequisites:** Docker running for the local Supabase stack; Supabase CLI installed and
project linked (both already true); working auth flow (already true).
**Estimated effort:** Roughly one focused session across four phases, with Phase 2 the largest
share — it is the phase that produces the guarantee rather than the schema.

## Open Risks & Assumptions

- **`author` is nullable** — FR-002 names title and author, but nothing requires the author to be
  known, so friction is kept low. If S-01 wants it mandatory, that is a one-line migration.
- **A `service_role` key would silently void all of this.** Policies are only as good as the key
  in use; swapping to a secret key removes isolation with no error anywhere.
- **The SQL check impersonates readers via `request.jwt.claims`**, which exercises the policy
  predicates but not the cookie-to-JWT hop — hence the manual token pass in Phase 2. Neither half
  alone is sufficient.
- **No test runner means no regression net beyond the SQL check** — a future slice editing a
  policy without extending `rls_books.sql` could regress isolation unnoticed. Test fixtures insert
  directly into `auth.users`, which is fine locally; the script refuses a non-local database URL.

## Success Criteria (Summary)

- A reader's book rows are invisible to every other reader — proven, not assumed, by a command
  that fails when a policy leaks.
- S-01 can be planned and built without making a single schema, ownership or validation decision.
- Any agent writing S-02's migration can produce the same policy granularity from `CLAUDE.md`
  alone.
