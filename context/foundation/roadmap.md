---
project: about-books
version: 1
status: draft
created: 2026-09-09
updated: 2026-09-10
prd_version: 2
main_goal: speed
top_blocker: time
milestone_id: first-usable-cast
milestone_seq: 1
milestone_status: open
---

# Roadmap: about-books

> Derived from `context/foundation/prd.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First usable cast** — Status: open

- **Intent:** Prove the product's central claim — that a reader returning to a book after a multi-week gap can orient themselves from their own notes, without re-reading. That means books, characters, named relationships, and one readable cast view, each private to the reader who wrote them.
- **Source materials:** `context/foundation/prd.md` (v2), phase 1 of § Scope Triage
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** PRD phase 1 only — FR-001, FR-002, FR-003, FR-004, FR-007 (list/table view), FR-009; US-01, US-02, US-04. Phase-2 requirements (FR-005, FR-006/US-03, FR-002b, FR-007 diagram, FR-008) are Parked below in the PRD's own return order; they are deferred, not cancelled.

## Vision recap

Adult readers who read in short, interrupted sessions lose track of characters, relationships and key events across multi-day gaps. This is a recall problem, not a comprehension problem, and it surfaces on return: the reader either backtracks blindly, re-reads, or abandons the book. Plain note-taking apps do not help, because relationships between characters are not first-class data in them.

The product's bet is that if the reader's own notes about a cast are stored as structured data — named characters, named relationship types between them — the reader can navigate that structure and re-orient in seconds. The notes serve two moments: orienting mid-read after a gap, and jogging memory of a finished book months later.

## North star

**S-03: Reader can name relationships between characters and read the whole cast as a list** — this is the PRD's primary Success Criterion stated almost word for word, so it is the one slice whose success or failure decides whether the product idea holds.

> "North star" here means the smallest end-to-end flow whose successful delivery would show the product actually solves the reader's problem. It is placed as early as its Prerequisites allow, because every other slice only matters if this one works.

## At a glance

| ID   | Change ID                          | Outcome (user can …)                                                                | Prerequisites | PRD refs                            | Status   |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------- | ------------- | ----------------------------------- | -------- |
| F-01 | `private-by-default-data-contract` | (foundation) first domain table lands with per-user isolation proven and repeatable | —             | FR-001, NFR privacy, Access Control | done     |
| S-01 | `manual-book-entry`                | add a book by title and author and see it in their own collection                   | F-01          | FR-001, FR-002, US-01               | done     |
| S-02 | `character-notes-crud`             | add, edit and delete a character with a note, fast, on a phone                      | S-01          | FR-003, US-02                       | done     |
| S-03 | `cast-and-relationships-view`      | name relationships between characters and read the whole cast as a list             | S-02          | FR-004, FR-007, US-01               | in-progress |
| S-04 | `book-status-and-recall`           | mark a book finished, filter active vs finished, and read a finished book back      | S-01          | FR-009, US-04                       | proposed |

## Baseline

What's already in place in the codebase as of `2026-09-09` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands, Tailwind 4, shadcn/ui ("new-york"). `src/layouts/Layout.astro`, `src/components/ui/button.tsx`, `components.json`.
- **Backend / API:** partial — SSR is live (`output: "server"` in `astro.config.mjs`), but API routes exist only for auth (`src/pages/api/auth/{signin,signup,signout}.ts`). No domain endpoints; `src/types.ts` does not exist yet.
- **Data:** partial — Supabase SSR client wired (`src/lib/supabase.ts`, `@supabase/ssr`), CLI installed, project linked (`supabase/.temp/linked-project.json`) — but `supabase/migrations/` is **absent**: no tables, no RLS policies. This is the milestone's one real gap.
- **Auth:** present — full flow: `src/middleware.ts` resolves `locals.user` and guards `PROTECTED_ROUTES = ["/dashboard"]`; signin / signup / confirm-email pages; three API endpoints; protected `src/pages/dashboard.astro`. FR-001 is essentially satisfied — only route coverage extends per slice.
- **Deploy / infra:** present — `wrangler.jsonc` targets Workers as `about-books` with `nodejs_compat`; `@astrojs/cloudflare` v13; production deploy and auto-deploy on merge to `main` confirmed live by the user (`context/deployment/deploy-plan.md` Phases 2–3 landed). `.github/workflows/ci.yml` runs lint + build.
- **Observability:** partial — Cloudflare platform observability enabled in `wrangler.jsonc`; no app-level logging, error tracking or metrics in `src/`. No phase-1 NFR depends on more, so this stays Parked.

## Foundations

### F-01: Private-by-default data contract

- \*\*O

- **Outcome:** (foundation) the first domain migration exists, with row-level security enabled and granular per-operation, per-role policies, plus the shared entity/DTO types and the request-validation shape that later slices copy — and cross-reader isolation has been checked, not assumed.
- **Change ID:** `private-by-default-data-contract`
- **PRD refs:** FR-001; § Non-Functional Requirements ("a reader's books, characters, relationships, and events are visible only to that reader. No cross-user data access is possible"); § Access Control (flat user model, strictly private collections)
- **Unlocks:** S-01, S-02, S-03, S-04 (every slice writes reader-owned rows); resolves the unknown below about whether Supabase RLS alone carries the isolation guarantee; establishes the verification path "a second signed-in reader cannot read the first reader's rows", which S-01–S-04 each re-run against their own tables.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Does row-level security alone satisfy the PRD's isolation guarantee with the cookie-based SSR session, i.e. does the reader's identity reach the database so policies actually apply? `tech-stack.md` asserts it does "without custom middleware", but no migration exists yet, so nothing has been verified. — Owner: user. Block: no (this foundation exists to answer it).
- **Risk:** Nothing blocks it — auth is already present per Baseline. Sequenced first because it is the only cross-cutting safety contract in the milestone: if the isolation pattern is wrong, all four slices inherit the same privacy defect and retrofitting it means rewriting every table's policies. Scope is deliberately capped at one table plus the reusable convention — it does not pre-build the character, relationship or event schema, and each later slice still adds and integrates its own tables through real user-facing behaviour.
- **Status:** done

## Slices

### S-01: Add a book to your own collection

- **Outcome:** user can add a book by typing title and author, and see it listed in a collection nobody else can read.
- **Change ID:** `manual-book-entry`
- **PRD refs:** FR-002 (manual entry is the whole requirement in phase 1), FR-001 (route protection extends to the new pages), US-01 (the reader needs a book to open)
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Does the deployed app's own request path honour the `books` RLS policies end to end?
    F-01 proved the policies (`npm run db:verify-rls`) and confirmed the migration and the
    four `authenticated` policies on the remote project, but no screen created a book, so
    the deployed path was never exercised. This slice must verify that a book created
    through the deployed UI is invisible to a second remote account — F-01's criterion 4.7,
    deferred here by decision rather than oversight. — Owner: this slice. Block: no.
  - UI language is undecided. Validation messages in `src/types.ts` are Polish (following
    `src/lib/config-status.ts`); the rest of the UI is English ("Sign in", "Dashboard",
    "This page is only for authenticated users"). S-01 adds the first real screens, so it
    should settle this rather than inherit the mix. Five strings now, fifty after S-03.
    — Owner: user. Block: no.
- **Risk:** Carries the one part of F-01's guarantee still unproven end to end (see Unknowns). Sequenced immediately after the foundation because every other phase-1 slice hangs off a book row. Deliberately thin: a plain unsorted list is the whole surface, since collection browse and search is FR-008 and external metadata lookup is FR-002b — both phase 2. The failure mode to watch is scope creep back into those two.
- **Status:** done

### S-02: Add a character mid-session, on a phone

- **Outcome:** user can add a character to a book with a name alone in under 30 seconds on a phone, then edit or delete it and fill in the description note later.
- **Change ID:** `character-notes-crud`
- **PRD refs:** FR-003, US-02
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The acceptance criteria are the risk here, not the CRUD: name-only creation, under 30 seconds, and a phone screen with no zooming and no horizontal scrolling. A desktop-shaped form that technically works would still fail US-02 — and if capture is too slow to survive a 20-minute reading session, the reader never accumulates the notes that S-03 reads back.
- **Status:** done

### S-03: Read the whole cast and how it connects

- **Outcome:** user can name a relationship between two characters (family / ally / antagonist / romantic / other), and read the whole cast with relationship types and notes as a list or table — reaching any character's connections in one interaction.
- **Change ID:** `cast-and-relationships-view`
- **PRD refs:** FR-004, FR-007 (list/table view only), US-01
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the north star, so its details are load-bearing: US-01 requires reaching a character's connections and linked events "in one interaction", which a flat table with no navigation does not satisfy. Linked events are phase 2 (FR-005), so this slice must satisfy that criterion for relationships alone without designing itself into a corner when events arrive. The visual diagram stays Parked — FR-007's own Socratic resolution makes the list the primary readable view.
- **Status:** in-progress

### S-04: Mark a book finished and read it back

- **Outcome:** user can mark a book finished (with the date recorded), filter their collection by active versus finished, and open a finished book to read its cast and notes back as a self-contained reference.
- **Change ID:** `book-status-and-recall`
- **PRD refs:** FR-009, US-04
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends only on S-01, so it can be built alongside the character work — but its US-04 acceptance ("all characters, relationships and events recorded during reading are preserved and accessible on finished books") can only be fully checked once S-03 has landed, so verify it last even if it is implemented early. The other risk is drift into progress tracking: FR-009 is a two-state flag plus one timestamp, and § Non-Goals rules out page counters, percentages and streaks.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                          | Suggested issue title                                                | Ready for `/10x-plan` | Notes                                            |
| ---------- | ---------------------------------- | -------------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| F-01       | `private-by-default-data-contract` | Establish private-by-default data contract (migration + RLS + types) | yes                   | Run `/10x-plan private-by-default-data-contract` |
| S-01       | `manual-book-entry`                | Add a book manually and list your collection                         | no                    | Needs F-01                                       |
| S-02       | `character-notes-crud`             | Add, edit and delete characters with notes (phone-first)             | no                    | Needs S-01                                       |
| S-03       | `cast-and-relationships-view`      | Name relationships and read the whole cast as a list                 | no                    | Needs S-02. North star                           |
| S-04       | `book-status-and-recall`           | Mark books finished, filter by status, read back a finished book     | no                    | Needs S-01. Can run alongside S-02 / S-03        |

## Open Roadmap Questions

1. **Target scale — requests per second and data volume were never captured during shaping.** For a small-user-count personal app the ballpark is almost certainly low, and nothing in phase 1 depends on the number. — Owner: user. Block: none (roadmap-wide, informational).
2. **Which external book metadata provider (Google Books, Open Library, other)?** — Owner: tech-stack selection step. Block: FR-002b only, which is Parked in phase 2. Does not gate any slice in this milestone.

## Parked

Phase-2 requirements, in the return order the PRD itself sets. Nothing here is cancelled — moving one into this milestone means editing its `Priority:` line in the PRD and adding a slice.

- **FR-005 — key events and their links to characters.** Why parked: PRD § Scope Triage, phase 2 item 1 (cheapest to add back: one table, one CRUD, one join).
- **FR-006 / US-03 — AI enrich character hints.** Why parked: PRD § Scope Triage, phase 2 item 2. Note the consequence: the PRD's secondary Success Criterion (65% of hints accepted unedited) cannot be measured until this ships. The `openai` package and `OPENAI_API_KEY` are already installed and declared, so nothing blocks its return.
- **FR-002b — external book metadata lookup with prefilled cover and author.** Why parked: PRD § Scope Triage, phase 2 item 3 (largest surface for the least core value).
- **FR-007 diagram view — visual relationship map.** Why parked: PRD § Scope Triage, phase 2 item 4; the list already solves the reader's problem.
- **FR-008 — collection browse and search.** Why parked: PRD § Scope Triage, phase 2 item 5; a plain unsorted list covers phase 1.
- **Editing and deleting a book — follow-up to S-01.** Why parked: FR-002 covers adding
  only, and FR-003's full CRUD is about characters, not books. Deferred during S-01 planning
  on 2026-09-09 — two days remained for S-01–S-04 with S-03 (the cast view) as the north
  star, so half a day on editing book titles was the wrong trade. Returns as its own slice
  after S-04 if time allows; needs no PRD change to come back. F-01's `updateBookSchema`
  already exists and waits unused for it.
- **App-level observability (logging, error tracking, metrics).** Why parked: no phase-1 NFR depends on it, Cloudflare platform observability is already enabled in `wrangler.jsonc`, and `main_goal: speed` keeps every ungated layer simple.
- **All PRD § Non-Goals stand unchanged:** no social features, no book purchasing or commerce, no academic or textbook support, no reading progress tracking.

## Milestone History

(Append-only. Empty on the first milestone.)

## Done

(Empty on first generation. `/10x-archive` is the sole writer of this section.)

- **F-01: (foundation) the first domain migration exists, with row-level security enabled and granular per-operation, per-role policies, plus the shared entity/DTO types and the request-validation shape that later slices copy — and cross-reader isolation has been checked, not assumed** — Archived 2026-09-09 → `context/archive/2026-09-09-private-by-default-data-contract/`. Lesson:
  `context/foundation/lessons.md` — a toolchain version pin is only tested by the environment
  that reads it. Deploy pipeline: the two Phase 3 items left open in the archived deploy-plan
  (manual dashboard deploy to confirm the pipeline end to end, and the post-deploy health
  check) are satisfied as of 2026-09-10 — commit 96bd1cd built through the Cloudflare Git
  integration and deployed automatically. Recorded here because archived changes are immutable.

- **S-01: user can add a book by typing title and author, and see it listed in a collection nobody else can read** — Archived 2026-09-10 → `context/archive/2026-09-09-manual-book-entry/`. Lesson: —.

- **S-02: user can add a character to a book with a name alone in under 30 seconds on a phone, then edit or delete it and fill in the description note later** — Archived 2026-09-10 → `context/archive/2026-09-10-character-notes-crud/`. Lesson: —.
