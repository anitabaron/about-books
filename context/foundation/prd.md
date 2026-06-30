---
project: about-books
version: 1
status: draft
created: 2026-06-30
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: # TODO: not captured during shaping — see Open Questions
  data_volume: # TODO: not captured during shaping — see Open Questions
timeline_budget:
  mvp_weeks: 4
  hard_deadline: "2026-07-31"
  after_hours_only: true
---

## Vision & Problem Statement

Adult readers who read intermittently — busy people reading 20–30 minutes at a time, returning after multi-day gaps — lose track of characters, relationships, plot events, and key dates between sessions. This is not a comprehension problem; it is a recall problem that surfaces on return. When a reader opens a book after a multi-week gap, they cannot remember who a character is, how they relate to others, or when a key event happened. Their options today are to backtrack through the book blindly, re-read passages, or lose the thread of the narrative entirely — sometimes abandoning the book.

Dense narrative casts (fantasy, family sagas, historical fiction, biographies with large supporting casts) are unserved by plain note-taking apps because relationships between characters are not first-class data in those tools. A reader's own notes — built up session by session — are the only artifact that can orient them without re-reading. The product's insight: if character relationships were structured data, a reader could navigate them as a graph and orient in seconds rather than minutes.

The app serves two distinct moments of value: active reading (orienting after a gap) and post-reading recall (jogging memory of a finished book weeks or months later). A reader who opens a finished book wants to remember what it was about — the main characters, key events, the shape of the story. The notes they built while reading become a personal memory archive. A few names and breakpoints are enough to bring the whole book back.

## User & Persona

**Primary persona**: Adult fiction and narrative non-fiction reader.

- Reads in short, interrupted sessions (20–30 minutes at a time).
- Returns to a book days or weeks after the last session.
- Deals with large character casts, multiple storylines, and non-linear timelines — complex series, family sagas, historical fiction, biographies.
- Does not want to re-read; wants to orient quickly and continue.
- Uses the app on a phone during or immediately after reading sessions.

**Scope**: Any narrative text — fiction and narrative non-fiction (biographies, history, journalism). Explicit exclusion: textbooks, academic papers, scientific studies.

## Success Criteria

### Primary

A reader who has previously added characters and relationships for a book can return after a multi-week gap — whether mid-read or months after finishing — open the book in the app, and immediately orient themselves in the story from their own notes, without re-reading any part of the book.

### Secondary

AI-generated character hints reduce the time needed to describe a known character. Target: 65% of AI-generated hints accepted by the reader without editing.

### Guardrails

- The app must be fully usable on a phone browser (mobile-first web). A reader must be able to add a note or check a relationship during or immediately after a reading session on their phone.
- A reader's notes must never be lost. Data safety is the core trust guarantee.

## User Stories

### US-01: Return to a book after a gap

- **Given** a reader has logged in and previously added characters and relationships for a book
- **When** they open that book after a multi-week break
- **Then** they can see their full character map with relationship types and notes without re-reading the book

#### Acceptance Criteria

- All characters, relationships, and linked events the reader previously added are visible.
- The reader can navigate from a character to all their connections and linked events in one interaction.

### US-02: Add a character mid-session

- **Given** a reader has just encountered a new character while reading
- **When** they open the app on their phone and navigate to the book
- **Then** they can add the character with a short note in under 30 seconds without interrupting their reading flow

#### Acceptance Criteria

- Character can be added with name only; description is optional at creation time.
- Flow is usable on a phone screen without zooming or horizontal scrolling.

### US-04: Recall a finished book

- **Given** a reader finished a book months ago and has characters, relationships, and events recorded
- **When** they open that book in the app
- **Then** they can scan the character list and key events and recall the full shape of the story from memory — without re-reading

#### Acceptance Criteria
- All characters, relationships, and events recorded during reading are preserved and accessible on finished books.
- The finished book view is readable as a self-contained reference — names, brief notes, and key events are enough to jog memory.

### US-03: AI hint for a known character

- **Given** a reader is adding a character from a widely-known novel
- **When** they invoke "AI enrich" on that character
- **Then** the app returns a 1–2 sentence minimal description of who that character is (not their story arc), which the reader can accept as a starting point and edit freely

#### Acceptance Criteria

- AI hint is 1–2 sentences maximum; it does not summarize story arc or reveal plot outcomes.
- The reader can accept, edit, or discard the suggestion.
- AI enrich is invoked on demand; it is not triggered automatically.

## Functional Requirements

### Authentication

- FR-001: Reader can register and log in (email + password, or via a third-party identity provider). Priority: must-have
  > Socrates: Counter-argument considered: "auth adds friction at the top of the funnel."
  > Resolution: kept — a reader's notes are personal and private by nature. Auth from the start is correct.

### Books

- FR-002: Reader can search for a book by title or author via an external book metadata API and add it to their collection. Priority: must-have

  > Socrates: Counter-argument considered: "API data quality is inconsistent — wrong covers, missing authors, duplicates."
  > Resolution: kept — fallback to manual edit covers this; the API is a starting point, not the source of truth. Specific API provider is a downstream selection (see Open Questions).

- FR-009: Each book has a status — active (currently reading) or finished. Reader can mark a book as finished; the app records the date. Books are filterable by status so the reader can distinguish current reads from completed ones. Priority: must-have

  > Socrates: No counter-argument surfaced; it stands as written. Status is a simple two-state flag (active / finished) with a timestamp on the finished transition. This is not progress tracking — no page counters, percentages, or timers. The date exists only to orient the reader on whether a book is finished or not.

- FR-008: Reader can browse and search their own book collection. Priority: nice-to-have

### Characters & Relationships

- FR-003: Reader can add, edit, and delete a character and their description note within a book (full CRUD). Priority: must-have

  > Socrates: No counter-argument surfaced; it stands as written.

- FR-004: Reader can add, edit, and delete a named relationship between two characters within a book (type: family / ally / antagonist / romantic / other) (full CRUD). Priority: must-have

  > Socrates: No counter-argument surfaced; it stands as written.

- FR-007: Reader can view their characters and relationships as a structured list or table (default view). Reader can optionally switch to a visual relationship diagram (simple graph format; no custom layout engine). Priority: must-have
  > Socrates: Counter-argument considered: "diagram rendering is complex; a list solves the same pain for 80% of books."
  > Resolution: refined — the list/table is the primary readable view; the diagram is an optional alternative for readers who prefer a visual map. Both serve the same goal; the reader picks what works for their book and reading style.

### Events & Timeline

- FR-005: Reader can add, edit, and delete key plot events or dates and link them to one or more characters (full CRUD). Priority: must-have
  > Socrates: No counter-argument surfaced; it stands as written.

### AI

- FR-006: A character note is built by the reader over time — name first, description added as reading progresses, updated freely. At any point the reader can invoke "AI enrich" on demand to get a minimal hint (1–2 sentences: essence at first appearance, not arc) as a starting point to accept and edit. AI enrich is not invoked automatically and not applied to every record — the reader decides when and how often to use it. Human interpretation is the primary artifact. Priority: must-have
  > Socrates: Counter-argument considered: "AI descriptions risk spoilers — the model knows the full arc; the reader is mid-book."
  > Resolution: modified — AI hint is constrained to minimal essence (1–2 sentences, first-impression framing). Full character arc is not surfaced. Spoiler risk is mitigated by design of the prompt. AI enrich is on-demand only, reinforcing that the reader's own notes are the primary source of truth.

## Non-Functional Requirements

- The app is fully usable on a phone browser without installing a native app. All core flows (add character, view diagram, add event) work on a small screen without zooming or horizontal scrolling.
- A reader's books, characters, relationships, and events are visible only to that reader. No cross-user data access is possible.
- "AI enrich" is presented as a suggestion the reader can accept and edit — not as authoritative content. No persistent AI-origin label is required once the reader has made the note their own.

## Business Logic

The app infers and surfaces character relationships as a navigable graph, so a reader can orient themselves in the story without re-reading.

The graph is built from reader-supplied data: character names, description notes, named relationship types (family / ally / antagonist / romantic / other), and plot events linked to characters. The output is a navigable structure — a reader can select any character and see all their connections and linked events in one view, presented as a structured list (default) or a simple relationship diagram (optional).

"AI enrich" supplements a character's note with a minimal, first-impression hint (1–2 sentences, essence only, not story arc) when the book and character are recognizable from public knowledge. The hint is a starting point the reader accepts and edits freely; it does not replace the reader's own interpretation. The app does not make reading recommendations, does not prioritize characters for review, and does not infer relationships the user has not explicitly recorded. The graph reflects exactly what the reader put in.

The relationship diagram view is generated directly from the reader's recorded data — not by AI. The diagram is a deterministic rendering of characters as nodes and named relationship types as edges. AI's role is limited to character hints on demand; it has no role in diagram generation. A potential v2 capability — AI suggesting relationships the reader might have missed based on shared events — is out of scope for v1.

## Access Control

- Authentication: email + password, or sign in via a third-party identity provider.
- User model: flat — every logged-in reader has equal access to their own private collection. No admin role in v1.
- All data (books, characters, relationships, events) is strictly private to the owning user. No cross-user visibility. No shared collections.

## Non-Goals

- **No social features**: No shared collections, no friend lists, no public reading profiles, no community character databases. Each reader's data is entirely private. Rationale: social features multiply complexity and are explicitly out of scope for this audience and scale.
- **No book purchasing or commerce**: No buy links, affiliate integration, or bookstore search. The app is a reading companion, not a discovery or commerce tool.
- **No scientific / academic / textbook support**: The app is built for narrative text. Non-narrative structure (chapters without characters, citation-heavy text, lab reports) is out of scope by design.
- **No reading progress tracking**: No page counters, reading timers, percentage-complete, or streak stats. Book status (active / finished) is the only reading-state data the app records.

## Open Questions

1. **Timeline risk — scope triage plan**: Hard deadline 2026-07-31 is ~4 weeks from PRD creation (2026-06-30). Scope includes auth, external book metadata API integration, AI character hints, character/relationship data model, and a diagram renderer — all after-hours work. User explicitly accepted this as aggressive during shaping. **Recommended triage order if deadline slips**: (1) drop diagram view, default to list only; (2) drop AI enrich; (3) drop book API search, default to manual entry. Owner: user. Revisit: end of week 2.

2. **Target scale — qps and data_volume**: Not captured during shaping. For a small-user-count web app, ballpark estimates are likely low/small. Owner: user. By: before tech-stack selection.

3. **External book metadata API — provider selection**: FR-002 requires an external book metadata API. The specific provider (e.g., Google Books, Open Library, or other) is a downstream tech-stack decision, not a PRD decision. Owner: tech-stack-selector step. By: before implementation.
