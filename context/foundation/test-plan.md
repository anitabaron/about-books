# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-10

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the risk wins. Do not
   promote to e2e because e2e "feels safer." Do not put a vision model on top of a
   deterministic visual diff that already catches the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team is worried about X,
   and the failure would surface somewhere in \<area\>" carry the same weight as PRD lines or
   hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what could fail_ and _why
   we believe it's likely_ — drawn from documents, interview, and codebase _signal_ (churn,
   structure, test base). It does NOT claim to know which line owns the failure. That
   knowledge is produced by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`, `.github/` — excluding
`context/`, `node_modules/`, build output, `package-lock.json`, and the generated
`src/db/database.types.ts`. 19 commits in the last 30 days, which is enough signal.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by risk = impact ×
likelihood. Risks are failure scenarios in user / business terms, not test names. The Source
column cites the _evidence that surfaced this risk_ — never a specific file as "where the
failure lives" (that is research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                                                                   | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A delete removes more than it should, or leaves notes unreachable: deleting a book or a character takes connections with it in ways the reader did not expect, or a connection survives pointing at a type that is gone                                                   | High   | High       | interview Q1, Q4; PRD § Success Criteria guardrail "a reader's notes must never be lost"; hot-spot dir `supabase/migrations/` — 5 commits/30d                                                                                                                         |
| 2   | A new table ships missing part of the isolation contract — the grant, one of the four policies, the `updated_at` trigger, or the pinned `search_path` — and the omission is invisible locally: the table is unreachable by the app, or reachable in ways it should not be | High   | High       | interview Q3; CLAUDE.md § Supabase migrations, which states the grant is "REQUIRED, not defensive"; hot-spot dir `supabase/migrations/` — 5 commits/30d                                                                                                               |
| 3   | A release looks successful and is not: code reaches production against a schema that does not have the table yet, or an old build keeps serving while the repository is green                                                                                             | High   | High       | interview Q2; `context/foundation/lessons.md` entry #1; two schema-cache incidents and one version-pin incident already lived through                                                                                                                                 |
| 4   | An endpoint verifies that the requester is signed in but not that the resource is theirs, so a hand-crafted POST reaches another reader's book, character, connection or type                                                                                             | High   | Medium     | PRD § Non-Functional Requirements "visible only to that reader"; PRD § Access Control; hot-spot dirs `src/pages/api/characters/[id]/` and `src/pages/api/books/[id]/` — 3 commits/30d each                                                                            |
| 5   | A connection carrying a reader-defined type renders with a blank or `"undefined"` label, so the reader sees a connection whose meaning is missing                                                                                                                         | Medium | Medium     | interview Q3; roadmap § Parked (two-source type resolution); hot-spot dir `src/pages/books/` — 7 commits/30d                                                                                                                                                          |
| 6   | A connection renders somewhere the reader did not record it, or stops rendering where they did: the cast view misrepresents the graph they actually wrote                                                                                                                 | High   | Medium     | PRD US-01 acceptance criteria (reach a character's connections in one interaction); reader report 2026-09-11 that one note appeared under both characters, closed by `context/archive/2026-09-11-one-way-relationships/`                                              |
| 7   | A write endpoint surfaces a raw database error, or writes an invalid combination of type sources: the reader sees a constraint name, or an edit leaves both type columns set or neither                                                                                   | Medium | High       | roadmap § Parked (the write-side type resolution is duplicated across both write endpoints and untested; the update path depends on always writing both columns); hot-spot dirs `src/pages/api/characters/[id]/` and `src/pages/api/books/[id]/` — 3 commits/30d each |

Row 4 is the abuse scenario the risk map requires. The product has authentication and accepts
user input, and the happy path excludes the attacker — which is exactly why it did not surface
from the Phase 2 interview.

Two candidate risks were dropped during the challenger pass, recorded so nobody re-adds them
by accident:

- **Supabase outage** — High impact, Low likelihood. Belongs to observability and alerting, not
  to a test. Padding the map with it would not change what gets built.
- **Authentication flow regression** — that code is `@supabase/ssr`'s, unchanged since
  bootstrap, and the interview did not raise it. Testing it would assert someone else's library.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                               | Must challenge                                                                                                                   | Context `/10x-research` must ground                                                                                                                        | Likely cheapest layer                  | Anti-pattern to avoid                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| #1   | Deleting one reader's book removes exactly its own characters, connections and types, leaves no row referencing a deleted parent, and touches nothing of another reader's | That "the cascade is declared, so it works" — declaration order decides whether a multi-branch cascade resolves at all           | Which delete paths are reachable from the UI, what each cascade branch does, and whether any branch is checked immediately rather than at end of statement | SQL assertions in the existing harness | Asserting a row count after the delete without asserting the absence of orphans, which passes while data is corrupted |
| #2   | A table that is missing its grant, a policy, its trigger or its pinned `search_path` fails a command, not a code review                                                   | That a passing migration means a correct migration — `db reset` proves the SQL ran, nothing more                                 | What the full contract is for this project's tables, and which parts of it are invisible in local use                                                      | Catalog assertions (query `pg_*`)      | Testing that the migration file contains certain text; the file is not the schema                                     |
| #3   | A deploy that serves an old build, or code whose schema is not applied, fails before a reader meets it                                                                    | That a green repository means a green deploy — both past incidents were green everywhere that was checked                        | What the two deploy paths are, what each one reads, and which route or table only the new version can serve                                                | Gate plus post-deploy smoke            | Checking that the site "still loads" — the previous build serves the old routes perfectly well                        |
| #4   | A request authenticated as reader B cannot read, change or delete reader A's row, and cannot forge one as A, through the real endpoint rather than through SQL            | That RLS covers it — RLS checks ownership, not the relation between rows, and the per-endpoint membership checks are hand-rolled | Where each endpoint decides the resource is the caller's, and whether that check is the policy or application code                                         | Integration against the endpoints      | Asserting only the happy path, which passes identically whether or not the ownership check exists                     |
| #5   | A connection whose type row is missing renders no connection rather than an empty label                                                                                   | That the compiler will catch it — the generated schema types are imported nowhere, so nothing reconciles them                    | Where the two type sources converge for display, and what the read does when a referenced type is absent                                                   | Unit (pure function)                   | Copying the expected label out of the resolution code, which green-lights whatever it currently does                  |
| #6   | A connection appears under both of its characters exactly once each, whichever end it was created from                                                                    | That the row's column order means direction — which id sits in which column depends only on who created it                       | How the read indexes rows to characters, and what happens when the same pair is recorded twice                                                             | Unit (pure function)                   | Asserting against one anchor character only, which passes while the other end renders nothing                         |
| #7   | A rejected write returns a sentence a reader can act on, and every accepted write leaves exactly one type source set                                                      | That validation on one path implies it on the other — the resolution logic exists in two copies that can drift                   | Every write path that sets a type, how database errors are translated to messages, and which constraint each path can violate                              | Integration against the endpoints      | Over-mocking the database so the constraint under test never runs                                                     |

### Coverage today

What the existing suite already pins, mapped to the risks above. A test that maps to no stated
risk does not count as coverage, so this mapping is part of the plan rather than an appendix.

| Risk   | Pinned today                                                                                                                                                                                                                                                      | By                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| #5     | A shared literal resolves to itself; a reader-defined id resolves to that reader's name; **a `custom_type_id` missing from the type map resolves to null, not `"undefined"`**; neither source set and both sources set are both skipped                           | unit tests (`src/lib/connections.test.ts`)                  |
| #6     | **A connection is indexed under the character it was created from, and NOT under the other**; a recorded reverse direction is told apart from a restored mirror; several connections group under one character; a connection reaching outside the cast is skipped | same suite                                                  |
| #1     | Deleting a book removes its types and the connections using them; a type in use cannot be deleted; deleting a character takes its connections                                                                                                                     | SQL harness (`supabase/tests/rls_books.sql`, 4 `DO` blocks) |
| #2     | Per-user isolation in both directions on four tables, including positive controls that a too-narrow policy would fail                                                                                                                                             | same harness                                                |
| #7     | Nothing. The write-side type resolution is duplicated across both write endpoints and untested, and the update path's dependence on writing both columns is unasserted                                                                                            | —                                                           |
| #3, #4 | Nothing automated. Both have been verified by hand, once each, at the moment of shipping                                                                                                                                                                          | —                                                           |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder via `/10x-new`.
Status moves left-to-right through the values below; the orchestrator updates Status as
artifacts appear on disk.

| #   | Phase name                     | Goal (one line)                                                                                                                          | Risks covered | Test types                                 | Status      | Change folder |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------ | ----------- | ------------- |
| 1   | Cascade and migration contract | Prove what dies with what and that no note is left orphaned, and assert the isolation contract from the catalog instead of from memory   | #1, #2        | SQL harness assertions, catalog assertions | not started | —             |
| 2   | Deploy verification gate       | Fail loudly when the deployed app cannot serve a route the pushed code defines, or when a migration has not been applied                 | #3            | gate, post-deploy smoke                    | not started | —             |
| 3   | Write-endpoint integration     | Prove ownership is enforced at the endpoint, that a rejected write reads as a sentence, and that exactly one type source is ever written | #4, #7, #5    | integration                                | not started | —             |
| 4   | Cast-view rendering contract   | Extend the pure-function suite to the undirected invariant and to duplicate pairs                                                        | #6            | unit                                       | not started | —             |

Phase order follows the risk map, with one adjustment: Phase 2 is cheap and covers a High ×
High risk that has already fired twice, so it precedes the larger integration phase.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a `checked:` date so
future readers can see which lines need re-verification.

| Layer                | Tool                        | Version | Notes                                                                                                                                           |
| -------------------- | --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                 | Vitest                      | 5.0.0   | `vitest.config.ts` uses a plain `defineConfig`; Astro's `getViteConfig` pulls in the Cloudflare adapter and fails at startup                    |
| database / isolation | psql + `DO` blocks          | n/a     | `supabase/tests/rls_books.sql`, run by `npm run db:verify-rls`; always ends in `rollback`; needs `psql` on PATH, which is not an npm dependency |
| integration (HTTP)   | none yet — see §3 Phase 3   | —       | Eight write endpoints, all following formData → Zod → redirect, none covered                                                                    |
| e2e                  | none — deliberately, see §7 | —       | Excluded by the Phase 2 interview, Q5                                                                                                           |
| visual regression    | none — deliberately, see §7 | —       | Excluded by the Phase 2 interview, Q5                                                                                                           |
| accessibility        | none yet                    | —       | Not raised as a risk; no rollout phase points at it, so it is not listed as a gate                                                              |
| (optional) AI-native | not proposed                | n/a     | FR-006 (AI enrich) is parked, so there is no AI feature to test. This is absence, not an exclusion                                              |

**Stack grounding tools (current session):**

- Docs: none — no Context7 or framework-docs MCP is exposed in this session; stack facts came from
  local manifests, `astro.config.mjs`, `vitest.config.ts` and `package.json`; checked: 2026-09-10
- Search: web search available but not used — the stack is already chosen and pinned, so there was
  nothing to discover; checked: 2026-09-10
- Runtime/browser: `claude-in-chrome` available — noted as a possible e2e layer and deliberately not
  recommended, since §7 excludes browser e2e; checked: 2026-09-10
- Provider/platform: no GitHub or Supabase MCP exposed; the Supabase CLI is available locally and is
  what the harness and catalog assertions use; checked: 2026-09-10

## 5. Quality Gates

The full set of gates that must pass before a change reaches production. "Required after §3
Phase N" means the gate is enforced once that rollout phase lands; before that, the gate is
planned.

| Gate                                | Where       | Required?                 | Catches                                                           |
| ----------------------------------- | ----------- | ------------------------- | ----------------------------------------------------------------- |
| lint                                | local + CI  | **required** (wired)      | syntactic drift, floating promises, unsafe type use               |
| typecheck (`astro check`)           | local       | **required** (wired)      | type drift that propagates from `src/types.ts`                    |
| unit tests (`npm test`)             | local + CI  | **required** (wired)      | logic regressions in extracted pure functions                     |
| Node pin honoured                   | CI          | **required** (wired)      | a build that passes locally and fails on the deploy runner        |
| isolation harness (`db:verify-rls`) | local       | required after §3 Phase 1 | cross-reader access, cascade damage, missing migration contract   |
| deploy verification                 | after merge | required after §3 Phase 2 | code serving against an unapplied schema; an old build still live |
| endpoint integration                | local + CI  | required after §3 Phase 3 | missing ownership checks, raw database errors reaching the reader |
| e2e on critical flows               | —           | not planned               | excluded by §7                                                    |
| visual diff                         | —           | not planned               | excluded by §7                                                    |

lint, typecheck, unit tests and the Node pin became gates in commit `46be9c5`, which added
`npm test` to CI and replaced the hardcoded Node major with `node-version-file: ".nvmrc"`.
The isolation harness is a local command today and becomes a gate when Phase 1 lands.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the relevant rollout
phase ships; before that, the sub-section reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test for extracted logic

- **Location**: next to the module, as `<module>.test.ts` in `src/lib/`.
- **Reference test**: `src/lib/connections.test.ts` — the two-source resolution contract and the
  undirected both-ends invariant.
- **Run locally**: `npm test`.
- **Precondition**: the logic must be a pure function. Logic living in `.astro` frontmatter is
  unreachable by any command; extract it first, as Phase 2 of
  `reader-defined-relationship-types` did.
- **Oracle rule**: take the expected value from the requirement or the interview, never from the
  code under test. An assertion copied out of the implementation green-lights current behaviour,
  bugs included, and can never fail for the right reason.

### 6.2 Adding a database isolation or cascade assertion

- **Location**: `supabase/tests/rls_books.sql`, one `DO` block per table.
- **Run locally**: `npm run db:verify-rls` (needs the local stack up and `psql` on PATH).
- **Both directions are mandatory**: negative assertions that another reader cannot act, _and_
  positive ones that the owner can. Negatives alone pass happily against a policy so narrow it
  breaks the app.
- **Every structural assertion traps its own exception** (`check_violation`, `unique_violation`,
  `foreign_key_violation`). An unwrapped violating statement aborts the whole script, turning a
  passing assertion into a failed run.
- **Reference block**: the `relationship_types` block — name collisions, per-book uniqueness, the
  exactly-one-type-source check, refusal to delete a type in use, and the book-delete cascade.

### 6.3 Adding a catalog assertion for a new table

- TBD — see §3 Phase 1.

### 6.4 Adding an integration test for a write endpoint

- TBD — see §3 Phase 3. The pattern must cover the ownership question in Risk #4, not only the
  happy path.

### 6.5 Verifying a deploy

- TBD — see §3 Phase 2. Until then, the manual rule from `lessons.md` #1 applies: request a route
  only the new code can serve, and pick a probe that can actually distinguish present from absent
  — a `GET` on a POST-only route answers 404 either way.

### 6.6 Per-rollout-phase notes

(Filled in as phases land.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the Phase 2 interview, Q5. Future contributors should respect these
unless the underlying assumption changes.

- **Browser e2e** — expensive to maintain and slow, and the forms are native POSTs whose
  behaviour can be asserted far more cheaply at the endpoint. Re-evaluate if a flow ever depends
  on client-side JavaScript to complete. (Source: Phase 2 interview Q5.)
- **UI snapshots and visual regression** — they break on every Tailwind class change and catch
  nothing about the reader's notes. Re-evaluate if a rendering bug ever reaches a reader.
  (Source: Phase 2 interview Q5.)

Not an exclusion, recorded so it is not mistaken for one: there is no AI-native test layer
because FR-006 is parked and no AI feature exists to test.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-10
- Stack versions last verified: 2026-09-10
- AI-native tool references last verified: 2026-09-10 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the tech stack changes,
- §7 negative space no longer matches what the team believes.
