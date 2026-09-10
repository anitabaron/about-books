# about-books

A reading companion for people who read one chapter at a time.

You pick a novel back up after two weeks away and the first page is a wall of names.
Who is Alicja again? Was Kasia the one who lives upstairs, or is that Maria? Most
readers do one of three things at that point: page backwards hunting for the moment a
character was introduced, re-read a chapter they've already finished, or quietly give
up on the book.

**about-books** keeps the answer in structured form. You record characters as you meet
them, name the connections between them, and when you come back the whole cast is on
one screen — every character with their relationships listed underneath, no clicking
required.

The insight the app is built on: a note-taking app can hold *"Kasia — lives with
Marta"*, but it holds it as prose, written twice, in two places, going stale. If the
relationship is data instead, it is written once and shows up under both names.

---

## What it does

**Books.** Add a book by title and author. Mark it finished when you get there — the
date is recorded — and reopen it if you marked it by mistake. Filter your collection by
what you're currently reading and what you've finished; books in progress sort to the
top.

**Characters.** Add a character to a book with a name alone, in a few seconds, on a
phone, mid-reading-session. The description note is optional and meant to be filled in
later, as you learn who they are. Edit and delete freely.

**Relationships.** Connect two characters with a named type — family, ally, antagonist,
romantic, other. A connection is stored once and appears under both characters, each
side showing the other. Editing or deleting from either end works the way you'd expect.

**The cast view.** Open a book and you see every character, their note, and their
connections, inline. Nothing to expand, nothing to click. This is the screen the whole
project exists to produce.

**Privacy.** Every book, character and relationship belongs to the reader who wrote it.
Isolation is enforced by Postgres row-level security, not by application code — another
reader's book id returns a 404, and their rows are invisible to every query, including
ones the app didn't write carefully.

## What it deliberately does not do

These are decisions, not gaps:

- **No reading progress tracking.** No page counters, percentages, timers or streaks.
  A book is either being read or finished; that's the whole state.
- **No social features.** No shared collections, no public profiles, no community
  character database. Every reader's notes are private.
- **No book purchasing or discovery.** It's a companion for a book you already have.
- **No academic or textbook support.** Built for narrative — fiction and narrative
  non-fiction. Textbooks and papers have a different shape.

## Not built yet

Recorded, scoped, and waiting rather than forgotten — see
`context/foundation/roadmap.md`:

- key events and dates, linked to characters
- AI-suggested character descriptions, on demand
- book metadata lookup (Google Books / Open Library)
- an optional visual relationship diagram
- reader-defined relationship types, scoped to one book
- collection search, book editing

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro](https://astro.build/) 6, full server-side rendering |
| Interactive bits | [React](https://react.dev/) 19, as islands |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4 |
| Language | TypeScript, with [Zod](https://zod.dev/) validating every route's input |
| Database & auth | [Supabase](https://supabase.com/) — Postgres with row-level security |
| Hosting | [Cloudflare Workers](https://workers.cloudflare.com/), deployed from `main` |

Forms submit as native HTML posts and every screen works with JavaScript disabled.
Scripting adds inline validation and keeps typed input on error; it is never required
to use the app. That matters on a phone with a weak connection, which is where this
app is meant to be used.

## Getting started

**Prerequisites**

- Node.js **22.15 or newer** (`.nvmrc` pins 22.23.2 — Vite needs `module.registerHooks`,
  added in 22.15)
- Docker, for the local Supabase stack
- [Supabase CLI](https://supabase.com/docs/guides/cli) (installed as a dev dependency)

**Setup**

```bash
git clone https://github.com/anitabaron/about-books.git
cd about-books
npm install
npx supabase start          # starts Postgres, auth, Studio and Mailpit in Docker
npx supabase db reset       # applies migrations from scratch
```

Copy the local credentials that `supabase start` prints into `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=sb_publishable_...      # the publishable key, never the secret one
```

The publishable key respects row-level security. A secret key bypasses it entirely,
which would make every isolation guarantee in this project meaningless.

```bash
npm run dev                 # http://localhost:4321
```

Sign up through the app. The local stack does not send real email — confirmation links
land in Mailpit at http://127.0.0.1:54324. Supabase Studio is at http://127.0.0.1:54323.

**Commands**

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on the Cloudflare workerd runtime |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint with type-checked rules |
| `npm run format` | Prettier |
| `npm run db:types` | Regenerate `src/db/database.types.ts` from the local schema |
| `npm run db:verify-rls` | Prove per-reader isolation against the local database |

## Isolation is tested, not assumed

`npm run db:verify-rls` runs `supabase/tests/rls_books.sql` against the local stack. It
creates two readers inside a transaction, impersonates each in turn, and asserts both
directions of the contract:

- reader A can insert, read, update and delete their own rows — including that the
  `user_id` column default assigns ownership without the app ever sending it
- reader B cannot see, update, delete or forge ownership of reader A's rows
- an unauthenticated request is refused at the privilege level, not filtered to empty

The suite always ends in `rollback`, so it writes nothing. Its assertions are proven in
both directions on purpose: a policy narrowed to `using (false)` would pass every
negative check while making the app unusable, so the positive controls exist to catch
exactly that. Widening a policy to `using (true)` makes the suite fail, which is how we
know it can fail at all.

Extend it whenever you add a table with row-level security. The template and the rules
that go with it are in `CLAUDE.md`.

## How this project is documented

The application was built from its written foundation, and that foundation is in the
repository rather than in someone's head:

| Path | What lives there |
| --- | --- |
| `context/foundation/prd.md` | The product contract — problem, users, user stories, functional requirements, non-goals |
| `context/foundation/shape-notes.md` | The discovery conversation the PRD came from |
| `context/foundation/tech-stack.md` | Why this stack, judged against agent-friendliness criteria |
| `context/foundation/infrastructure.md` | Platform choice, with the devil's-advocate and pre-mortem passes that tested it |
| `context/foundation/roadmap.md` | Milestones and slices, what's done and what's deliberately parked |
| `context/foundation/lessons.md` | Failure modes this project actually hit, written down so they don't recur |
| `context/archive/` | Every completed change, with its plan and the record of how it was verified |
| `CLAUDE.md` | Conventions for anyone — human or agent — working in this repository |

`context/archive/` is worth a look if you want to see how a feature got from a roadmap
line to production, including the defects found along the way and the decisions taken
rather than assumed.

## Status

The first milestone is complete: books, characters, relationships, the cast view, and
book status, all behind per-reader isolation and live in production. The second is
open, and its first item is letting a reader define relationship types that fit the
book they're actually reading — because "ally" and "antagonist" are a fantasy-saga
vocabulary, and a novel about six women in a tenement house needs different words.
