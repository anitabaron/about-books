# Open before archiving `app-shell-and-design-system`

Written 2026-09-11. This change stays `implementing` until everything in
**§1 Verification** is ticked — archiving it before then would put an unverified
change into an immutable archive, which makes the archive lie.

§2 and §3 are housekeeping that happens to be due at the same moment; they do not
block the archive, but doing them in the same pass is cheaper than remembering
twice.

---

## 1. Verification — blocks the archive

These are plan.md criteria **6.15, 7.10 and 7.12**. None of them ran.

The reason is recorded so nobody assumes they were skipped out of haste:
`resize_window` reports success in this environment and the viewport does not
change. Everything narrow was measured by forcing the mobile branch in the DOM
and constraining the column to 390px, which gives honest **heights** but does
**not** exercise width-based media queries (`max-width: 40rem`) or pointer-based
ones. So the layout below 60rem has been reasoned about, not seen.

Run these against `npm run dev -- --host` on a real phone.

- [x] **6.15 / 7.8 — the four widths.** _Confirmed on a device, 2026-09-11._ 320 / 375 / 414 / 768 px. Looking for:
      no horizontal scroll anywhere; no clickable text wrapping to two lines
      (buttons, the filter strip, breadcrumbs, `Mark finished`); nothing narrower
      than its content.
- [x] **7.10 — contrast.** _Judged acceptable on a device, 2026-09-11 — not an instrument reading._ Every ratio in plan.md § Colour
      was calculated, and the cream ground is 5.5 points darker than the values
      were first derived against. Check `--ink` ≥ 7:1 and `--ink-2`, `--muted-fg`,
      `--accent` ≥ 4.5:1; `--rule-strong` and `--focus` ≥ 3:1. `--faint` should
      measure **below** 4.5:1 and must appear on no text.
- [x] **7.12 — keyboard traversal.** _Confirmed, 2026-09-11._ Focus always visible, never trapped, order
      matching the visual order. Two places to look hardest: the nested
      `<details>` confirmations, and the rows where controls reach their form via
      `form=` rather than by containment.
- [x] **Thumb test on the tightened controls.** _Confirmed comfortable, 2026-09-11._ Fields are 26px, buttons 32px,
      destructive openers 32px — all below the 44px this change started with.
      WCAG 2.2 AA asks 24px so it passes, but passing and comfortable are not the
      same thing. If any of it is fiddly, the heights are one line each in
      `src/styles/forms.css` and `src/components/ui/button.tsx`.
- [x] **The iOS zoom trade-off.** _Accepted as-is, 2026-09-11._ Fields are 0.9rem at every pointer type, taken
      deliberately at the reader's request. Below 16px, iOS Safari zooms the
      viewport on focus — and "no zooming" is an S-02 acceptance criterion. Tap a
      field on an iPhone and decide which cost is worse. The reversal is one line,
      commented in `forms.css`. **Do not** reach for `maximum-scale=1`: it kills
      pinch-zoom and fails WCAG 1.4.4.
- [ ] **Dark mode is tokens-only, by decision.** Both ramps are computed and
      coherent; nothing switches them and no screen was checked in dark. Returns
      as its own change — not part of this one.

## 2. Do in the same pass as the archive

- [x] **`change.md` test-data note** — corrected in place, 2026-09-11. Was stale: It says book _Dune_ with
      Paul/Chani/Duncan and readers `ra@t.test` / `rb@t.test` / `probe-123456`.
      `supabase/seed.sql` replaced all of that: the fixture is _Solaris_ with
      Kris Kelvin / Harey / Snaut, and the readers are
      `reader-a@local.test` / `reader-b@local.test`, password `local-dev-password`.
      Anyone following the old note hits "Invalid login credentials" and goes
      looking for a bug in auth.
- [x] **Unpushed commits** — all pushed, `origin/main` at `cadaae1`, 2026-09-11.
      A warning for anyone reading a count like the one that used to be here: it was
      taken from a local `origin/main` ref without a `fetch`, and was wrong twice in
      this work — once claiming eight when the answer was zero. Fetch first.

## 2b. Known cosmetic, not chased further

- [ ] **The book-edit panel is 26px narrower than the page** (317px inside a 343px
      row at 390px). Its `<details>` is dissolved with `display: contents` while
      open so the pencil can hold its grid cell, and the panel is placed at
      `grid-column: 1 / 3` on row 2 — but it still lays out inside column 1 only.
      Tried and did not fix it: `1 / -1`, `justify-self: stretch`, `width: 100%`.
      The fields inside come out 247px, which is usable, and the panel opens once
      or twice in a book's life. Worth ten minutes with devtools, not more.

## 3. Housekeeping — nobody's job yet, so it is nobody's

- [x] ~~`.claude/worktrees/reading-room-ui`~~ — removed 2026-09-11 with its
      branch, after confirming `main..worktree-reading-room-ui` was empty and the
      tree had nothing uncommitted.
- [ ] **`.claude/worktrees/s04-collection-filter`** belongs to another session.
      Leave it alone unless its owner says otherwise.
- [x] ~~Dev server~~ — stopped 2026-09-11. Restart with `npm run dev -- --host`
      for the §1 pass.
- [ ] **`context/changes/bootstrap-verification/`** is not a change. It holds one
      `verification.md` from the 2026-06-30 bootstrap and will never be archived
      by `/10x-archive`. Move it or delete it; it should not sit among active
      changes.
- [x] **`book-edit-and-delete`** — implemented and archived by another session,
      2026-09-11.

---

## What the gates did not catch

Worth carrying into the next change. Four defects surfaced in this work, and
**lint, types, tests and build were green through every one of them**:

1. Duplicate `id`s from `form=` wiring — a relationship renders under both of its
   characters, so keying on the connection alone put the same id in the document
   twice, and the browser then associated both rows' controls with the first
   form. Saving from one character would have rewritten the other end.
2. `rel-type-${connection.id}` had the same collision, and **predated** this
   change: `<label for>` resolves to the first match, so a label under one
   character focused the control under another.
3. Moving the vocabulary field into `.rel-controls` dropped it out of the
   selector list (`.field input, .field select, .rel select` — no `.rel input`),
   so it silently lost its underline, its height and its font-size.
4. The rail wordmark rendered 16px out of register because its offset clones are
   positioned against a box that `padding-inline` had moved the text away from.

The check that caught all four is the same one each time: open the page, read the
DOM, and measure — duplicate ids, unresolved `label[for]`, nested `<form>`s, and
`FormData(form)` per form to confirm each carries its own fields.
