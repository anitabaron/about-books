# Private-by-Default Data Contract Implementation Plan

## Overview

Land the first domain table (`books`) behind row-level security, prove that one reader cannot
read another reader's rows, and establish the types, Zod schema and policy template that
slices S-01–S-04 copy — without building any user-facing surface.

This is roadmap item **F-01**. Its whole reason to exist is that the PRD makes a hard promise
("a reader's books, characters, relationships, and events are visible only to that reader. No
cross-user data access is possible") and today nothing in the repo can keep or check that
promise: `supabase/migrations/` does not exist.

## Current State Analysis

- **No schema at all.** `supabase/migrations/` is absent. Zero tables, zero policies. Supabase
  CLI is installed (`supabase` ^2.23.4 devDependency) and the project is linked
  (`supabase/.temp/linked-project.json`).
- **Session plumbing is done.** `src/lib/supabase.ts:5` builds a `createServerClient` from
  `@supabase/ssr` with cookie get/set wired to `AstroCookies`; `src/middleware.ts:9` resolves
  `context.locals.user` on every request and guards `PROTECTED_ROUTES = ["/dashboard"]`.
  `src/env.d.ts:3` already types `App.Locals.user`.
- **The key respects RLS.** `SUPABASE_KEY` in `.dev.vars` is an `sb_publishable_…` key — the
  new-style publishable key, not `service_role`. This is the load-bearing precondition for
  everything below: a `service_role` key bypasses RLS entirely and would silently void the
  guarantee.
- **`zod` is not installed**, although `CLAUDE.md` mandates "validate all input with Zod before
  accessing `request.json()`". The convention is currently aspirational.
- **No test runner exists.** No vitest/jest/playwright; `package.json` scripts are only
  dev/build/preview/lint/format. Automated verification must come from the Supabase CLI,
  `eslint`, `astro build` and `astro check`.
- **`src/types.ts` does not exist**, although `CLAUDE.md` names it as the home for shared
  entities and DTOs.
- **Local stack is configured**: Postgres 17 on port 54322, API on 54321, migrations and seed
  enabled (`sql_paths = ["./seed.sql"]`), and `[auth.email] enable_confirmations = false` — so
  test readers can be created locally without an email round-trip.

## Desired End State

`supabase/migrations/` contains one migration creating `books` with RLS enabled and four
granular per-operation policies scoped to the `authenticated` role. A single command
(`npm run db:verify-rls`) proves that reader B cannot select, update or delete reader A's rows
and fails loudly if a policy ever regresses. `src/types.ts` exports the `Book` entity, its
create/update DTOs and the matching Zod schema, ready for S-01 to import. `CLAUDE.md` carries
the concrete policy template beneath its existing Supabase rule. The migration is applied to
the linked remote project.

Verification: `npx supabase db reset` applies cleanly from scratch; `npm run db:verify-rls`
exits 0; two readers created against the local auth API each see only their own rows through
the REST endpoint.

### Key Discoveries:

- `src/lib/supabase.ts:5` — the client is built per-request from cookies, so the reader's JWT
  reaches Postgres and `auth.uid()` resolves. No custom middleware is needed for isolation,
  as `context/foundation/tech-stack.md` claims — but that claim has never been exercised
  against a real row, which is what Phase 2 settles.
- `SUPABASE_KEY` is `sb_publishable_…`, not `service_role` — RLS applies.
- `supabase/config.toml:63` — seed path is `./seed.sql`; `config.toml:204`
  `enable_confirmations = false` locally.
- `CLAUDE.md` already requires migration naming `YYYYMMDDHHmmss_short_description.sql` and
  "granular per-operation, per-role policies" — this plan supplies the worked example that
  rule currently lacks.

## What We're NOT Doing

- **No `characters`, `relationships` or `events` tables.** Those belong to S-02, S-03 and the
  parked FR-005. Pre-building them is the layer-completion drift the roadmap's Foundation cap
  forbids.
- **No `status` column on `books`.** FR-009 (active/finished) is S-04's slice; it arrives as
  its own trivial migration.
- **No API route.** POST/GET `/api/books` is S-01's deliverable. F-01 ships the schema it
  validates against, not the endpoint.
- **No UI of any kind.** No pages, no components, no `PROTECTED_ROUTES` change.
- **No test runner.** Adding vitest/playwright is a separate decision, deliberately not made
  under a 3-day deadline.
- **No soft delete.** Hard delete with cascade, per decision; `deleted_at` filtering is not
  introduced.
- **No external book metadata fields** (cover, ISBN, external id). FR-002b is parked.
- **No `docs/reference/contract-surfaces.md`.** The dangling `CLAUDE.md` reference stays
  dangling; fixing it is out of scope here.

## Implementation Approach

Four phases, ordered so that nothing is documented or pushed before it is proven. Phase 1
writes the schema and its policies. Phase 2 builds the isolation check — the actual deliverable
of this foundation, since an unverified policy is indistinguishable from a broken one. Phase 3
adds the types and Zod schema S-01 imports. Phase 4 captures the convention and pushes to the
remote project, which is the only phase that touches production.

## Critical Implementation Details

**`service_role` voids everything.** Every policy below is scoped to the `authenticated` role
and relies on `auth.uid()`. A `service_role` key ignores RLS completely, so if `SUPABASE_KEY`
is ever swapped for a secret key, isolation silently disappears with no error anywhere. Phase 2's
check must run with a publishable key and a real user JWT, never with `service_role`, or it will
pass while proving nothing.

**Simulating a reader in SQL is not the same as simulating a request.** The Phase 2 script sets
`request.jwt.claims` and `role` inside a transaction to impersonate readers. That exercises the
policy predicates but not the cookie-to-JWT hop, which is why the phase also carries a manual
token check against the real REST endpoint. Both halves are needed; neither alone proves the
guarantee.

**`books.user_id` FKs to `auth.users`, so test rows need real auth users.** The verification
script inserts directly into `auth.users` — acceptable locally, never against remote. Guard the
script so it refuses to run against a non-local database URL.

## Phase 1: Schema + RLS migration (local)

### Overview

Create the `books` table with row-level security enabled and four granular per-operation
policies, applied and re-applied cleanly against the local stack.

### Changes Required:

#### 1. First domain migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_books_with_rls.sql` (new)

**Intent**: Create the single table this foundation exists to protect, with isolation expressed
as policy rather than application logic, so every later slice inherits the pattern instead of
inventing one. Timestamp the filename per `CLAUDE.md`'s naming rule.

**Contract**: Table `public.books` with `id uuid primary key default gen_random_uuid()`,
`user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`,
`title text not null`, `author text` (nullable — nothing in FR-002 requires an author to be
known), `created_at timestamptz not null default now()`, `updated_at timestamptz not null
default now()`. Index on `(user_id, created_at desc)` — every policy predicate and every future
list query filters by `user_id`. An `updated_at` trigger established once here as the
convention. RLS enabled, with four separately named policies for the `authenticated` role only;
`anon` receives no policy and is therefore denied by default.

The policy shape is a contract Phase 2 asserts against and S-01–S-04 copy verbatim, so it is
specified rather than described:

```sql
alter table public.books enable row level security;

create policy "books_select_own" on public.books
  for select to authenticated using (auth.uid() = user_id);

create policy "books_insert_own" on public.books
  for insert to authenticated with check (auth.uid() = user_id);

create policy "books_update_own" on public.books
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "books_delete_own" on public.books
  for delete to authenticated using (auth.uid() = user_id);
```

### Success Criteria:

#### Automated Verification:

- Local stack starts: `npx supabase start`
- Migration applies from scratch with no error: `npx supabase db reset`
- Migration is listed as applied locally: `npx supabase migration list`
- Linting passes: `npm run lint`

#### Manual Verification:

- In Supabase Studio (`http://127.0.0.1:54323`), `books` shows RLS enabled with exactly four
  policies, all scoped to `authenticated`
- Filename matches `YYYYMMDDHHmmss_short_description.sql`

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 2: Isolation verification harness

### Overview

Build the repeatable check that gives this foundation its value: proof that reader B cannot
read, update or delete reader A's rows — and a loud failure if that ever changes.

### Changes Required:

#### 1. RLS assertion script

**File**: `supabase/tests/rls_books.sql` (new)

**Intent**: Assert isolation at the policy level in a single transaction that leaves no residue,
so the check can run repeatedly without a database reset. It must fail with a non-zero exit
when a policy leaks, not print a warning.

**Contract**: One transaction that inserts two `auth.users` rows with fixed UUIDs, inserts one
book per reader, then impersonates each reader and asserts: each sees exactly one row on
`select`; reader B's `update` and `delete` against reader A's row affect zero rows; an `insert`
by reader B claiming reader A's `user_id` is rejected. Ends in `rollback` so it is idempotent.
Guarded to refuse a non-local host.

Reader impersonation is the counterintuitive part and later slices will copy it:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<reader-uuid>","role":"authenticated"}';
```

#### 2. Verification script entry

**File**: `package.json`

**Intent**: Make the check one command so it is actually run, and so `/10x-implement` and future
slices have a named verification path rather than a remembered `psql` invocation.

**Contract**: New script `db:verify-rls` invoking `psql` against the local database URL
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) with `-v ON_ERROR_STOP=1 -f
supabase/tests/rls_books.sql`, so a failed assertion produces a non-zero exit.

### Success Criteria:

#### Automated Verification:

- Isolation check passes: `npm run db:verify-rls`
- The check is genuinely load-bearing: temporarily broaden `books_select_own` to `using (true)`,
  re-run `npm run db:verify-rls`, confirm it FAILS, then revert
- Check is idempotent — runs twice in a row with the same result, no leftover rows
- Linting passes: `npm run lint`

#### Manual Verification:

- Two readers created against the local auth API (`POST /auth/v1/signup` on
  `http://127.0.0.1:54321`, no email confirmation needed) each receive an `access_token`
- With reader A's book inserted, `GET /rest/v1/books` using reader A's bearer token returns
  that book, and the same call with reader B's token returns `[]` — proving the real
  cookie-session JWT path resolves `auth.uid()`, not just the SQL simulation
- An unauthenticated request is refused at the grant level (HTTP 401 / SQLSTATE 42501),
  not filtered to an empty set. `anon` holds no privilege on `books`, so the denial is
  structural and does not depend on RLS being correct. Contrast the previous item, where
  authenticated reader B _has_ the grant and RLS does the filtering, so the correct result
  there is `[]` rather than an error. Do not "fix" a 401 here by granting `anon` SELECT —
  that would trade a structural guarantee for a policy-dependent one.

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 3: Types + validation shape

### Overview

Add the shared entity, DTOs and Zod schema that S-01's route will import, so the first slice
wires an existing contract instead of inventing one under deadline pressure.

### Changes Required:

#### 1. Zod dependency

**File**: `package.json`

**Intent**: Install the validator `CLAUDE.md` already mandates at API boundaries but which is
absent from the dependency tree.

**Contract**: `zod` added to `dependencies`; lockfile updated. No config, no plugin.

#### 2. Shared entities and DTOs

**File**: `src/types.ts` (new)

**Intent**: Establish the one home for shared types named by `CLAUDE.md`, seeded with the
`books` shapes, so every later slice appends rather than choosing a new location.

**Contract**: Exports a `Book` entity type mirroring the migration's columns exactly; a
`CreateBookCommand` DTO (`title` required, `author` optional — `user_id`, `id` and timestamps
are server-owned and never accepted from the client); an `UpdateBookCommand` DTO with both
fields optional; and the Zod schemas these are inferred from, so the runtime validator and the
compile-time type cannot drift. Field names match the SQL columns one-to-one.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Linting passes: `npm run lint`
- Formatting is clean on the files this phase touched:
  `npx prettier --check src/types.ts package.json`.
  Do NOT run `npm run format` (= `prettier --write .`). A repo-wide `--check` reports 39
  pre-existing unformatted files, including `prd.md`, `roadmap.md` and `infrastructure.md`,
  so writing would bury this phase's diff under whitespace churn in documents nobody
  touched. A repo-wide reformat is a separate cleanup commit, not part of this change.

#### Manual Verification:

- Every field in `Book` maps one-to-one onto a column in the Phase 1 migration, with no extras
- Neither DTO accepts `user_id` or `id` from the client

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 4: Convention capture + remote push

### Overview

Record the policy template where agents will actually read it, then apply the migration to the
linked remote project — the only step in this plan that touches production.

### Changes Required:

#### 1. Policy template in the agent rules

**File**: `CLAUDE.md`

**Intent**: Sharpen the existing abstract rule ("Always enable RLS on new tables with granular
per-operation, per-role policies") into a copyable template, so S-02–S-04 produce the same
policy granularity instead of drifting.

**Contract**: A short block appended beneath the existing Supabase-migrations bullet naming: the
four-policy-per-table shape scoped to `authenticated`; `user_id uuid not null default auth.uid()
references auth.users(id) on delete cascade` as the ownership column; that `anon` gets no policy
and is denied by default; that `npm run db:verify-rls` must be extended with assertions for each
new table; and the `service_role`-bypasses-RLS warning. Prose only — the migration remains the
worked example.

#### 2. Generated database types

**File**: `package.json`

**Intent**: `Book` in `src/types.ts` is hand-written and kept in step with the migration by a
comment rather than by a mechanism — the drift risk this plan itself named for Phase 3. Six
columns are fine, but S-02 and S-03 add `characters` and `relationships`, and S-01 will want a
typed Supabase client anyway. Establish the regeneration path before the second table exists,
rather than after the first drift.

**Contract**: New script `db:types` running `supabase gen types typescript --local` with its
output written to `src/db/database.types.ts`, placed alongside `db:verify-rls`, and its path
named in the `CLAUDE.md` block from change 1. The Zod schemas stay hand-written — they describe
accepted user _input_, not row shape, so generation does not apply to them. `Book` may later be
derived from the generated row type; that swap is S-01's call, not this change's.

#### 3. Remote migration push

**File**: none (CLI operation against the linked project)

**Intent**: Make the deployed Worker's database match the verified local schema, so S-01 has
somewhere real to write.

**Contract**: `npx supabase db push` against the linked project. No schema changes originate
here — the local migration is the source of truth and is pushed unmodified.

### Success Criteria:

#### Automated Verification:

- Remote migration history shows the migration applied: `npx supabase migration list`
- Local reset still succeeds after the doc change: `npx supabase db reset`
- Isolation check still passes: `npm run db:verify-rls`
- Type generation runs and writes a non-empty `books` row type: `npm run db:types`
- Linting passes (`npm run lint`) and formatting is clean on the files this phase
  touched (`npx prettier --check` on them). Repo-wide `prettier --write .` stays out
  of this change for the reason given under criterion 3.4.

#### Manual Verification:

- In the remote Supabase dashboard, `books` exists with RLS enabled and the same four policies
- **DEFERRED to S-01.** As worded this requires creating a book row *through the deployed
  app*, and no screen creates one until S-01 lands, so it cannot be honoured here.
  Established by this change: the migration is applied remotely (`supabase migration list`
  reports the same timestamp under Local and Remote after connecting to the remote database),
  the remote table reports RLS enabled with the same four `authenticated` policies, and the
  deployed site still loads with an intact session after the push. NOT established: the
  deployed request path. The local harness proves the policies; it does not prove the
  deployed app's use of them. S-01 must verify that a book created in the deployed app is
  invisible to a second remote account.
- `CLAUDE.md`'s new block is specific enough that an agent could write S-02's migration from it
  without opening this plan

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

None. There is no test runner in this repo, and introducing one is explicitly out of scope
(see "What We're NOT Doing"). The policy predicates are asserted in SQL instead, which is
closer to the thing being guaranteed than a mocked unit test would be.

### Integration Tests:

- `supabase/tests/rls_books.sql` via `npm run db:verify-rls` — per-operation isolation for
  select, insert, update and delete.
- Negative control: broaden a policy to `using (true)` and confirm the check fails. A check that
  has never failed is not known to work.

### Manual Testing Steps:

1. `npx supabase start`, then `npx supabase db reset`.
2. `npm run db:verify-rls` — expect a clean pass.
3. Sign up two readers against `http://127.0.0.1:54321/auth/v1/signup`, keeping each
   `access_token`.
4. Insert one book for reader A (using reader A's token, so `default auth.uid()` populates
   `user_id`).
5. `GET /rest/v1/books` with reader A's token → one row. Same call with reader B's token → `[]`.
6. Repeat step 5 with no `Authorization` header → HTTP 401 / SQLSTATE 42501 (grant-level refusal, not an empty set).
7. After Phase 4, repeat steps 3–6 against the deployed app's Supabase project.

## Performance Considerations

Negligible at this scale (PRD `target_scale.users: small`). The one thing that matters long-term
is the `(user_id, created_at desc)` index: every RLS predicate filters on `user_id`, so without
it each policy evaluation degrades to a sequential scan as rows accumulate.

## Migration Notes

No existing data — this is the first migration in the project, so there is nothing to migrate or
back-fill. Rollback is `npx supabase migration repair` plus a `drop table public.books cascade`
on the remote, or simply deleting the migration file and running `db reset` locally. Because the
table is new and unreferenced, rollback carries no data-loss risk. Phases 1–3 are entirely local
and revertible with a file delete; Phase 4 is the first irreversible step.

## References

- Roadmap item: `context/foundation/roadmap.md` § Foundations → F-01
- Change identity: `context/changes/private-by-default-data-contract/change.md`
- PRD guarantee being implemented: `context/foundation/prd.md` § Non-Functional Requirements,
  § Access Control
- Stack claim under test: `context/foundation/tech-stack.md` ("Supabase Row-Level Security
  enforces the PRD's strict per-user data isolation without custom middleware")
- Existing session plumbing: `src/lib/supabase.ts:5`, `src/middleware.ts:9`, `src/env.d.ts:3`
- Naming and policy rules: `CLAUDE.md` § Key conventions

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + RLS migration (local)

#### Automated

- [x] 1.1 Local stack starts: `npx supabase start` — 10171ad
- [x] 1.2 Migration applies from scratch with no error: `npx supabase db reset` — 10171ad
- [x] 1.3 Migration is listed as applied locally: `npx supabase migration list` — 10171ad
- [x] 1.4 Linting passes: `npm run lint` — 10171ad

#### Manual

- [x] 1.5 Studio shows `books` with RLS enabled and exactly four `authenticated` policies — 10171ad
- [x] 1.6 Filename matches `YYYYMMDDHHmmss_short_description.sql` — 10171ad

### Phase 2: Isolation verification harness

#### Automated

- [x] 2.1 Isolation check passes: `npm run db:verify-rls` — c702d59
- [x] 2.2 Negative control: broadened policy makes the check FAIL, then reverted — c702d59
- [x] 2.3 Check is idempotent across two consecutive runs — c702d59
- [x] 2.4 Linting passes: `npm run lint` — c702d59

#### Manual

- [x] 2.5 Two local readers created, each with an `access_token` — c702d59
- [x] 2.6 `GET /rest/v1/books` returns reader A's book for A and `[]` for B — c702d59
- [x] 2.7 An unauthenticated request is refused at the grant level (HTTP 401 / SQLSTATE 42501), not filtered to an empty set — c702d59

### Phase 3: Types + validation shape

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — eae8908
- [x] 3.2 Production build succeeds: `npm run build` — eae8908
- [x] 3.3 Linting passes: `npm run lint` — eae8908
- [x] 3.4 Formatting is clean on touched files: `npx prettier --check src/types.ts package.json` (repo-wide `--write` deliberately not run — 39 pre-existing offenders) — eae8908

#### Manual

- [x] 3.5 Every `Book` field maps one-to-one onto a migration column, no extras — eae8908
- [x] 3.6 Neither DTO accepts `user_id` or `id` from the client — eae8908

### Phase 4: Convention capture + remote push

#### Automated

- [x] 4.1 Remote migration history shows the migration applied: `npx supabase migration list`
- [x] 4.2 Local reset still succeeds: `npx supabase db reset` — c11c44f
- [x] 4.3 Isolation check still passes: `npm run db:verify-rls` — c11c44f
- [x] 4.4 Linting passes and formatting is clean on touched files (repo-wide `--write` not run, see 3.4) — c11c44f
- [x] 4.5 Type generation runs and writes a non-empty `books` row type: `npm run db:types` — c11c44f

#### Manual

- [x] 4.6 Remote `books` table shows RLS enabled with the same four policies
- [ ] 4.7 DEFERRED to S-01 — deployed-path isolation is unverifiable until a screen creates a book; migration confirmed applied remotely and remote policies confirmed, but the deployed request path is not exercised
- [x] 4.8 `CLAUDE.md`'s new block is sufficient to write S-02's migration without this plan — c11c44f
