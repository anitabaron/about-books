---
project: about-books
context_type: greenfield
updated: 2026-06-30
checkpoint:
  current_phase: 7
  phases_completed: [1, 2, 3, 4, 5, 6]
  frs_drafted: 9
  quality_check_status: warned
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: "2026-07-31"
  after_hours_only: true
---

## Vision & Problem Statement

**One-sentence rule**: The app infers and surfaces character relationships as a navigable graph, so a reader can orient themselves in the story without re-reading.

**Pain**: Memory friction — readers lose track of characters, their relationships, plot events, and key dates when reading is spread across many sessions over days or weeks. This is not a comprehension problem; it is a recall problem that surfaces on return.

**Person**: Adult readers who read intermittently — busy adults reading 20–30 minutes at a time, returning after multi-day gaps, often reading complex series or novels with large casts.

**Moment**: Returning to a book after a multi-week gap and needing to remember who a character is, how they relate to others, or when a key plot event happened.

**Cost today**: Backtracking through the book blindly; re-reading passages; losing the thread of the narrative; sometimes abandoning the book entirely.

**Second moment of value**: Weeks or months after finishing a book, a reader wants to recall what it was about — the main characters, key events, the shape of the story. The notes and relationships they built while reading become a personal memory archive. A few names and breakpoints are enough to bring the whole book back. This is a distinct use case from active reading: the reader is not navigating a current plot; they are jogging a completed memory.

**Scope**: Any narrative text — fiction and narrative non-fiction (biographies, history, journalism). Explicit exclusion: textbooks, academic papers, scientific studies.

**Insight**: Dense narrative casts (fantasy, family sagas, historical fiction, biographies with large supporting casts) are unserved by plain note-taking apps because relationships between characters are not first-class data in those tools.

## User & Persona

**Primary persona**: Adult fiction / narrative non-fiction reader.

- Reads in short, interrupted sessions.
- Returns to a book days or weeks after the last session.
- Deals with large character casts, multiple storylines, and non-linear timelines.
- Does not want to re-read; wants to orient quickly and continue.
- Uses the app on a phone during or immediately after reading sessions.

## Access Control

- Authentication: email + password or OAuth (Google or similar).
- User model: flat — every logged-in reader has equal access to their own private collection. No admin role in MVP.
- All data (books, characters, relationships, events) is strictly private to the owning user. No cross-user visibility.

## Success Criteria

### Primary

A reader who has previously added characters and relationships for a book can return after a multi-week gap — whether mid-read or months after finishing — open the book in the app, and immediately orient themselves in the story from their own notes, without re-reading any part of the book.

### Secondary

AI-generated character hints reduce the time needed to describe a known character. Target: 65% of AI-generated hints accepted by the user without editing (from idea-notes.md).

### Guardrails

- The app must be fully usable on a phone browser (mobile-first web). A reader must be able to add a note or check a relationship during or immediately after a reading session on their phone.
- A reader's notes must never be lost. Data safety is the core trust guarantee.

## Functional Requirements

### Books

- FR-001: Reader can register and log in (email + password or OAuth). Priority: must-have

  > Socrates: Counter-argument considered: "auth adds friction at the top of the funnel."
  > Resolution: kept — a reader's notes are personal and private by nature. Auth from the start is correct.

- FR-002: Reader can search for a book by title or author via an external book API (Google Books / Open Library) and add it to their collection. Priority: must-have

  > Socrates: Counter-argument considered: "API data quality is inconsistent — wrong covers, missing authors, duplicates."
  > Resolution: kept — fallback to manual edit covers this; the API is a starting point, not the source of truth.

- FR-008: Reader can browse and search their own book collection. Priority: nice-to-have

- FR-009: Each book has a status — active (currently reading) or finished. Reader can mark a book as finished; the app records the date. Books are filterable by status so the reader can distinguish their current reads from completed ones. Priority: must-have
  > Socrates: No counter-argument surfaced; it stands as written. Note: status is a simple two-state flag (active / finished) with a timestamp on the finished transition. This is not progress tracking — no page counters, percentages, or reading timers. The date exists only to orient the reader on whether a book is finished or not.

### Characters & Relationships

- FR-003: Reader can add, edit, and delete a character and their description note within a book (full CRUD). Priority: must-have

  > Socrates: No counter-argument surfaced; it stands as written.

- FR-004: Reader can add, edit, and delete a named relationship between two characters within a book (type: family / ally / antagonist / romantic / other) (full CRUD). Priority: must-have

  > Socrates: No counter-argument surfaced; it stands as written.

- FR-007: Reader can view their characters and relationships as a structured list or table (default view). Reader can optionally switch to a visual relationship diagram (simple graph format — e.g., Mermaid or equivalent lightweight renderer; no custom layout engine). Priority: must-have
  > Socrates: Counter-argument considered: "diagram rendering is complex; a list solves the same pain for 80% of books."
  > Resolution: refined — the list/table is the primary readable view; the diagram is an optional alternative for readers who prefer a visual map. Both serve the same goal; the reader picks what works for their book and reading style.

### Events & Timeline

- FR-005: Reader can add, edit, and delete key plot events or dates and link them to one or more characters (full CRUD). Priority: must-have
  > Socrates: No counter-argument surfaced; it stands as written.

### AI

- FR-006: A character note is built by the reader over time — name first, description added as reading progresses, updated freely. At any point the reader can invoke "AI enrich" on demand to get a minimal hint (1–2 sentences: essence at first appearance, not arc) as a starting point to accept and edit. AI enrich is not invoked automatically and not applied to every record — the reader decides when and how often to use it. Human interpretation is the primary artifact. Priority: must-have
  > Socrates: Counter-argument considered: "AI descriptions risk spoilers — the model knows the full arc; the reader is mid-book."
  > Resolution: modified — AI hint is constrained to minimal essence (1–2 sentences, first-impression framing). Full character arc is not surfaced. Spoiler risk is mitigated by design of the prompt. AI enrich is on-demand only, reinforcing that the reader's own notes are the primary source of truth.

## User Stories

### US-01: Return to a book after a gap

Given a reader has logged in and previously added characters and relationships for a book,
When they open that book after a multi-week break,
Then they can see their full character map with relationship types and notes without re-reading the book.

### US-02: Add a character mid-session

Given a reader has just encountered a new character while reading,
When they open the app on their phone and navigate to the book,
Then they can add the character with a short note in under 30 seconds without interrupting their reading flow.

### US-04: Recall a finished book

Given a reader finished a book months ago and has notes, characters, and relationships recorded,
When they open that book in the app,
Then they can scan the character list and key events and recall the full shape of the story from memory — without re-reading.

### US-03: AI hint for a known character

Given a reader is adding a character from a widely-known novel,
When they request an AI hint,
Then the app returns a 1–2 sentence minimal description of who that character is (not their arc), clearly labeled as AI-generated, which the reader can accept or edit.

## Business Logic

**Core rule**: The app infers and surfaces character relationships as a navigable graph, so a reader can orient themselves in the story without re-reading.

- Input: reader-supplied character names, notes, relationship types, and linked events.
- Derived output: a relationship graph where nodes are characters and edges are named relationship types. The graph is navigable — a reader can click a character and see all their connections and linked events.
- AI supplements the graph with minimal, first-impression character hints when the book and character are recognizable from public sources. The hint is 1–2 sentences maximum; it does not summarize story arc or reveal plot outcomes.
- The app does NOT make reading recommendations, does NOT prioritize characters for review, and does NOT infer relationships the user has not explicitly recorded. The graph reflects exactly what the reader put in.
- **Diagram generation is data-driven, not AI-generated.** The list/table and diagram views are rendered directly from the reader's own characters, relationships, and events — no language model involved. AI's role is limited to character hints (FR-006) only. This keeps the diagram deterministic, fast, free of hallucination risk, and fully under the reader's control. A future v2 could use AI to _suggest_ missing relationships (e.g., "these two characters share 3 events — did you mean to link them?"), but that is out of scope for v1.

## Non-Functional Requirements

- **Mobile-first**: The app is fully usable on a phone browser without installing a native app. All core flows (add character, view diagram, add event) work on a small screen.
- **Data privacy**: A reader's books, characters, relationships, and events are visible only to that reader. No cross-user data leakage.
- **AI transparency**: The "AI enrich" action is clearly presented as a suggestion the reader can accept and edit — not as authoritative content. No persistent label is required once the reader has made the note their own.

## Quality cross-check

- **Timeline risk** (warned, accepted): Hard deadline 2026-07-31 is ~4 weeks from shaping date (2026-06-30). Scope includes auth, external book API integration, AI character hints, character/relationship data model, and a diagram renderer — all after-hours. User explicitly accepted the timeline as aggressive. `/10x-prd` should surface this in Open Questions with a recommendation to identify the first feature to cut if the deadline slips.

## Non-Goals

- **No social features**: No shared collections, no friend lists, no public reading profiles, no community character databases. Each reader's data is entirely private. Rationale: social features multiply complexity and are explicitly out of scope for this audience and scale.
- **No book purchasing or commerce**: No buy links, affiliate integration, or bookstore search. The app is a reading companion, not a discovery or commerce tool.
- **No scientific / academic / textbook support**: The app is built for narrative text. Non-narrative structure (chapters without characters, citation-heavy text, lab reports) is out of scope by design.
- **No reading progress tracking**: No page counters, reading timers, percentage-complete, or streak stats. From idea-notes.md: explicitly excluded.
