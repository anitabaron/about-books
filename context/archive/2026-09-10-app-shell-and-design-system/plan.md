# Reading-Room UI Implementation Plan

## Overview

Replace the 10x Astro starter's visual layer with a design system built for one job: a
phone-first reading companion that a reader opens mid-chapter, scans in seconds, and closes.
Warm paper instead of cosmic dark, hairline-divided rows instead of glass cards, one quiet
signal colour instead of purple gradients, and an application shell — a Finder-style rail on
desktop, a stacked list on a phone — instead of centred marketing containers.

This is a cross-cutting change, not a roadmap slice. It ships no new capability. It exists so
that S-05 and everything after it inherit a system instead of copying `rounded-2xl
bg-white/10 backdrop-blur-xl` one more time.

## Current State Analysis

- **Every screen is starter chrome.** `src/pages/books.astro`, `src/pages/books/[id].astro`
  and `src/pages/dashboard.astro` all open with `bg-cosmic min-h-screen` and render content
  as `rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl` panels. Headings use
  `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent`. Interactive
  colour is `purple-300` (links) and `purple-600` (buttons) throughout.
- **`src/styles/global.css`** carries the full shadcn "new-york" token set. Every colour is
  `oklch(L 0 0)` — chroma zero — with `--background: oklch(1 0 0)` (pure `#fff`) and
  `--foreground: oklch(0.145 0 0)`. A complete `.dark` block exists and nothing switches it.
  `@utility bg-cosmic` is defined here. `@theme inline` re-exports every token to Tailwind.
- **`src/layouts/Layout.astro`** defaults `title` to `"10x Astro Starter"`, ships
  `<meta name="viewport" content="width=device-width">` **without `initial-scale`**, has no
  skip link, no `overflow-x` guard, and a `<style>` block setting `html, body { height: 100% }`.
- **`src/components/Topbar.astro`** is glass + purple and is imported only by `Welcome.astro`
  — the signed-in screens have **no navigation at all**. `/books` cannot be reached from
  `/dashboard`, and `/dashboard` is a stub whose only real content is a sign-out button.
- **`src/components/ui/LibBadge.astro`** (`bg-blue-900/50` + `bg-purple-500/30`) and
  `src/components/Welcome.astro` (cosmic orbs, star field) are starter demo artifacts that
  nothing in the product imports except the landing page.
- **`src/components/ui/button.tsx`** is stock shadcn CVA and consumes `bg-primary`,
  `text-primary-foreground`, `border-input`, `ring-ring`, `bg-destructive`. It is the one
  component worth keeping — but only if the shadcn token *names* survive the retint.
- **The forms are server-rendered and JS-optional by design.** `/books/[id]` uses native
  `<details>` with plain `<form method="POST">` inside; S-03's plan records this as
  deliberate. `AddBookForm` / `AddCharacterForm` are `client:load` islands but degrade to a
  native POST.
- **S-04 and S-05 have both landed and been archived** (main at `cd6eb2c`, 25 commits past
  this plan's original baseline of `796c1a3`; +1505 lines across `src/` and `supabase/`).
  This plan was written against the old tree and re-verified against main on 2026-09-10.
  What changed under it:
  - `src/pages/books/[id].astro` grew by **361 lines**. It now loads per-book custom
    relationship types from a `relationship_types` table and merges them into every select
    beside the five built-ins; `finished_at` and the finish/reopen form are in place.
  - **Two interaction decisions were made there that this change must preserve, not undo:**
    the "Add a character" form is now itself a collapsed `<details>`, and every destructive
    action sits behind a *nested* `<details>` confirmation, so a mis-tap costs a click rather
    than a character. Both are load-bearing on a phone and neither was in this plan.
  - `src/pages/books.astro` grew its status filter (+66 lines).
  - `src/lib/connections.ts` was extracted with `buildConnections()`, and
    `src/lib/connections.test.ts` covers it.
  - Two migrations, a seed file, and +242 lines of RLS assertions landed.
- **A test runner now exists.** `vitest` ^5 with `npm run test` (`vitest run`). Every phase's
  automated criteria must include it; the original draft of this plan asserted there was none.
- **The UI is already almost entirely English.** Only `src/lib/config-status.ts` still holds
  Polish strings — `src/types.ts` and every page came across during S-04/S-05. Phase 5 § 4
  shrinks to one file.
- **No motion library.** No `framer-motion`, `gsap`, `motion` or `lenis` in `package.json`.
  This is a motion-cut project and stays one.
- **No fonts are loaded at all.** Nothing declares a `font-family`; every screen renders in
  the browser default. There is no font stack to preserve — only one to introduce.

## Desired End State

A reader on a 375 px phone opens `/books` and sees their collection as a flat, hairline-ruled
list — title, author, and a date, two lines per book, no cards, no shadows, ~48 px per row —
grouped under quiet "Reading" and "Finished" labels. Tapping a book opens it and the cast
reads the same way: a name, a note, and its connections listed directly underneath, in the
same dense rhythm. The same reader on a laptop gets a 264 px left rail holding the library,
with the book open beside it — the Finder shape, two panes, not three.

Nothing on any screen is purple, gradient-filled, blurred or glass, and nothing has a rounded
corner. The ground is cream (`oklch(93% 0.014 84)`), the text is a warm printing black, every
label is mono uppercase, and hierarchy is carried by three rule weights. **One** colour —
brick red — runs through the whole product: the relationship types down every cast list, the
breadcrumb, the active rail marker, the focus ring, and one line of the poster headline on `/`.
Nothing else.

Opening `/` shows the other half of the same system at poster scale: a masthead with a
3 px + 1 px rule pair, and two stacked Anton lines with an offset ghost layer behind them.

**Verification:** every screen renders correctly at 320 / 375 / 414 / 768 px with no horizontal
scroll and no two-line buttons; `npx astro check`, `npm run lint` and `npm run build` are clean;
`npm run db:verify-rls` still passes untouched; every form on `/books/[id]` still submits with
JavaScript disabled; and all 58 Hallmark slop-test gates pass.

### Key Discoveries

- `src/styles/global.css:1-2` — `@import "tailwindcss"` and `@import "tw-animate-css"` must
  stay first. Tailwind v4 resolves `@theme inline` against whatever `:root` it can see, so
  tokens can live in a separate imported file as long as that import sits with the others.
- `src/components/ui/button.tsx` reads shadcn token *names*, not values. Retinting those names
  in place means the button, and every future `npx shadcn@latest add`, works with no edit.
  Renaming them means touching every component forever.
- `src/pages/books/[id].astro:184` — the `castRows.map` `<li>` is the row primitive to extract.
  It is the same shape as the book row on `/books`, which is why one `Row` component serves both.
- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/books"]`. Every app screen is
  guarded; a signed-out visitor is redirected to `/auth/signin`, so no app screen ever has to
  render a signed-out state. **`/` is the only unguarded page**, which is why it — and only it
  — needs two states.
  *(An earlier revision of this plan claimed `/books` was unguarded. That came from the
  roadmap's Baseline paragraph, which is stale, and was written as if it were a reading of the
  file. Corrected 2026-09-10 against `middleware.ts` itself.)*
- `context/foundation/lessons.md` — a scripted edit reports that it ran, not that it did the
  right thing. This change sweeps repeated class strings across large templates; check the
  rendered structure, not the diff stat.

## What We're NOT Doing

- **No new capability, no database change.** No migration, no RLS policy, no `db:types`, no new
  API route. If `npm run db:verify-rls` behaves differently after this change, something went
  wrong.
- **No dark-mode switch.** Both palettes are computed and written; nothing toggles them and no
  screen is verified in dark. Deliberate — see change.md decision 4.
- **No conversion of any form to a React island.** The `<details>` + native POST pattern on
  `/books/[id]` is load-bearing (S-03 verified it with JavaScript disabled) and survives intact.
- **No undoing S-04/S-05's interaction decisions.** The collapsed "Add a character"
  disclosure and the nested confirmation before every destructive action are restyled, never
  removed. This change owns the visual layer; it does not get to relitigate interaction
  choices made while the product was in use — and the mockups predate both, so where a mockup
  shows a bare Delete button, **the shipped nested confirmation wins.**
- **No merging of built-in and custom relationship types into one flat list in the markup.**
  S-05 renders them as two `<optgroup>`s. That is a data-shape decision; restyle it, keep it.
- **No three-pane Finder column view.** Tempting given the reference, but S-03 decided against a
  character detail page — connections render inline precisely so reaching them costs zero
  interactions. A third pane would need that page to exist. Two panes.
- **No colour-*coded* relationship types.** Five types × five hues would put colour on most of
  the page and break the accent budget. All five types share the **one** accent — the colour
  says "this word came from the system", it does not encode *which* word. Which type it is
  stays carried by the word itself.
- **No status colour.** A finished book is greyed and dated, the way Finder greys an inactive
  item — never badged. With one red doing accent *and* destructive duty, there is no third hue
  to spend on status, and inventing one would break the budget.
- **No second hue in the app.** `--ghost` (the poster's pale teal offset layer) is declared in
  `tokens.css` but must be referenced by `/` alone. An app screen reading it is a bug.
- **No Anton outside `/`.** Single-weight display face with no role in a list; loading it on
  `/books` is dead bytes on a Workers cold start.
- **No hero imagery, illustration, mockup or icon set beyond the `lucide-react` already
  installed.** Enrichment tier: none, typography only.
- **No motion library.** Two microinteraction primitives, both CSS.
- **No book covers.** FR-002b (external metadata with cover art) is parked in phase 2; designing
  a cover slot now would either sit empty or invite placeholder art.
- **No search, no sort, no collection browse.** FR-008 is parked.
- **No `/dashboard` deletion.** It is a protected route in `middleware.ts` and sign-out needs a
  home once the starter Topbar goes; it becomes a minimal account screen instead.
- **No repo-wide `npm run format`.** 39 files are already unformatted per CLAUDE.md; formatting
  them is a separate commit, not noise inside this one.

## Implementation Approach

Seven phases, each independently shippable and verifiable. Phase 1 lands the system with
nothing consuming it, so the palette can be judged in isolation before any template is
rewritten. Phase 2 builds the shell and the three primitives every screen then reuses.
Phases 3 and 4 are the product itself — the library and the book — and are where the brief is
actually satisfied. Phase 5 clears the auth surfaces. Phase 6 replaces the starter landing
page with the root route's two states. Phase 7 runs the cross-cutting checks that only make
sense once every screen exists.

**Phases 3 and 4 are the change.** If time runs short, 5 and 6 can slip; 1–4 cannot be split,
and 7 is not optional — it is where the accessibility and responsive floors are actually
proven rather than assumed.

---

## The Design System

### Route and identity

- **Genre:** editorial, on both surfaces. The earlier draft split the product — modern-minimal
  for the app, editorial for the landing page — and that split is gone. One voice.
- **Theme route:** custom (tuned). Palette and pairing are built for this brief; every
  Hallmark rule and all 58 gates still apply.
- **Vibe:** *letterpress broadsheet, cream stock, one brick red.*
- **Axes:** light / display-condensed-bold / warm ~30°.
- **Enrichment:** none — typography only. The poster hero is set type, not an image.

### Colour

All values OKLCH. The ground is a real cream, not a barely-warm white, and the accent is a
brick red — a printed-object palette rather than a screen one.

**Two hues, and only one of them is in the app.** `--accent` (brick) runs through both
surfaces. `--ghost` (pale teal) exists solely for the poster's offset display layer on `/`;
**no app screen may reference it.** Two saturated hues in a dense list would break both the
accent budget and the brief's "no intense colours".

```css
/* ── Light ──────────────────────────────────────────────────────────── */
--paper:        oklch(93%   0.014 84);   /* cream stock                        */
--paper-2:      oklch(90.5% 0.016 84);   /* rail, sticky heads                 */
--paper-3:      oklch(88%   0.018 84);   /* row hover / selected wash          */

--ink:          oklch(20%   0.012 60);   /* warm printing black                */
--ink-2:        oklch(41%   0.012 62);   /* secondary text                     */
--muted-fg:     oklch(48%   0.012 66);   /* meta, labels, placeholder          */
--faint:        oklch(62%   0.010 70);   /* DECORATIVE ONLY — never body copy  */

--rule:         oklch(74%   0.014 80);   /* hairline                           */
--rule-strong:  oklch(52%   0.014 78);   /* control boundaries — WCAG 1.4.11   */

--accent:       oklch(43%   0.150 30);   /* brick                              */
--accent-ink:   var(--paper);
--focus:        oklch(48%   0.170 30);
--ghost:        oklch(78%   0.055 205);  /* POSTER ONLY — landing hero layer   */

/* ── Dark (computed now, unswitched) ────────────────────────────────── */
--paper:        oklch(18%   0.012 60);
--paper-2:      oklch(21.5% 0.013 60);   /* elevation goes LIGHTER             */
--paper-3:      oklch(25.5% 0.014 60);
--ink:          oklch(92%   0.010 82);
--ink-2:        oklch(74%   0.010 78);
--muted-fg:     oklch(65%   0.010 72);
--faint:        oklch(52%   0.009 70);
--rule:         oklch(32%   0.012 78);
--rule-strong:  oklch(48%   0.012 78);
--accent:       oklch(62%   0.125 30);
--accent-ink:   oklch(18%   0.012 60);
--focus:        oklch(68%   0.140 30);
--ghost:        oklch(48%   0.050 205);
```

**Four consequences of moving off near-white, each of which bit during the mockup:**

- **Every neutral had to move with the paper.** A hairline that reads correctly on
  `oklch(98.5%)` is invisible on `oklch(93%)`. `--rule` sits at L 74 %, fourteen points darker
  than the near-white draft's L 88 %. Porting a rule value between the two palettes without
  re-deriving it is the mistake to watch for.
- **`--rule-strong` moved to L 52 %** to hold 3:1 against the darker ground.
- **The dark ramp's neutral hue is 60, not 84.** Cream at 84° inverts to a muddy olive; the
  warm-black family the print reference actually uses sits nearer 60°. The *accent* hue never
  moves between ramps (30° both) — that rule still holds; the neutral family is its own anchor.
- **Contrast is tighter everywhere**, because the ground is 5.5 points darker. Every ratio in
  this section is computed, not measured. **Measuring them is a Phase 1 exit criterion**, and
  the measurements may force small L adjustments — take the measurement over the plan.

**The accent budget (gate 23, ≤ 3 % of any viewport).** Settled on the mockup, after a first
draft in which the accent rendered nowhere at all on a phone:

1. **Relationship types** down every cast list — always visible, every viewport. The type is
   the only vocabulary on the page that comes from the *system* rather than the reader.
2. The `Books` breadcrumb link.
3. The active rail item's left marker (≥ 60 rem).
4. The focus ring.
5. On `/` only: one display line of the poster headline.

**One red, and it is also the destructive colour.** With a brick accent there is no room for a
second red. Destructive controls therefore carry the word ("Delete"), an outline, and their
position at the end of the inspector — **never hue alone.** That is a WCAG improvement, not a
concession: colour was never allowed to be the sole signal.

**The primary button is ink-filled, not accent-filled.**

### Typography

Three families, which is Hallmark's ceiling — and the third is confined to one page.

| Role | Face | Source | Used for |
| --- | --- | --- | --- |
| Poster | **Anton** | Google | the landing hero on `/` **and nowhere else** |
| Serif | **Newsreader** 400/500/600/700, roman | Google | names, titles, notes, body prose, inputs |
| Label | **IBM Plex Mono** 400/500/600 | Google | every label, meta, button, count, nav item |

```css
--font-poster: "Anton", "Arial Narrow", sans-serif;   /* landing page only */
--font-serif:  "Newsreader", ui-serif, Georgia, serif;
--font-label:  "IBM Plex Mono", ui-monospace, monospace;
```

**IBM Plex Sans is dropped.** The mono carries every label and the serif carries every piece
of reading matter. Keeping the sans as well would be a fourth family and, worse, a redundant
one — there is no role left for it.

**The one shared device, on both surfaces:**

```css
.label { font-family: var(--font-label); text-transform: uppercase;
         letter-spacing: 0.14em; font-weight: 600; font-size: var(--text-label); }
```

Mono uppercase with wide tracking is the loudest signal of the reference and it costs nothing
at density, because labels are short by nature. It is the reason the broadsheet vocabulary
survives the trip down to a 390 px list at all.

**Anton must not be loaded by the app screens.** Single-weight display face, no role outside
the poster; shipping it to `/books` is dead bytes on a Workers cold start.

**Scale — a 1.2 ladder for the app, plus one poster clamp.**

```css
--text-label:   0.66rem;    /* 10.6px — mono caps ONLY; never sentence text   */
--text-xs:      0.833rem;   /* 13.3px — meta                                  */
--text-base:    1rem;       /* 16px   — body, notes, inputs on touch          */
--text-md:      1.2rem;     /* 19.2px — section h2                            */
--text-lg:      1.44rem;    /* 23px   — page h1 (book title)                  */
--text-poster:  clamp(3.1rem, 13cqi, 7rem);   /* landing hero only            */
```

`--text-label` sits below the 14 px body floor deliberately, and is fenced accordingly: it may
carry only uppercase mono words of one or two syllables. The floor protects *reading*; a
tracked-out four-letter cap is not reading. **A sentence set in `--text-label` is a bug.**

**Density still does not come from small type.** Body and notes stay at the 16 px floor.
Compactness comes from row height, hairlines and rhythm.

### Space, rules, radii, motion

```css
--space-3xs: 0.125rem;  --space-2xs: 0.25rem;  --space-xs:  0.5rem;
--space-sm:  0.75rem;   --space-md:  1rem;     --space-lg:  1.5rem;
--space-xl:  2.5rem;    --space-2xl: 4rem;

--row-h: 2.75rem;              /* 2.25rem under (pointer: fine) */
--rule-w:       1px;           /* hairline dividers             */
--rule-w-mid:   2px;           /* section heads, mobile top bar */
--rule-w-thick: 3px;           /* masthead pair, active marker  */

--radius: 0;                   /* everywhere — see below        */

--dur-fast: 90ms;  --dur-base: 140ms;
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in:  cubic-bezier(0.55, 0, 1, 0.45);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

--z-base: 1; --z-raised: 10; --z-dropdown: 100;
--z-sticky: 200; --z-modal: 400; --z-toast: 500; --z-tooltip: 600;
```

**Radius is zero, product-wide.** Square corners read as printed, rounded ones read as
software. It is the cheapest single change that carries the reference, and it must be applied
without exception — one surviving `rounded-md` will look like an oversight rather than a
choice. Consequence for shadcn: `--radius: 0` in the bridge, and `button.tsx` inherits it.

**Rule weights now carry hierarchy that colour used to carry.** Hairline between rows, 2 px
under section heads and the mobile top bar, 3 px for the masthead pair and the active rail
marker. Three weights, three jobs, never decorative.

**Motion — two primitives, unchanged.** `row-press` (a `--paper-3` wash on `:active`,
`--dur-fast`) and `disclosure` (opacity + 2 px translate on the `<details>` panel,
`--dur-base`). The focus ring is not a primitive: instant, never animated. Under
`prefers-reduced-motion: reduce` the disclosure collapses to a ≤ 150 ms crossfade.

### Structure

- **App shell nav: N3 Side-rail.** 260 px at `≥ 60 rem`, grouped under mono-caps **Reading**
  and **Finished** headers with counts. Below 60 rem it collapses to a 48 px top bar with a
  2 px bottom rule and a native `<details>` sheet.
- **App shell footer: none.**
- **Landing page (`/`): 02 Long Document, N6 Newspaper masthead, Ft5 Statement.** A genuine
  masthead — wordmark, issue mark, a 3 px + 1 px rule pair, then section links on a thin rule.
  The hero is two stacked Anton lines with a `--ghost` offset layer behind them, one line in
  `--accent`, on a left-biased two-column grid with the argument in a serif aside.
- **The two surfaces are one system now, not two.** The earlier plan justified an editorial
  landing page beside a modern-minimal app; the broadsheet direction removes that seam. Same
  paper, same three rule weights, same mono labels, same red. The landing page differs only in
  scale, and in being the one page that loads Anton.
- **Cards are gone.** Lists are hairline-divided rows on the paper itself.

### Integration with shadcn

The shadcn token **names** are kept and re-pointed, so `button.tsx`, `cn()` and any future
`npx shadcn@latest add` keep working untouched:

```css
--background: var(--paper);        --foreground: var(--ink);
--card: var(--paper);              --card-foreground: var(--ink);
--muted: var(--paper-2);           --muted-foreground: var(--muted-fg);
--border: var(--rule);             --input: var(--rule-strong);
--ring: var(--focus);
--primary: var(--ink);             --primary-foreground: var(--paper);
--secondary: var(--paper-2);       --secondary-foreground: var(--ink);
--destructive: var(--accent);      /* one red — see § Colour */
--radius: 0;
```

Note the collision: shadcn's `--muted` is a *surface* while the text token is `--muted-fg`.
`--primary` maps to ink, not accent — see the accent budget.


## Critical Implementation Details

**`global.css` is append-and-retint, never overwrite.** `@import "tailwindcss"` and
`@import "tw-animate-css"` must remain the first two lines — deleting them un-styles the entire
application, and the failure is silent in the sense that the build still succeeds. The new
`@import "./tokens.css"` joins them at the top; the `@theme inline` block is edited in place;
the `@layer base` block stays.

**Deleting `@utility bg-cosmic` breaks the build loudly, and that is useful.** Tailwind v4
errors on an unknown utility class, so any `bg-cosmic` left in a template surfaces at build
time rather than rendering a white page. Remove the utility *first*, then let the build
enumerate the call sites. Do not grep-and-replace ahead of it.

**The class sweep is the exact shape `lessons.md` warns about.** `bg-white/10`,
`backdrop-blur-xl`, `rounded-2xl`, `border-white/10`, `text-purple-300`, `text-blue-100/60`
recur dozens of times across two large templates. A regex pass will report a plausible number
of replacements and still leave the markup wrong, because the *containers themselves* are
being removed, not recoloured. Rewrite each template's markup deliberately; then verify with
`grep -nE 'purple|blue-100|white/1[05]|backdrop-blur|rounded-2xl|bg-cosmic' src/` returning
nothing.

**Every `<details>`, `<form>`, `<select>` and `<button>` on `/books/[id]` keeps working with
JavaScript disabled.** This is a verified property from S-03, not an accident. The redesign
restyles those elements; it must not wrap them in an island, replace `<details>` with a
JS disclosure, or move a submit into an `onClick`.

**The rail needs the book list on every page, including `/books/[id]`.** That is a second
query on the detail route. It is RLS-filtered and indexed on `(user_id, created_at desc)`, so
the cost is small — but it is a real addition and must not be smuggled in silently. On the
rail, the currently-open book carries `aria-current="page"`.

**Hit targets ≥ 44 × 44 px below 40 rem, without exception** — including the `<summary>` that
opens each character's disclosure, which is currently a 12 px text link.

**`Astro.response.status`, never a top-level `return`** in any frontmatter this change touches.

---

## Phase 1: Token system and document shell

### Overview

Land the palette, the pairing, the scale and the document-level fixes with nothing yet
consuming them. The palette can then be judged on its own, and the two starter-era `Layout`
defects (the title and the viewport tag) are fixed before any screen is rebuilt on top of them.

### Changes Required:

#### 1. The portable token file

**File**: `src/styles/tokens.css` (new)

**Intent**: One source of truth for the system, in a file that can be lifted into another
project. Hallmark requires a `tokens.css`; Tailwind v4 requires the tokens be visible to
`@theme inline`. An imported file alongside the Tailwind import satisfies both without forking
the system across two files.

**Contract**: The complete light `:root` block and the `.dark` block exactly as specified in
§ The Design System — colour, type, scale, space, row height, radii, motion, z-index. Opens
with the Hallmark stamp:

```css
/* Hallmark · genre: editorial · app-shell (N3 side-rail, no footer)
 *            landing (02 Long Document, N6 masthead, Ft5 statement)
 * theme: custom · vibe: "letterpress broadsheet, cream stock, one brick red"
 * paper: oklch(93% 0.014 84) · accent: oklch(43% 0.15 30)
 * poster: Anton (/ only) · serif: Newsreader · label: IBM Plex Mono
 * axes: light / display-condensed-bold / warm ~30°
 * enrichment: none · studied: no
 */
```

#### 2. Retint `global.css`

**File**: `src/styles/global.css`

**Intent**: Re-point the shadcn token names at the new system and delete the starter's
decorative utility, without touching the Tailwind entry directives.

**Contract**: Keep lines 1–2 verbatim; add `@import "./tokens.css";` beneath them. Replace the
`:root` and `.dark` colour bodies with the shadcn bridge from § Integration with shadcn.
**Delete `@utility bg-cosmic`.** Extend `@layer base` with `html, body { overflow-x: clip }`
(`clip`, never `hidden` — `hidden` creates a scroll container and breaks `position: sticky` on
the rail), the two `font-family` defaults, `font-variant-numeric: tabular-nums` on numeric
contexts, and a `:focus-visible` ring at `var(--focus)` that carries no transition. The unused
`--chart-1..5` tokens go; `--sidebar-*` stays, since the rail may later adopt shadcn's sidebar.

#### 3. Fonts

**File**: `src/layouts/Layout.astro`

**Intent**: Load two families, two weights each, without a layout shift and without a
render-blocking third-party round trip on a Workers cold start.

**Contract**: `<link rel="preconnect">` to `fonts.googleapis.com` and `fonts.gstatic.com`
(crossorigin), then one stylesheet request for `Newsreader:wght@500;700` and
`IBM+Plex+Sans:wght@400;500;600` with `&display=swap`. Both families declare
`font-display: swap`; the `--font-*` fallback stacks in `tokens.css` are the CLS guard.

#### 4. Document shell fixes

**File**: `src/layouts/Layout.astro`

**Intent**: Fix three starter defects that no amount of styling covers.

**Contract**:
- `title` default becomes `"about-books"`, not `"10x Astro Starter"`.
- Viewport becomes
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
  The missing `initial-scale` is why the current pages can render zoomed on some phones;
  `viewport-fit=cover` is the precondition for the safe-area padding the shell needs.
- A `<a class="skip-link" href="#main">` as the first focusable element, visually hidden until
  focused.
- The `<style>` block's `height: 100%` goes — it fights `dvh` and the sticky rail.
- `<html lang="en">` confirmed (already correct) and `color-scheme: light dark` declared.

#### 5. Retint the banner

**File**: `src/components/Banner.astro`

**Intent**: The config-error banner is the one thing a misconfigured deploy shows, and it is
currently raw Tailwind palette hexes (`#fee2e2` / `#dc2626`) in a scoped `<style>`.

**Contract**: Same three variants, same `role` logic, same markup. Colours become tokens:
`--danger` for error, and two new `--warn` / `--info` tokens derived on the same L/C discipline
(both `L ~45 %`, `C ~0.10`, hues ~75 and ~250). This is the one place a third and fourth hue
is justified — status semantics — and none of them appear in normal use.

### Success Criteria:

#### Automated
- [ ] 1.1 `npx astro check` passes
- [ ] 1.2 `npm run lint` passes
- [ ] 1.3 `npm run build` succeeds
- [ ] 1.4 `npx prettier --check` clean on touched files
- [ ] 1.5 `grep -rn 'bg-cosmic' src/` returns only the call sites the build already named

#### Manual
- [ ] 1.6 Measured in devtools, not trusted from the plan: `--ink` ≥ 7:1, `--ink-2` ≥ 4.5:1,
      `--muted-fg` ≥ 4.5:1, `--accent` ≥ 4.5:1, `--danger` ≥ 4.5:1, `--rule-strong` ≥ 3:1,
      `--focus` ≥ 3:1 — all against `--paper`
- [ ] 1.7 `--faint` is confirmed **below** 4.5:1 and appears nowhere in the codebase on text
- [ ] 1.8 Both fonts render (not the fallback) on a hard reload with cache disabled
- [ ] 1.9 No token anywhere has chroma exactly 0, and no `#fff` / `#000` remains in `src/styles/`
- [ ] 1.10 The dark block is present, hue-matched to light, and nothing switches it on

---

## Phase 2: App shell and the three primitives

### Overview

Build the N3 side-rail shell and the three components every screen then reuses. Nothing
user-visible changes yet except navigation appearing where there was none.

### Changes Required:

#### 1. The application layout

**File**: `src/layouts/AppLayout.astro` (new)

**Intent**: One shell for every signed-in screen, so `/books`, `/books/[id]` and the account
screen cannot drift apart. `Layout.astro` stays the bare document; `AppLayout` is the app.

**Contract**: Props `title`, `activeBookId?`. Wraps `Layout`. Renders `<Rail>` and
`<main id="main">` in a CSS grid: single column below 60 rem, `264px minmax(0, 1fr)` above.
The content track uses `minmax(0, 1fr)`, never bare `1fr` — a bare `1fr` will not shrink below
its content and is how a long book title pushes the page into horizontal scroll. Applies
`padding-inline: max(var(--space-md), env(safe-area-inset-left))` and the matching bottom
inset. Loads the reader's book list once and passes it to the rail.

#### 2. The rail

**File**: `src/components/shell/Rail.astro` (new)

**Intent**: The Claude Desktop sidebar shape — grouped, labelled, dense, quiet.

**Contract**: `<nav aria-label="Library">`. A wordmark in `--font-display` 700 at the top.
Then the library grouped under two `--text-xs` uppercase headers with `letter-spacing: 0.08em`
in `--muted-fg` — **Reading** and **Finished** — each with a count. Group headers are stacked
above their list, never beside it (Hallmark gate 54 bans the label-left / content-right
pattern). Each entry is one line, `text-overflow: ellipsis`, `--row-h` tall. The active entry
carries `aria-current="page"`, a `--paper-3` wash and a 2 px `--accent` left marker. At the
foot: the reader's email in `--muted-fg` and a sign-out form. `position: sticky; top: 0;
height: 100dvh; overflow-y: auto` — and this is why the root guard must be `overflow-x: clip`.

Below 60 rem the rail is `hidden` and the top bar takes over.

#### 3. The mobile top bar

**File**: `src/components/shell/TopBar.astro` (new — replaces `Topbar.astro`)

**Intent**: The phone's whole navigation, in 48 px.

**Contract**: `position: sticky; top: 0`, `--paper-2` ground, one `--rule` hairline beneath.
Wordmark left; a `<details>` disclosure right whose panel holds the same grouped library as
the rail plus sign-out. Native `<details>`, no island, no JavaScript. The summary is a
44 × 44 px target. Shown only below 60 rem.

#### 4. The row primitive

**File**: `src/components/ui/Row.astro` (new)

**Intent**: One component for a book on `/books` and a character on `/books/[id]`. The density
of the whole product is decided here, once.

**Contract**: Slots `title`, `meta`, `trailing`, `children`. Renders as an `<li>` with a
`--rule` `border-block-end`, `min-height: var(--row-h)`, `padding-block: var(--space-xs)`,
`padding-inline: var(--space-md)`. Title is `--font-serif` 600 at `--text-base`; meta is the
`.label` device — `--font-label`, uppercase, tracked 0.14em, `--text-label`, `--muted-fg`.
**No border-radius, no background, no shadow, no box** — the hairline is the whole visual
language. `:hover` (guarded by
`@media (hover: hover) and (pointer: fine)`) and `:active` wash to `--paper-3`. `overflow-wrap:
anywhere` and `min-width: 0` on the title so a long book title wraps inside the word instead
of widening the page.

#### 5. Restyle the button

**File**: `src/components/ui/button.tsx`

**Intent**: Keep the CVA API; change what it looks like. Nothing that imports it changes.

**Contract**: Same variants, same sizes, same props. **Every label is the `.label` device** —
`--font-label`, uppercase, tracked 0.1em — and every variant is square (`--radius: 0`); a
button is a stamped block, not a pill. `default` is an ink fill with paper text. `outline` is
a 1 px `--ink` boundary on paper. `ghost` is a transparent boundary with a `--paper-3` hover.
`destructive` is an `--accent` boundary with `--accent` text, and always carries an explicit
verb — hue is never the only signal, because accent and destructive are the same red. `link`
is `--accent` with an underline that thickens on hover.

Every variant gets `white-space: nowrap` (gate 49 — a wrapped button reads as a bug) and
`min-height: 44px` under `@media (pointer: coarse)`. All eight states styled: default, hover,
`:focus-visible`, `:active`, disabled, loading, error, success.

#### 6. Form field primitives

**Files**: `src/components/auth/FormField.tsx`, `PasswordToggle.tsx`, `ServerError.tsx`,
`SubmitButton.tsx`

**Intent**: These already exist and are already used by both auth forms and both add-forms.
Retint them rather than adding a parallel set.

**Contract**: Two densities, because they serve two different moments.

- **Capture controls** — the book composer, the character composer, and every auth field. The
  reader is mid-chapter and US-02 asks for a character in under 30 seconds. Label above,
  `min-height: 44px`, full width.
- **Inspector controls** — everything inside a `<details>` on `/books/[id]`. The reader is
  correcting something, not capturing it, and screen space is the scarce resource.
  `display: grid; grid-template-columns: 3.6rem minmax(0, 1fr)` puts the label in a narrow
  left column beside its control instead of above it.

**Inspector controls are pointer-conditional, and this is not inconsistency.** iOS zooms the
whole viewport when a focused input's font-size is below 16 px, and "no zooming" is an S-02
acceptance criterion. Fine pointers have no such rule. So:

| | Height | Type |
| --- | --- | --- |
| `pointer: fine` | 30 px | 0.875 rem (14 px) |
| `pointer: coarse` | 36 px | 1 rem (16 px) |

**Selects must carry `appearance: none`** plus a data-URI chevron. The native select chrome
sets its own minimum height and will silently ignore the 30 px — this is the one control where
the height simply will not apply otherwise.

**Inspector fields are underlined, not boxed.** `border: 0` plus a single
`border-block-end: 1px solid var(--rule-strong)`, no radius, transparent ground. Capture
controls keep the full box.

The reasoning matters, because "just lighten the border" is the obvious fix and it is not
available: WCAG 1.4.11 asks 3:1 on a control's boundary, and `--rule-strong` at L 58 % is
already the lightest value that clears it against `--paper`. Weight had to come off some
other way. Dropping three of the four edges keeps the full 3:1 on the edge that remains,
removes three-quarters of the ink, and makes the field speak the same hairline language as
every divider on the page — a page built entirely from 1 px rules should not put heavy
rectangles inside its densest panel.

**On the 44 px question:** WCAG 2.2 AA (2.5.8 Target Size Minimum) asks 24 CSS px; 44 px is
AAA / Apple HIG. Inspector fields sit between the two deliberately. The first draft used 44 px
and `--text-base` everywhere; the edit panel came out ~460 px tall on a phone — a whole screen
to change one word — and the 16 px type inside a 13 px UI read as oversized. Corrected on the
mockup, 2026-09-10.

Capture controls keep `--text-base` at both densities: the composer is the 30-second path and
is exactly where an iOS zoom would hurt most.

Both densities share: `--paper` ground, a `--rule-strong` hairline at `--radius`. Focus swaps
the border to `--focus` and adds a 2 px outline, instantly. Error state uses `--danger` on the
border **and** a text message — never colour alone. `ServerError` becomes a `--danger`-ruled
block with `role="alert"`.

### Success Criteria:

#### Automated
- [ ] 2.1 `npx astro check` passes
- [ ] 2.2 `npm run lint` passes
- [ ] 2.3 `npm run build` succeeds
- [ ] 2.4 `npx prettier --check` clean on touched files

#### Manual
- [ ] 2.5 The rail is reachable and usable at 320 / 375 / 414 / 768 / 1280 px
- [ ] 2.6 The mobile disclosure opens, navigates and signs out with JavaScript disabled
- [ ] 2.7 No horizontal scroll at any of the four mobile widths, with a 120-character book title
- [ ] 2.8 No button, nav link or summary wraps to two lines at any width from 320 to 1920 px
- [ ] 2.9 Every interactive element shows a visible focus ring, instantly, with no transition
- [ ] 2.10 Tab order is rail → main, and the skip link lands on `#main`
- [ ] 2.11 Every hit target measures ≥ 44 × 44 px at 375 px
- [ ] 2.12 The active book carries `aria-current="page"` and is distinguishable without colour

---

## Phase 3: The library screen

### Overview

`/books` becomes the Finder list: grouped, hairline-divided, two lines per book, no cards.
This is the first screen where the brief is actually visible.

**S-04 has landed** — `finished_at` and the status filter are both in `books.astro` already.

### Changes Required:

#### 1. Rebuild `/books`

**File**: `src/pages/books.astro`

**Intent**: Turn a stack of glass panels into a scannable collection.

**Contract**: Frontmatter is unchanged except for selecting `finished_at`; the query, the RLS
comment and the error handling stay exactly as they are. The template swaps `Layout` for
`AppLayout` and drops the `bg-cosmic` / `max-w-2xl` / `space-y-8` container wholesale.

Structure top to bottom: an `<h1>` "Your books" at `--text-lg` in `--font-display`; the
add-book form as a **single-line composer** — one input, one button, inline — not a
`rounded-2xl` panel with its own `<h2>`; then the collection as two `<ul>` groups, **Reading**
and **Finished**, each behind a `--text-xs` uppercase header with its count, each row a `Row`
carrying title, author, and "Added <date>". A group with no rows renders nothing at all — no
header, no "None" — the same discipline S-03 applied to a character with no connections.

Finished rows render at `--ink-2` rather than `--ink`, and carry "Finished <date>" in place of
"Added <date>". **No badge, no colour.**

The empty state is one `--text-base` sentence in `--muted-fg` directly beneath the composer.
The current centred `rounded-2xl` box with a `<Library>` icon at `size-8` goes: an empty
library on a phone should not cost a screenful.

#### 2. Copy

**File**: same

**Contract**: English, imperative, specific. "Add a book" → the composer's placeholder is
`Title`, the button is `Add`. Error text stays a sentence, not a code. No invented counts, no
"Trusted by", no fabricated anything — Hallmark gate 46.

### Success Criteria:

#### Automated
- [ ] 3.1 `npx astro check` passes
- [ ] 3.2 `npm run lint` passes
- [ ] 3.3 `npm run build` succeeds
- [ ] 3.4 `npm run db:verify-rls` still passes, unchanged
- [ ] 3.5 `npx prettier --check` clean on touched files

#### Manual
- [ ] 3.6 Twelve books fit on one 375 × 812 screen without scrolling past the fold
- [ ] 3.7 Adding a book still works with JavaScript disabled
- [ ] 3.8 A book with no author renders "Author unknown" and does not shift the row height
- [ ] 3.9 A 120-character title wraps inside the row; the page does not scroll horizontally
- [ ] 3.10 An empty library shows one sentence, not a panel
- [ ] 3.11 A group with zero books renders no header
- [ ] 3.12 `ra@t.test` still cannot see `rb@t.test`'s books
- [ ] 3.13 Nothing on the screen is purple, gradient, blurred or glass

---

## Phase 4: The book screen

### Overview

`/books/[id]` — the north star's surface, and the densest screen in the product. The cast
reads as one continuous ruled list with connections inline, and the editing controls stop
competing with it.

**S-04 and S-05 have both landed** — this template now carries the finish/reopen form, custom relationship types, a collapsed add-character disclosure and nested delete confirmations. Read it before editing.

### Changes Required:

#### 1. Rebuild the page head

**File**: `src/pages/books/[id].astro`

**Contract**: Breadcrumb "Books / <title>" at `--text-xs`, the back-arrow link replaced by a
real trail. `<h1>` is the book title at `--text-lg` in `--font-display` 700; author beneath at
`--text-xs` in `--muted-fg`; the finished date, when present, on the same meta line separated
by a middot. The finish/reopen form becomes an `outline` button on that line rather than a
block below it. The gradient-clipped heading goes.

#### 2. Rebuild the cast

**File**: same

**Contract**: The add-character form becomes the same single-line composer as Phase 3, at the
top of the cast, not a panel. Cast heading is `--text-xs` uppercase "Cast" plus a count.

Each character is a `Row`: name in `--font-display` 500, note beneath in `--text-xs`
`--ink-2`. Connections stay inline and stay unlabelled when empty — the S-03 rule holds
verbatim. Each connection renders as `<relationship type>` in `--text-xs` small-caps at
**`--accent`** with a `min-width: 6.5em` so the types line up as a scannable column, then the
other character's name in `--ink-2`. The current `text-purple-300` / middot / `text-blue-100/80`
triple becomes type-then-name with alignment doing the separating — no middot needed.

The `<details>` disclosure stays native and keeps every form inside it. Its `<summary>` becomes
a 44 px target reading "Edit" rather than a 12 px "Edit or delete" link.

**Inside, the disclosure is an inspector, not a form.** Four rows, not nine blocks:

```
Name   [ Paul Atreides                      ]
Note   [ Heir to Caladan.                   ]
Link   [ Chani  ▾ ][ family ▾ ][ Add ]
       [ Save ]                     Delete
```

Labels sit in the 3.6 rem left column (Phase 2's inspector density). The two relationship
selects share one row with their button and carry `aria-label`s rather than visible labels —
a character's name and a relationship type describe themselves; one "Link" label covers the
row. Save is a small solid button, Delete a small text button in `--danger`, on the same row.
**No "Danger zone" heading, no per-section uppercase labels** — three section headers inside
one disclosure is what made the first draft ~460 px tall on a phone; this comes in near 180 px.

The `rounded-lg` per-connection boxes are replaced by hairline-separated rows in the same
inspector shape. That nesting is where the card-in-card currently lives and removing it is the
single biggest density win on the page.

#### 3. Not-found state

**File**: same

**Contract**: `Astro.response.status = 404` stays exactly as it is — no top-level `return`.
The panel becomes a plain block: one line, one explanation in `--muted-fg`, one link back.

### Success Criteria:

#### Automated
- [ ] 4.1 `npx astro check` passes
- [ ] 4.2 `npm run lint` passes — **exit 2 here means the frontmatter grew a top-level
      `return`; see `lessons.md`, it is a tool crash, not a finding**
- [ ] 4.3 `npm run build` succeeds
- [ ] 4.4 `npm run db:verify-rls` still passes, unchanged
- [ ] 4.5 `npx prettier --check` clean on touched files

#### Manual
- [ ] 4.6 A cast of eight characters with connections is scannable without expanding anything
- [ ] 4.7 Connections still appear under **both** characters of a relationship
- [ ] 4.8 A character with no connections renders no heading, no "None", no bare separator
- [ ] 4.9 Add, edit and delete — character *and* relationship — all work with JavaScript off
- [ ] 4.10 Mark-finished and reopen still work and are idempotent on a double submit
- [ ] 4.11 No nested bordered container anywhere on the page
- [ ] 4.12 A 404 for another reader's book id renders the plain not-found block
- [ ] 4.13 At 375 px: no zoom, no horizontal scroll, every control ≥ 44 px
- [ ] 4.14 Nothing on the screen is purple, gradient, blurred or glass

---

## Phase 5: Auth and account

### Overview

The three auth pages and the `/dashboard` stub. Small surfaces, but they are the first thing a
new reader sees and the only home sign-out has once the starter Topbar is gone.

### Changes Required:

#### 1. An auth shell

**File**: `src/layouts/AuthLayout.astro` (new)

**Intent**: Signed-out pages have no library, so the rail is wrong for them. A narrow centred
column is correct here and nowhere else.

**Contract**: Wraps `Layout`. A `max-width: 24rem` column, the wordmark above the form, one
`--rule` hairline, and a footer line linking to the other auth route. No rail, no top bar.

#### 2. Retint the auth pages

**Files**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`,
`src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`

**Contract**: Swap to `AuthLayout`. The field primitives are already retinted in Phase 2, so
these are mostly container changes. All copy to English.

#### 3. The account screen

**File**: `src/pages/dashboard.astro`

**Intent**: `/dashboard` is the only route in `middleware.ts`'s `PROTECTED_ROUTES` and is
currently a starter stub. It becomes the account screen — the thing the rail's foot links to.

**Contract**: `AppLayout`. `<h1>` "Account". The reader's email as a labelled value. A sign-out
`outline` button. Nothing else — no settings that do not exist, no invented preferences.

#### 4. Translate the remaining Polish strings

**Files**: `src/types.ts`, `src/lib/config-status.ts`

**Intent**: Close the language question the roadmap left open at S-01.

**Contract**: Zod validation messages and config-status messages to English. **Message text
only** — no schema shape changes, no field renames, no change to what validates. Verify by
diffing the schema structure, not the line count (`lessons.md`, third entry).

### Success Criteria:

#### Automated
- [ ] 5.1 `npx astro check` passes
- [ ] 5.2 `npm run lint` passes
- [ ] 5.3 `npm run build` succeeds
- [ ] 5.4 `npx prettier --check` clean on touched files
- [ ] 5.5 `grep -rnE '[ąćęłńóśźż]' src/` returns nothing outside comments

#### Manual
- [ ] 5.6 Sign up → confirm-email → sign in → `/books` works end to end
- [ ] 5.7 A validation error and a server error each render in English, legibly, with a border
      **and** a message
- [ ] 5.8 Sign-out works from the rail, the mobile disclosure, and `/dashboard`
- [ ] 5.9 iOS does not zoom on focusing any auth input (16 px minimum confirmed)
- [ ] 5.10 The config-error banner still renders when `SUPABASE_URL` is unset

---

## Phase 6: The root route — poster and dashboard

### Overview

`/` is the only unguarded page in the product, so it is the only one that carries two states.
Signed out it is the poster. Signed in it is the dashboard: three counts and the way into the
library. Same masthead, same system, one route.

**S-04 has landed** — `finished_at` exists, so the "finished" count is a plain filtered count.

### Why one route and not two

The reader asked for "the dashboard, meaning the landing page". Collapsing them is the right
call and it removes a screen rather than adding one: a signed-in reader who types the bare
domain should land somewhere useful, not on a pitch for a product they already use. The cost
is that `/` now runs an auth branch and three queries — named below, not hidden.

### Changes Required:

#### 1. The root route splits on `locals.user`

**File**: `src/pages/index.astro`

**Intent**: One route, two compositions, no duplicated chrome.

**Contract**: Frontmatter reads `Astro.locals.user` (already resolved by `middleware.ts` on
every request). When null → render `<Poster />`. Otherwise → load the three counts and render
`<Dashboard />`. Both are wrapped by the same masthead component so the two states are visibly
one page in two moods, not two pages.

**The masthead is auth-aware.** Signed out it ends with **Sign in · Sign up**. Signed in those
are gone and the trailing slot holds the reader's email and **Sign out**. A signed-in reader
must never see a sign-in control — that is an explicit requirement, and it applies to the
masthead, the mobile disclosure and the rail alike.

#### 2. The poster (signed out)

**File**: `src/components/marketing/Poster.astro` (new)

**Contract**: As specified in § Structure — masthead rule pair, two stacked Anton lines with
the `--ghost` offset layer, one line in `--accent`, serif argument in a left-biased aside,
`.label` meta row.

**Copy comes from `idea-notes.md` and the PRD, not from `README.md`.** The README is still the
unmodified 10x Astro Starter readme — it describes Astro, React and Tailwind and says nothing
about this product. Anyone reaching for "the description in the README" will find the wrong
thing. `idea-notes.md` § Główny problem is the real source and is in Polish; it must be
rewritten in English as page copy, not translated line by line.

The meta row states real § Non-Goals — "No streaks · No progress bars · No social". These are
verifiable commitments from `idea-notes.md`, not invented proof (gate 46).

#### 3. The dashboard (signed in)

**File**: `src/components/home/Dashboard.astro` (new)

**Intent**: Answer "how much have I got, and where was I" in one screen, then get out of the way.

**Contract**: Macrostructure **04 Stat-Led** — deliberately different from the poster's Long
Document, so the two states of one route do not read as the same page with words swapped. In
this system a stat is an Anton numeral over a `.label` caption, which is exactly how a
broadsheet prints a figure.

Three counts, and only three:

| Label | Source |
| --- | --- |
| `BOOKS` | `books`, all rows |
| `CHARACTERS` | `characters`, all rows — RLS scopes it to the reader, no join needed |
| `FINISHED` | `books` where `finished_at is not null` |

Beneath them, **Reading now** — the active books as `Row`s linking to `/books/[id]`, plus a
single `Open the library` action to `/books`. That is the click path the reader asked for.
Finished books are not listed here; the library has them.

Stats sit inside the `AppLayout` shell, so the rail is present at ≥ 60 rem.

#### 4. The counts

**File**: `src/pages/index.astro` frontmatter

**Contract**: Three `select("*", { count: "exact", head: true })` calls. `head: true` returns
no rows, only the count, so each is an index-only scan against
`<table>_user_id_created_at_idx`. No new migration, no RPC, no view, no `db:types` run.

RLS scopes all three; **no `user_id` filter is written by hand** — adding one would duplicate
the policy rather than reinforce it, the same convention `books.astro` already follows.

If any count errors, render an em dash for that figure and keep the page. One failed count
must not take down the dashboard.

#### 5. The zero state — required, not a nicety

**File**: same

**Contract**: A reader who has just signed up sees `0 · 0 · 0`. Three giant Anton zeros read
as failure, and it is the first screen a new reader ever sees.

**When `books === 0`, the stat block does not render at all.** In its place: one serif
sentence and the add-book composer, inline. No zeros, no empty-state illustration, no
placeholder rows. The stats appear once there is something to count.

`characters === 0` with `books > 0` is fine and renders as a real zero — the reader has a book
and has not yet met anyone in it, which is a true and unembarrassing state.

#### 6. `/dashboard` redirects to `/`

**File**: `src/pages/dashboard.astro`

**Intent**: Two dashboards is the confusion this change exists to remove.

**Contract**: The page becomes a redirect to `/`. Its `PROTECTED_ROUTES` entry stays and costs
nothing. Sign-out keeps its homes: the rail foot, the mobile disclosure, and the masthead.
If an account screen is ever wanted it should be `/account` with a reason to exist — not this
stub kept alive out of momentum. **Confirm before deleting the file's contents.**

> Supersedes Phase 5 § 3, which made `/dashboard` the account screen. That was written before
> `/` became the dashboard.

#### 7. Delete the starter artifacts

**Files**: `src/components/Welcome.astro`, `src/components/Topbar.astro`,
`src/components/ui/LibBadge.astro`

**Contract**: **Deletion requires explicit confirmation at implementation time.** Confirm
`grep -rn 'Welcome\|Topbar\|LibBadge' src/` returns nothing first. The change works either way
— they can stay on disk unimported.

### What this phase does NOT add

- **No progress tracking of any kind.** `idea-notes.md` § "Co NIE wchodzi w zakres MVP" rules
  out time tracking and reading-progress tracking, and § Non-Goals rules out page counters,
  percentages and streaks. **Three integers describing collection size are not progress** —
  but the line is thin and this screen is exactly where it gets crossed. Forbidden here and in
  any follow-up: percentages, "X % through", pages, time, streaks, charts, sparklines,
  week-over-week deltas, "you're on a roll".
- **No fourth stat.** Relationship count is tempting and would be one more query for no
  question anybody asks.
- **No activity feed, no "recently added", no recommendations.**

### Known redundancy, named rather than hidden

At ≥ 60 rem the rail already lists the library grouped by status with counts, so `BOOKS` and
`FINISHED` restate what is on screen two inches to the left. The dashboard earns its place on
three grounds: `CHARACTERS` appears nowhere else in the product; there is no rail below 60 rem,
which is the primary viewport; and the bare domain has to lead somewhere. If it still feels
redundant on a wide screen after real use, the honest fix is to drop the counts on desktop
rather than to justify them.

### Success Criteria:

#### Automated
- [ ] 6.1 `npx astro check` passes
- [ ] 6.2 `npm run lint` passes
- [ ] 6.3 `npm run build` succeeds
- [ ] 6.4 `npm run db:verify-rls` passes, unchanged
- [ ] 6.5 `npx prettier --check` clean on touched files

#### Manual
- [ ] 6.6 Signed out, `/` renders the poster and offers Sign in / Sign up
- [ ] 6.7 Signed in, `/` renders the dashboard and **no sign-in control appears anywhere** —
      masthead, rail, or mobile disclosure
- [ ] 6.8 The three counts match reality: add a book, a character, mark one finished, reload
- [ ] 6.9 A second reader's rows are counted nowhere — `rb@t.test` sees only their own totals
- [ ] 6.10 A brand-new account sees the zero state, **not** `0 · 0 · 0`
- [ ] 6.11 `characters === 0` with one book renders a real zero, not the zero state
- [ ] 6.12 A failed count renders an em dash and the rest of the page still works
- [ ] 6.13 `Open the library` and every "Reading now" row navigate correctly
- [ ] 6.14 `/dashboard` redirects to `/`
- [ ] 6.15 Both states render at 320 / 375 / 414 / 768 px with no horizontal scroll; the three
      stats stay on one row at 320 px or stack cleanly
- [ ] 6.16 The poster hero's ghost layer is absent from the accessibility tree and cannot be
      selected as text
- [ ] 6.17 No number on the page is anything but a real count of the reader's own rows

---

## Phase 7: Cross-cutting verification

### Overview

The checks that only make sense once every screen exists.

### Changes Required:

**Files**: none — this phase changes nothing. If it finds something, the fix belongs to the
phase that owns the file.

**Contract**: The four-width sweep, the 58-gate run, the contrast measurements, the
reduced-motion pass and a keyboard pass across every screen. Then update
`context/foundation/lessons.md` if this change produced a rule worth keeping.

### Success Criteria:

#### Automated
- [ ] 7.1 `npx astro check`, `npm run lint`, `npm run build` all clean
- [ ] 7.2 `npm run db:verify-rls` passes, unchanged from before the whole change
- [ ] 7.3 `grep -rnE 'purple|blue-100|white/1[05]|backdrop-blur|rounded-|bg-cosmic|bg-clip-text' src/`
      returns nothing — note `rounded-` unanchored, since radius is zero product-wide
- [ ] 7.4 `grep -rn 'oklch(0\?\.\?[0-9.]* 0 0)' src/styles/` returns nothing — no zero-chroma token
- [ ] 7.5 `grep -rn 'Anton' src/` matches only `tokens.css` and the poster
- [ ] 7.6 `grep -rn 'ghost' src/pages src/components` matches only the poster
- [ ] 7.7 `npx prettier --check` clean on every file this change touched

#### Manual
- [ ] 7.8 Every screen at **320 / 375 / 414 / 768 px** — no horizontal scroll, no two-line
      clickable text, no element narrower than its content
- [ ] 7.9 All 58 Hallmark slop-test gates pass; gates 19, 23, 34, 38a, 43, 46, 47, 49–54
      checked by name
- [ ] 7.10 Measured contrast on the cream ground: `--ink` ≥ 7:1, `--ink-2` / `--muted-fg` /
      `--accent` ≥ 4.5:1, `--rule-strong` / `--focus` ≥ 3:1; `--faint` confirmed **below**
      4.5:1 and absent from all text
- [ ] 7.11 `prefers-reduced-motion: reduce` collapses the disclosure to a ≤ 150 ms crossfade
      and removes the row-press transition
- [ ] 7.12 Keyboard-only pass: focus always visible, never trapped, order matches visual order
- [ ] 7.13 Greyscale pass: no state communicated by colour alone — including Delete, which
      shares the accent hue
- [ ] 7.14 A cold load on a throttled connection shows fallback type, then swaps — no invisible
      text, no layout jump
- [ ] 7.15 The whole product read on an actual phone, in an actual reading session — the only
      test that matters for this brief

## Progress

All seven phases implemented in one pass on `worktree-reading-room-ui`, verified against the
local stack with `reader-a@local.test`.

- **Phase 1 · Tokens and document shell** — done. `src/styles/tokens.css` (new),
  `global.css` retinted with the shadcn bridge and `bg-cosmic` deleted, `Layout.astro` fixed
  (title, `initial-scale`, `viewport-fit`, skip link, `overflow-x: clip`, conditional Anton),
  `Banner.astro` retinted.
- **Phase 2 · Shell and primitives** — done. `AppLayout.astro`, `shell/Rail.astro`,
  `ui/Row.astro`, `lib/library.ts`, `styles/forms.css`, `ui/button.tsx` and the four auth
  primitives.
- **Phase 3 · `/books`** — done, plus one change the plan did not call for: the add-book form
  is now a collapsed disclosure, matching what S-05 had already done to add-character. Seen
  on screen, the expanded two-field form owned the entire first screen of a phone.
- **Phase 4 · `/books/[id]`** — done. Every S-04/S-05 interaction decision preserved: the
  collapsed add-character disclosure, all three nested delete confirmations, the
  Shared/custom `<optgroup>` split, and the `#relationship-types-add` fragment links.
- **Phase 5 · Auth and account** — done. `AuthLayout.astro`, three auth pages,
  `config-status.ts` translated (the last Polish strings in `src/`).
- **Phase 6 · Root route** — done. `marketing/Poster.astro`, `home/Dashboard.astro`,
  `index.astro` branching on `locals.user`, `/dashboard` forwarding to `/`. The three starter
  artifacts are deleted.
- **Phase 7 · Verification** — `npm run lint`, `npx astro check` (0 errors),
  `npm run test` (12 passed), `npm run build`, `npm run db:verify-rls` (all four tables pass
  both directions). Every screen walked in a real browser signed in as `reader-a@local.test`.

### Found only by looking at it running

Four defects that every automated gate passed:

1. **`SIGN OUT` rendered in the serif.** `font: inherit` on the button — the shorthand resets
   `font-family` and silently dropped the mono that `.label` had just set. Lint, types and
   build were all clean.
2. **The content pane was uncapped.** On a wide monitor the three dashboard figures stood a
   foot apart and every row title was stranded at the far left. `.main` now caps at 56 rem.
3. **An empty band above the vocabulary section** — the cast list already ends in a hairline
   and `.block-disclose` added a second one 16 px below. Needed `details.vocab` to out-specify
   the `border-block` shorthand; the plain `.vocab` override lost on source order.
4. **`RELATIONSHIP TYPES2`** — the separator collapsed under `letter-spacing`.

### Deviations from the plan, and why

- **`/books` add-form collapsed** (above). The plan said "single-line composer"; the form has
  two fields and an island, so a disclosure is the honest equivalent.
- **`AppLayout` gained a `poster` prop.** The dashboard sets its stat numerals in Anton, and
  Anton was being loaded only for the signed-out poster — the figures would have silently
  fallen back to Arial Narrow. Caught by grepping which files reference `--font-poster`.
- **`/dashboard` uses `Astro.response` + a `Location` header**, not `return
  Astro.redirect()`. A top-level `return` in frontmatter is the exact construct
  `lessons.md` records as crashing the linter with exit 2.

### Review round on a real phone (2026-09-10)

Nine changes, all from the reader looking at the running app. Recorded because
several of them contradict something the plan asserted:

1. **Sign in / Sign up moved into the masthead's top row.** Sharing one wrapping row
   with three section links pushed them onto the last line at 375 px — "Sign in" at the
   *bottom* of the masthead, which is the one control a visitor must never hunt for.
   The tagline took their place in the nav row.
2. **The mobile disclosure is labelled "Menu", not "Library".** Sign-out lives inside
   it. It was reachable the whole time and the reader could not find it, which is what
   a discoverability defect looks like from the outside.
3. **Book rows carry author and cast size.** `characters(count)` is a PostgREST embedded
   aggregate, so a fifty-book library is still one round trip. Applied to `/books` as
   well as the dashboard, so the two do not diverge.
4. **Capture fields are underlined too.** The plan split boxed-for-capture from
   underlined-for-inspection; that split was the plan's own invention and the reader had
   accepted "underline". One field treatment product-wide now, two densities. The boxed
   `.composer` rules were deleted rather than left unused.
5. **Delete is a bin glyph on the Save line**, for characters and for relationship types.
   Editing is constant and deleting is rare; a full-width red button gave the rare action
   more weight than the frequent one. Save reaches its form with `form=` because a
   `<form>` cannot nest inside another, and the delete needs its own. The nested
   confirmation is untouched.
6. **The other destructive openers are quiet text**, not outlined red boxes.
7. **The wordmark took three attempts.** Serif caps read as neither mark nor title;
   Anton shouted inside a UI (and forced the poster face onto every page, so the fence
   came off and then went back on); the mono read as a stamp. It ends as the page-title
   face set exactly like a page title — Newsreader 700, *no uppercasing*. Forcing caps
   was the mistake all three times.
8. **The wordmark carries the poster's two offset layers** — pale up-left, brand red
   down-right. `--ghost` is therefore no longer poster-only, and `white-space: nowrap`
   on the clones is load-bearing: an absolutely-positioned clone has no width, so
   without it the copies wrap and pile up under the real mark as a smear.
9. **Offsets are fixed px, not em, and small.** Scaling them with font-size was a
   plan-grade idea and a mess on screen — at 19 px the layers drift into three
   overlapping words. Settled at `-2px/-2px` pale and `+2px/+1px` red: two passes of
   ink slightly out of register, not a drop shadow.

### Not verified

- **Nothing was seen below ~1500 px.** `resize_window` reports success in this environment
  and the viewport does not change, so **the 320 / 375 / 414 / 768 px sweep did not run
  against the real app.** The breakpoints are the same ones the accepted mockup used at
  390 px, and the markup is `minmax(0, 1fr)` throughout — but that is reasoning, not
  evidence. Criteria 6.15, 7.8 and 7.12 remain open and should be run on an actual phone
  against `npm run dev`.
- **Dark mode** is tokens-only by decision; no screen was checked in it.
- **Contrast (7.10) was computed, not measured.** The cream ground is 5.5 points darker than
  the ratios were first derived against.

## Open Questions

1. **Sequencing against S-04.** This plan assumes `book-status-and-recall` is committed before
   Phase 1 begins. Phases 3 and 4 rewrite the two templates S-04 is editing right now, and
   Phase 3 depends on its `finished_at` filter. — Owner: user. **Block: yes, for Phases 3–4.**
2. **The three deletions** (`Welcome.astro`, `Topbar.astro`, `LibBadge.astro`) need explicit
   confirmation before Phase 6 runs. — Owner: user. Block: Phase 6 only.
3. ~~`/books` is not in `PROTECTED_ROUTES`.~~ **Withdrawn** — it is. The claim came from the
   roadmap's stale Baseline paragraph rather than from `middleware.ts`. There is no routing
   gap.
4. **Does `/dashboard` survive?** With `/` becoming the signed-in dashboard, `/dashboard` is a
   second dashboard. The plan proposes redirecting it to `/`; an account screen, if one is
   ever wanted, should be `/account`. — Owner: user. Block: Phase 6 only.

## Mockup Log

`context/changes/app-shell-and-design-system/mockup.html` — a standalone, dependency-free
render of `/books/[id]` used to settle decisions before any Astro template is touched. Three
accent candidates, a width toggle (390 px / full), and a light/dark ramp toggle. Published to
an artifact for phone testing.

Corrections it caught, each already folded into the plan above:

1. **The accent rendered nowhere on a phone.** Budgeted onto the rail marker, links, hover and
   focus — all desktop-only or state-only. The three candidates were indistinguishable at
   390 px. Fixed by giving relationship types the accent: always visible, and semantically the
   right target (the type is the system's vocabulary, not the reader's).
2. **The edit disclosure was ~460 px tall on a phone.** 44 px controls, labels stacked above,
   three uppercase sub-headings including a "Danger zone". Replaced by the inspector shape:
   labels in a 3.6 rem left column, both selects on one row with their button, save and delete
   sharing the last row. Roughly 180 px.
3. **Inspector inputs were too tall and their type too large.** 16 px inside a 13 px UI. Split
   by pointer type — the 16 px floor exists only to stop iOS zooming, which is a touch concern.
   Selects additionally need `appearance: none` or the native chrome overrides the height.

4. **Inspector fields read as heavy boxes.** The border could not simply be lightened —
   `--rule-strong` is already at the WCAG 1.4.11 floor. Fixed by removing three of the four
   edges: underline fields inside the disclosure, boxes kept on capture controls.

### Settled on the mockup

- **Accent on relationship types: accepted** (user, 2026-09-10). Explicitly tested at four
  connections on one row — reads as structure, not clutter. A long connection list is fine.
- **Cast row density, the hairline list, the two-pane shell, the inspector shape: accepted.**
- **Underline inspector fields: accepted** (user, 2026-09-10), compared against boxed on the
  same content. Boxed is dropped; the toggle stays in the mockup only.

- **Accent: spruce `oklch(43% 0.115 168)`** — chosen 2026-09-10, then **superseded the same
  day**; see below.

### The broadsheet turn — `mockup-broadsheet.html`

After the near-white system was accepted, the user supplied a letterpress broadsheet poster as
a reference and asked to follow that track. A second mockup was built showing both surfaces,
because the aesthetic behaves completely differently on each: the landing page can take it at
full strength, and the app can take only the vocabulary. **The user accepted both** (2026-09-10),
so the whole product moves.

What changed from the accepted near-white system:

| | Was | Now |
| --- | --- | --- |
| Paper | `oklch(98.5% 0.004 85)` near-white | `oklch(93% 0.014 84)` cream |
| Accent | spruce `oklch(43% 0.115 168)` | brick `oklch(43% 0.15 30)` |
| Families | Newsreader + IBM Plex Sans | Anton (`/` only) + Newsreader + IBM Plex Mono |
| Labels | small-caps sans | mono uppercase, tracked 0.14em |
| Radius | 3 / 5 / 8 px | `0` everywhere |
| Rules | one hairline weight | three weights: 1 / 2 / 3 px |
| Genre | modern-minimal app + editorial landing | editorial, one voice |
| Destructive | its own `--danger` hue | the accent red + word + outline |

What did **not** change, because it was already settled and the reference did not argue with
it: the N3 side-rail, the two-pane shape, hairline rows instead of cards, the inspector
disclosure, underline fields, pointer-conditional input sizing, and the accent riding the
relationship types.

**The honest cost, recorded so nobody rediscovers it as a bug:** cream at L 93 % is 5.5 points
darker than the near-white ground, which is a real move away from "bright" — and the reader's
stated liking for Claude Desktop was partly *because* it is bright. Body notes are also now a
serif at ~0.9 rem in a dense list, which is more work to read than a UI sans. Both were shown
side by side on a phone before acceptance. Neither is free.

### Still open

Nothing blocking. Phase 1 can start as soon as S-04 is committed.

**Watch for during Phase 3–4:** whether cream plus serif body plus mono labels stays legible in
a long cast on a phone in poor light. That combination was judged on a seven-row example, not
on a real reading session.
