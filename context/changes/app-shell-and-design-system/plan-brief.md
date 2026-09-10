# Reading-Room UI — Plan Brief

> Full plan: `context/changes/app-shell-and-design-system/plan.md`
> Mockup: `context/changes/app-shell-and-design-system/mockup.html` — four decisions were
> settled on it before any template was touched; see plan.md § Mockup Log.
> Roadmap item: **none** — cross-cutting, like F-01. Sits between S-04 and S-05.
> Prerequisite: **cleared.** S-04 and S-05 both landed and were archived on 2026-09-10; the
> branch is rebased onto `cd6eb2c`. The plan was re-verified against that tree — see
> plan.md § Current State Analysis for what moved under it.

## What & Why

The app still wears the 10x Astro starter — cosmic dark gradient, blurred orbs, glass panels,
purple gradient headings. Four of those are named AI tells. This change replaces the whole
visual layer with a system built for the actual product: a phone-first reading companion that
a reader opens mid-chapter, scans in seconds, and closes.

It ships no capability and closes no FR. It exists so every slice after it inherits a system
instead of copying `rounded-2xl bg-white/10 backdrop-blur-xl` one more time.

## Starting Point

Every signed-in screen is a stack of glass panels on `bg-cosmic`, and there is **no navigation
at all** between them. `global.css` holds the full shadcn token set with every colour at
chroma exactly zero and `--background` at pure `#fff`. `Layout.astro` titles untitled pages
"10x Astro Starter" and ships a viewport tag with no `initial-scale`. No fonts are loaded
anywhere — every screen renders in the browser default.

## Desired End State

Cream stock, warm printing black, hairline-divided rows instead of cards, mono uppercase
labels, three rule weights, zero radius, and one brick red as the only colour in the product.
On a phone: a 48 px top bar and a flat ruled list, ~48 px per row, two lines per book. On a
laptop: a 260 px library rail beside the open book — two panes. `/` is the same system at
poster scale: a masthead rule pair and two stacked Anton lines with an offset ghost layer.
Nothing purple, gradient, blurred, glass or rounded anywhere.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| UI language | English, everywhere | Settles the question the roadmap left open at S-01, at the one moment it is cheap. | User |
| Scope | Tokens + shell + every screen | A half-redesigned app has two levels of polish and reads as unfinished. | User |
| Theme route | Custom, not catalog | 16 of Hallmark's 21 themes have no palette in this install, and the genre's cluster is two themes. | User |
| Dark mode | Tokens now, switch later | Computing both ramps together keeps them coherent; the toggle is cheap to add and expensive to verify. | User |
| Paper | Not `#fff` | "Light but not glaringly light" is precisely what pure white fails at. Value superseded below. | Plan |
| Accent | One colour, never blue | Blue is what every model reaches for. Hue superseded below. | Plan |
| Accent intensity | Low chroma **and** low lightness | Reconciles Hallmark's 0.12 chroma floor with "no intense colours" — dark green reads quiet, the same chroma at L 70 % would not. | Plan |
| Primary button | Ink-filled, not accent-filled | Keeps the accent under the 3 % budget; both reference apps do the same. | Plan |
| Status colour | None — finished books are greyed and dated | A green "finished" badge would collide with the accent's meaning. | Plan |
| Typography | A reading serif for names, never Inter | Newsreader carries the bookish register at heading sizes without ornament. Pairing superseded below. | Plan |
| Density | From row height and hairlines, **not** small type | Body stays at the 16 px floor — it is a reading app, and 44 px touch targets cap the density anyway. | Plan |
| Row title size | Same size as body; the *family* changes | This is why four type sizes are enough for the whole app. | Plan |
| Shell | N3 side-rail, collapsing to a top bar + native disclosure | The right archetype for a two-level app, and categorically not the AI nav. | Plan |
| Panes | Two, not three | S-03 decided against a character detail page; a third Finder column would require one. | Plan |
| shadcn tokens | Names kept, values re-pointed | `button.tsx` and every future `shadcn add` keep working with no edit. | Plan |
| Landing page | Long Document + masthead + statement footer | The product has no metrics, quotes or screenshots; a prose page needs no fabrication. | Plan |
| Where the accent lives | Relationship types, breadcrumb, rail marker, focus | The first draft put it only on desktop-only and state-only surfaces, so it rendered nowhere on a phone. | Mockup |
| Visual direction | Letterpress broadsheet, both surfaces | Accepted from a second mockup after a near-white system had already been accepted; see plan.md § The broadsheet turn. | User |
| Paper | Cream `oklch(93% 0.014 84)` | A printed ground, not a screen one. Costs 5.5 points of brightness — recorded, not hidden. | User |
| Accent hue | Brick `oklch(43% 0.15 30)` | Supersedes spruce. One red, doing accent and destructive duty both. | User |
| Destructive | The same red + word + outline | No room for a second red; hue was never allowed to be the sole signal anyway. | Plan |
| Families | Anton (`/` only) · Newsreader · IBM Plex Mono | Mono carries every label, serif every piece of reading matter; IBM Plex Sans has no role left. | Plan |
| Radius | `0`, product-wide | Square reads printed, rounded reads software. One survivor looks like an oversight. | Plan |
| Hierarchy | Three rule weights, 1 / 2 / 3 px | Rules now carry what colour used to. | Plan |
| Edit disclosure | Inspector: labels left, selects on one row | 44 px controls with stacked labels came out ~460 px tall on a phone; this lands near 180 px. | Mockup |
| Inspector fields | Underlined, not boxed | `--rule-strong` is already at the WCAG 1.4.11 3:1 floor, so weight came off the edges instead of the value. | Mockup |
| Inspector input size | 30 px / 14 px on fine, 36 px / 16 px on coarse | The 16 px floor exists only to stop iOS zooming — a touch concern, not a desktop one. | Mockup |

## Scope

**In scope:** `src/styles/tokens.css` (new); retinted `global.css`; fonts; `Layout.astro` fixes
(title, viewport, skip link, `overflow-x: clip`); `AppLayout` + `AuthLayout`; `Rail` + `TopBar`;
a `Row` primitive; restyled `button.tsx` and the four auth field primitives; rebuilt `/books`,
`/books/[id]`, `/dashboard`, `/auth/*`, `/`; Polish strings in `types.ts` and
`config-status.ts` translated.

**Out of scope:** any database change, migration or RLS work; a dark-mode toggle; converting
any form to an island; a three-pane view; colour-coded relationship types; book covers; search
or sort; deleting `/dashboard`; a repo-wide `prettier --write`.

## Architecture / Approach

Tokens live in `src/styles/tokens.css`, imported by `global.css` alongside the Tailwind
directives so `@theme inline` can see them. The shadcn token names stay and are re-pointed at
Hallmark tokens, which is what keeps `button.tsx` and every future `shadcn add` working. One
`Row` component carries both the book list and the cast list, so the product's density is
decided once. `AppLayout` owns the rail and every signed-in screen goes through it. Every form
stays a native POST — nothing in this change needs client JavaScript.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tokens + document shell | The system, judgeable in isolation; title + viewport fixed | Deleting the Tailwind entry directives un-styles the app while the build still passes |
| 2. Shell + primitives | Rail, top bar, `Row`, button, fields — navigation where there was none | The sticky rail needs `overflow-x: clip`; `hidden` silently breaks it |
| 3. `/books` | **The brief made visible** — the Finder list | Depends on S-04's `finished_at`; the empty state must not cost a screenful |
| 4. `/books/[id]` | The densest screen; card-in-card nesting removed | The JS-off guarantee from S-03 is easy to break while restyling |
| 5. Auth + account | Signed-out surfaces; the language question closed | A regex sweep over Zod messages that changes the schema, not just the text |
| 6. Landing + verification | Long Document page; the four-width and 58-gate sweep | Writing a landing page tempts invented metrics — gate 46 |

**Prerequisites:** S-04 committed. **Phases 1–4 cannot be split; 5 and 6 can slip.**
**Estimated effort:** Two sessions. Phase 4 is the largest single template.

## Open Risks & Assumptions

- **S-04 is mid-flight and owns two of the four templates this change rewrites.** It is
  `status: implementing`, has already added `finished_at` and the finish form to
  `/books/[id]`, and `/books` still needs its filter. Starting before it lands means one of
  the two rewrites loses. **Blocking for Phases 3–4.**
- **S-05's Polish display map is now a dead requirement.** The roadmap parked reader-defined
  relationship types with the note that a Polish display map "stops being optional" — an
  argument that assumed a Polish UI. English removes it. The rest of S-05 is untouched, but
  its planning must not inherit this.
- **The class sweep is the shape `lessons.md` warns about.** `bg-white/10`, `rounded-2xl`,
  `text-purple-300` recur dozens of times across two large templates, and the containers are
  being *removed*, not recoloured — a regex will report success and leave the markup wrong.
  Verify by structure. Deleting `@utility bg-cosmic` first makes the build enumerate the call
  sites for you.
- **The JS-off guarantee is easy to lose.** Every `<details>`, `<form>` and `<select>` on
  `/books/[id]` works with scripting disabled today, verified during S-03. Restyling must not
  wrap them in an island or move a submit into an `onClick`.
- **Contrast numbers in the plan are computed, not measured.** Verifying them in devtools is an
  explicit Phase 1 exit criterion, and `--faint` is deliberately below 4.5:1 — it must never
  land on text.
- **The rail adds a book query to `/books/[id]`.** RLS-filtered and indexed, so cheap — but
  real, and named here rather than smuggled in.
- **`/books` and `/books/[id]` are not in `PROTECTED_ROUTES`.** Signed out they render an empty
  library instead of redirecting. Pre-existing; the redesign makes it more visible. Flagged as
  a decision to take, not fixed here.

## Success Criteria (Summary)

- Every screen renders correctly at 320 / 375 / 414 / 768 px — no horizontal scroll, no
  two-line clickable text, every hit target ≥ 44 px.
- `grep -rnE 'purple|white/1[05]|backdrop-blur|rounded-2xl|bg-cosmic|bg-clip-text' src/`
  returns nothing, and no token has chroma zero.
- Every form on `/books/[id]` still submits with JavaScript disabled, and
  `npm run db:verify-rls` passes unchanged.
- All 58 Hallmark slop-test gates pass.
- The product survives being read on an actual phone during an actual reading session — the
  only test that matters for this brief.
