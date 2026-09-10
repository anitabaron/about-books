---
project: about-books
version: 2
status: draft
created: 2026-09-09
updated: 2026-09-10
prd_version: 3
main_goal: speed
top_blocker: time
milestone_id: readers-own-vocabulary
milestone_seq: 2
milestone_status: done
---

# Roadmap: about-books

> Derived from `context/foundation/prd.md` (v3) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: The reader's own vocabulary** — Status: done

- **Intent:** M-1 proved a reader can re-orient from their own notes. Using it proved the next thing: the five shared relationship types are too narrow, and forcing a book-specific connection into "other" loses exactly the information the note was for. This milestone makes the relationship vocabulary the reader's own — their own types, scoped to one book, shown in their own language — without putting the extra machinery in front of a reader who never wanted it.
- **Source materials:** `context/foundation/prd.md` (v3), FR-004 as amended 2026-09-10; plus one defect surfaced by using M-1's output.
- **Done when:** every S-NN below is `done`.
- **Scope anchors:** FR-004 (amended 2026-09-10 — reader-defined types alongside the shared five, scoped per book), US-01. The rest of § Scope Triage phase 2 (FR-005 events, FR-006 AI enrich, FR-002b metadata, FR-007 diagram, FR-008 search) stays Parked below in the PRD's own return order — deferred, not cancelled.

## Vision recap

Adult readers who read in short, interrupted sessions lose track of characters, relationships and key events across multi-day gaps. This is a recall problem, not a comprehension problem, and it surfaces on return: the reader either backtracks blindly, re-reads, or abandons the book. Plain note-taking apps do not help, because relationships between characters are not first-class data in them.

The product's bet is that if the reader's own notes about a cast are stored as structured data — named characters, named relationship types between them — the reader can navigate that structure and re-orient in seconds. M-1 shipped that structure with a fixed vocabulary; M-2 tests the follow-on claim that the vocabulary has to belong to the reader for the notes to be worth writing.

## North star

**S-01: Reader can define their own relationship type for a book and use it alongside the shared five** — this is the whole hypothesis of the milestone. If a reader's own vocabulary does not measurably improve what they are willing to record, the rest of the vocabulary machinery is not worth its cost.

> "North star" here means the smallest end-to-end flow whose successful delivery would show the milestone's claim actually holds. It is placed as early as its Prerequisites allow, because every other slice only matters if this one works.

## At a glance

| ID   | Change ID                           | Outcome (user can …)                                                                       | Prerequisites | PRD refs                           | Status |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ---------------------------------- | ------ |
| S-01 | `reader-defined-relationship-types` | define their own relationship type for one book, and use it alongside the five shared ones | M-1 shipped   | FR-004 (amended 2026-09-10), US-01 | done   |

## Baseline

What's already in place in the codebase as of `2026-09-10` (auto-researched + user-confirmed).
Slices below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6.3 + React 19 islands, Tailwind 4, shadcn/ui ("new-york"). Book and cast screens are server-rendered `.astro` with native `<form method="POST">`; the only islands are the auth and add-book forms.
- **Backend / API:** present — 11 endpoints under `src/pages/api/`: three auth, plus `books.ts`, `books/[id]/finish.ts`, `books/[id]/characters.ts`, `characters/[id].ts`, `characters/[id]/delete.ts`, `characters/[id]/relationships.ts`, `relationships/[id].ts`, `relationships/[id]/delete.ts`. Established idiom: `formData()` → Zod → `?error=` redirect, works with JavaScript disabled.
- **Data:** present — 4 migrations, 3 tables (`books`, `characters`, `relationships`), 12 RLS policies (four per table), 3 `updated_at` triggers, `grant … to authenticated` + `revoke all from anon` on each. `supabase/tests/rls_books.sql` holds 4 `DO` blocks with both negative and positive assertions; `npm run db:verify-rls` runs it. `supabase/seed.sql` survives `db reset`. Note for S-01: `relationships` has **no `book_id`** — the book is reached through the characters.
- **Auth:** present — `src/middleware.ts` resolves `locals.user`; `PROTECTED_ROUTES = ["/dashboard", "/books"]`, which already covers `/books/*`.
- **Deploy / infra:** present — Cloudflare Workers as `about-books`; auto-deploy on merge to `main` proven live. `.github/workflows/ci.yml` runs lint + build. `.nvmrc` pins 22.23.2 (must stay ≥ 22.15 — see `lessons.md`).
- **Observability:** partial — Cloudflare platform observability enabled in `wrangler.jsonc`; no app-level logging, error tracking or metrics in `src/`. No requirement in this milestone depends on more, so this stays Parked.

## Foundations

**None.** Every cross-cutting contract this milestone needs already exists and is proven: the RLS template in `CLAUDE.md` (worked example plus four non-derivable rules), the isolation harness, and the form/Zod/redirect idiom. The one new table belongs inside S-01, which integrates it through real user-facing behaviour — introducing it as a foundation first would be layer-work ahead of the slice that gives it meaning.

## Slices

### S-01: Give the reader their own relationship vocabulary

- **Outcome:** user can define their own relationship type for a single book (for example "mieszka z"), use it in a connection alongside the five shared types, rename it once and see the new name on every connection at once. Deleting a type still in use is refused with a sentence naming how many connections hold it.
- **Change ID:** `reader-defined-relationship-types`
- **PRD refs:** FR-004 (amended 2026-09-10), US-01
- **Prerequisites:** relationships CRUD and the cast view shipped in M-1 (`cast-and-relationships-view`, archived 2026-09-10)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - ~~How to scope a custom type to the right book~~ — **resolved 2026-09-10 during planning, from the codebase.** `relationships` has no `book_id`, but both write endpoints already resolve the book through `characters` and reject a cross-book pair that way (`src/pages/api/characters/[id]/relationships.ts:47`). Scoping a custom type is the same comparison in the same branch — no trigger, no denormalised column, no new mechanism.
  - Whether renaming is offered per type or the reader is expected to delete and re-add. The design below assumes rename, because rename propagation is the reason for the foreign key at all; confirm it survives the ergonomic bar M-1 set (US-02: usable on a phone, no zooming, no horizontal scrolling). — Owner: this slice. Block: no.
- **Risk:** The reader who wants nothing beyond the five must not pay for this. If the add-relationship form grows a second step, a type-management link, or a longer select before it grows any value, the slice has made the common case worse to serve the rare one — and M-1's 30-second capture bar is the thing it would break. The second risk is the type picker itself: one form field now carries either a shared literal or a custom type id, and a value that is neither must be refused rather than silently written.
- **Decided up front (carried from M-1's Parked entry — do not re-litigate in planning):**
  - **The five shared types stay in code and are immutable.** They remain held by the check constraint, the Zod schema and `RELATIONSHIP_TYPES`. Custom types are added _alongside_ them as rows in a per-book table — not seeded into it.
  - **~~A Polish display map~~ — reversed 2026-09-10 during planning.** The UI stays English throughout, which also closes the language question left open since M-1's S-01. The problem the map was for still stands ("ally" and "antagonist" read as fantasy-saga in domestic fiction), but this slice answers it another way: the five cannot be renamed, yet a reader who finds them wrong can now write their own type instead of being stuck with one.
  - **A relationship points at a custom type's row; it never stores the name as text.** Two nullable columns on `relationships`: the existing `type` for the five, and `custom_type_id` as a foreign key to the new table, with a constraint that exactly one is filled. Two gains, both load-bearing: fixing a typo in a custom name changes it across every connection at once (a copied string would leave old connections showing the old text), and the delete refusal falls out of `on delete restrict` on the foreign key, so the database enforces it and the application only translates the error into a sentence with the count — "Ten typ jest używany przez 3 połączenia. Najpierw je zmień."
  - **Consequence to plan for:** every read of a relationship now coalesces two sources for display (a code value or a joined row), and the add/edit selects must offer one merged list. That is the cost of the two-column shape, accepted for the rename propagation it buys.
  - **Worth guarding:** nothing structurally stops a custom type named "ally" colliding with a built-in. A unique index on (book, lower(name)) covers customs against each other; rejecting a custom name that matches one of the five needs its own check.
  - **Scope guard, because this table invites growth:** name, book, owner, nothing else. No colours, no icons, no ordering, no sorting. The management screen is a list with add, rename and delete. Anything beyond that comes back to Parked.
  - **If time runs out, the cut line is rename and delete** — defining and using a type is the milestone's claim; managing the list is the comfort around it.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                           | Suggested issue title                              | Ready for `/10x-plan` | Notes                                                         |
| ---------- | ----------------------------------- | -------------------------------------------------- | --------------------- | ------------------------------------------------------------- |
| S-01       | `reader-defined-relationship-types` | Reader-defined relationship types, scoped per book | yes                   | Run `/10x-plan reader-defined-relationship-types`. North star |

## Open Roadmap Questions

1. **Target scale — requests per second and data volume were never captured during shaping.** For a small-user-count personal app the ballpark is almost certainly low, and nothing in this milestone depends on the number. — Owner: user. Block: none (roadmap-wide, informational).
2. **Which external book metadata provider (Google Books, Open Library, other)?** — Owner: tech-stack selection step. Block: FR-002b only, which is Parked. Does not gate any slice in this milestone.

## Parked

Phase-2 requirements, in the return order the PRD itself sets. Nothing here is cancelled — moving one into a milestone means editing its `Priority:` line in the PRD and adding a slice.

- **FR-005 — key events and their links to characters.** Why parked: PRD § Scope Triage, phase 2 item 1 (cheapest to add back: one table, one CRUD, one join). Note the consequence: US-01 and US-04 both have an acceptance criterion mentioning linked events, so both stay partially unmet until this ships.
- **FR-006 / US-03 — AI enrich character hints.** Why parked: PRD § Scope Triage, phase 2 item 2. The PRD's secondary Success Criterion (65% of hints accepted unedited) cannot be measured until this ships. The `openai` package and `OPENAI_API_KEY` are already installed and declared, so nothing blocks its return.
- **FR-002b — external book metadata lookup with prefilled cover and author.** Why parked: PRD § Scope Triage, phase 2 item 3 (largest surface for the least core value).
- **FR-007 diagram view — visual relationship map.** Why parked: PRD § Scope Triage, phase 2 item 4; the list already solves the reader's problem.
- **FR-008 — collection browse and search.** Why parked: PRD § Scope Triage, phase 2 item 5; a plain unsorted list plus the active/finished filter covers the collection today.
- **Editing and deleting a book — follow-up to S-01 of M-1.** Why parked: FR-002 covers adding only, and FR-003's full CRUD is about characters, not books. Deferred during M-1 planning on 2026-09-09, and kept out of M-2 on 2026-09-10 because it is about books, not the relationship vocabulary — including it would dilute this milestone's Done-when. Needs no PRD change to come back. **The cost is small, and this is the first thing to pick up if time remains after Phase 3 — ahead of anything else parked:** `updateBookSchema` already exists unused, and the endpoints are a copy of `src/pages/api/characters/[id].ts` and `characters/[id]/delete.ts`. Raised again on 2026-09-10 and confirmed in the code — books support create and the finished-status update only, so a typo in a title is permanent. Not a PRD gap (FR-002 covers adding), and the rubric is satisfied by characters and relationships, which each carry all four operations.
- **A confirmation step before destructive actions elsewhere in the app.** Why parked: character and relationship delete were put behind a nested `<details>` confirmation on 2026-09-10 (`ceb5bca`). Nothing else in the app deletes anything yet; when book delete returns, it inherits the same pattern rather than inventing one.
- **Deduplicating relationship pairs — was S-02 of M-2, now parked with its blocker answered.**
  Why parked: the decision that unblocked it also made clear it is not worth the remaining
  budget. It was never a PRD gap; the symptom is mild and the fix is not the one-liner it looks
  like. Moved out of `blocked` deliberately — keeping it blocked would misrepresent why it is
  not being built.

  **Decided 2026-09-10, so a later `/10x-plan` starts from a settled shape:**
  - **The uniqueness key is (pair, type), not (pair).** A pair may legitimately carry more than
    one connection — "mieszka z" and "siostry" between the same two women. The defect being
    fixed is only the true duplicate: the same pair with the same type recorded twice, usually
    because it was entered once from each end.
  - **The key must normalise pair order:** `(least(character_a_id, character_b_id),
greatest(character_a_id, character_b_id), type, custom_type_id)`. Without normalising, A→B
    and B→A look different to the index and the defect survives the fix — which is the entire
    failure mode.
  - **The index must be declared `unique nulls not distinct`.** Exactly one of `type` and
    `custom_type_id` is always null, held by the `relationships_one_type` constraint, and
    Postgres treats nulls as distinct in a unique index by default. A plain unique index would
    therefore permit two identical rows and pass every test written against it. This is the trap
    in this change: it is not obvious and it fails silently.
  - **The known cost stands.** A unique index raises a raw database error, so the work is
    catching the violation and translating it into a sentence — in both write endpoints, which
    is the same duplicated `resolveTypeColumns` surface parked below. Doing both together is
    cheaper than doing either alone.

- **Write-side type resolution is duplicated and untested — risk-list entry for `test-plan.md`.**
  Why parked: the code is correct today and the deadline is real. `resolveTypeColumns` exists as
  two near-identical private copies, in `src/pages/api/characters/[id]/relationships.ts` and
  `src/pages/api/relationships/[id].ts`, with no shared definition and no test. Phase 2's named
  key risk was "one form field carrying two meanings", and the unit tests cover only the READ
  side. The update endpoint's own comment names the subtle part: both type columns are always
  written, because writing one leaves the other set and trips `relationships_one_type` — so
  fixing one copy without the other surfaces a raw database error to the reader. The natural
  shape when addressed: a pure classifier (shared literal vs uuid, already half-done by
  `isSharedType`) split from the book-membership check that needs the Supabase client.
- **The 12 `src/lib/connections.ts` tests need an entry in the test plan's risk map.**
  Why parked: retroactive mapping costs nothing but has to happen when `/10x-test-plan` runs.
  Tests that exist without a plan naming the risk they cover read as unmotivated, and the
  rubric marks that criterion failed even though the tests are real and mutation-checked.
- **The `@` path alias is declared in three places with nothing checking they agree:**
  `astro.config.mjs`, `tsconfig.json` and now `vitest.config.ts`. Why parked: the duplication
  is deliberate — `getViteConfig` from `astro/config` pulls in the Cloudflare adapter and fails
  the test run at startup with "exports is not defined" — and a drift here fails loudly on the
  next test run rather than silently. Not worth a mechanism today.
- **Add `npx astro check` to CI.** Why parked: raised 2026-09-10 while reviewing the test plan and deliberately deferred until after Phase 3. One line in `.github/workflows/ci.yml`, and it would make §5 of `test-plan.md` able to claim typecheck as a CI gate rather than local-only — it is the gate that catches exactly the type drift Phase 2 of `reader-defined-relationship-types` was about.
- **App-level observability (logging, error tracking, metrics).** Why parked: no requirement in this milestone depends on it, Cloudflare platform observability is already enabled in `wrangler.jsonc`, and `main_goal: speed` keeps every ungated layer simple.
- **All PRD § Non-Goals stand unchanged:** no social features, no book purchasing or commerce, no academic or textbook support, no reading progress tracking.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap.)

- **M-1: First usable cast** (`first-usable-cast`) — closed 2026-09-10. Shipped the private-by-default data contract plus four vertical slices — books, characters, named relationships with the cast view, and book status — proving a reader can re-orient from their own notes; the north star (S-03) landed with connections readable at zero interactions, against US-01's bar of one.
- **M-2: The reader's own vocabulary** (`readers-own-vocabulary`) — closed 2026-09-10. Shipped reader-defined relationship types scoped per book, usable alongside the immutable five, with rename propagating through a foreign key and deletion of a type in use refused by the database; S-02 (deduplicating pairs) was parked with its uniqueness-key decision answered rather than built.

## Done

(`/10x-archive` is the sole writer of this section.)

- **M-1 F-01: (foundation) the first domain migration exists, with row-level security enabled and granular per-operation, per-role policies, plus the shared entity/DTO types and the request-validation shape that later slices copy — and cross-reader isolation has been checked, not assumed** — Archived 2026-09-09 → `context/archive/2026-09-09-private-by-default-data-contract/`. Lesson:
  `context/foundation/lessons.md` — a toolchain version pin is only tested by the environment
  that reads it. Deploy pipeline: the two Phase 3 items left open in the archived deploy-plan
  (manual dashboard deploy to confirm the pipeline end to end, and the post-deploy health
  check) are satisfied as of 2026-09-10 — commit 96bd1cd built through the Cloudflare Git
  integration and deployed automatically. Recorded here because archived changes are immutable.

- **M-1 S-01: user can add a book by typing title and author, and see it listed in a collection nobody else can read** — Archived 2026-09-10 → `context/archive/2026-09-09-manual-book-entry/`. Lesson: —.

- **M-1 S-02: user can add a character to a book with a name alone in under 30 seconds on a phone, then edit or delete it and fill in the description note later** — Archived 2026-09-10 → `context/archive/2026-09-10-character-notes-crud/`. Lesson: —.

- **M-1 S-03: user can name a relationship between two characters (family / ally / antagonist / romantic / other), and read the whole cast with relationship types and notes as a list or table — reaching any character's connections in one interaction** — Archived 2026-09-10 → `context/archive/2026-09-10-cast-and-relationships-view/`. Lesson: —.

- **M-1 S-04: user can mark a book finished (with the date recorded), filter their collection by active versus finished, and open a finished book to read its cast and notes back as a self-contained reference** — Archived 2026-09-10 → `context/archive/2026-09-10-book-status-and-recall/`. Lesson: —.

- **M-2 S-01: user can define their own relationship type for a single book (for example "mieszka z"), use it in a connection alongside the five shared types, rename it once and see the new name on every connection at once. Deleting a type still in use is refused with a sentence naming how many connections hold it** — Archived 2026-09-10 → `context/archive/2026-09-10-reader-defined-relationship-types/`. Lesson: `context/foundation/lessons.md` entry #4 — a probe must be able to fail for the reason you are testing.
