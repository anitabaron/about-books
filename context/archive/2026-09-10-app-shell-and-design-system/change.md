---
change_id: app-shell-and-design-system
title: Reading-room UI — token system, app shell, and every screen off the starter
status: archived
created: 2026-09-10
updated: 2026-09-11
archived_at: 2026-09-11T12:15:09Z
---

> **Archived shipped, not verified.** Closed on 2026-09-11 at the reader's
> decision, with plan criteria **6.15 / 7.8** (the 320 / 414 / 768 px sweep),
> **7.10** (contrast measured rather than computed) and **7.12** (keyboard
> traversal) never run. They were not skipped for haste: `resize_window` reports
> success in this environment without changing the viewport, so everything
> narrow was measured by forcing the mobile branch in the DOM — honest heights,
> but no exercise of width- or pointer-based media queries.
>
> `todo.md` travels with this folder and still holds the full list, including two
> judgement calls left to a real device (whether 26px fields and 32px buttons are
> comfortable under a thumb, and whether iOS zoom-on-focus is the worse of the
> two costs) and one known cosmetic defect (§ 2b). Archived folders are read-only
> by convention, so anything acted on from that list belongs in a new change.

## Notes

**Not a roadmap slice.** The roadmap tracks PRD requirements; this change ships no new
capability and closes no FR. It is cross-cutting, like F-01 was: it establishes a contract
(the design system) that every later slice inherits instead of re-inventing. It belongs
between S-04 and S-05, and the roadmap needs no edit for it to run.

**The problem.** The app still wears the 10x Astro starter: `@utility bg-cosmic`
(`#0a0e1a → #0f1529`), blurred "cosmic orbs" and a star field in `Welcome.astro`,
`bg-white/10 backdrop-blur-xl` glass panels, `rounded-2xl` on every container, and headings
in `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent`. Four of
those are named AI tells (purple-gradient hero, gradient headline, floating-orb decoration,
glassmorphism). `Layout.astro` still titles untitled pages **"10x Astro Starter"** and ships
`<meta name="viewport" content="width=device-width">` with no `initial-scale`.

The starter's every colour token is `oklch(L 0 0)` — chroma exactly zero, pure `#fff`
background, pure-grey neutrals. It is not a neutral palette; it is an absent one.

**The direction, from the brief.** A reading companion, phone-first, dense and legible,
light but not glaring, neutral with restrained colour. Two named references: Claude Desktop's
sidebar (warm off-white, grouped and labelled, quiet) and macOS Finder (hairline-divided rows,
much information in little space). Both are _application_ surfaces, not marketing pages —
that is the register to hit.

**Decisions taken with the user before planning (2026-09-10):**

1. **UI language: English, everywhere.** Settles the question the roadmap left open at S-01.
   The Polish validation messages in `src/types.ts` and `src/lib/config-status.ts` get
   rewritten. See the S-05 consequence below.
2. **Scope: tokens + shell + every screen.** Including `/`, `/auth/*` and `/dashboard`.
3. **Theme route: custom.** The Hallmark catalog was inspected and rejected on evidence —
   see below.
4. **Dark mode: tokens now, switch later.** Both palettes are computed in this change so the
   ramp is coherent from the start; no toggle, no per-screen dark verification. Returns as
   its own cheap change.
5. **Visual direction: letterpress broadsheet** — decided in two steps, on two mockups.
   A near-white, quiet, Finder-like system was built and accepted first. The user then
   supplied a broadsheet poster as a reference and asked to follow that track; a second
   mockup showed the landing page at full poster strength and the book page with the same
   vocabulary metabolised down to app density, and **both were accepted**. Cream stock, one
   brick red, mono uppercase labels, three rule weights, zero radius, Anton on `/` only.
   The near-white system is recorded in `plan.md` § Mockup Log as the superseded state,
   because its reasoning still explains why several of the surviving decisions are what they
   are.

**Why custom and not a catalog theme.** `~/.claude/skills/hallmark/references/themes/` holds
five specs (`carnival`, `cobalt`, `grid`, `hum`, `lumen`) of the twenty-one named themes, and
the file carrying the other sixteen palettes (`site/css/tokens.css`) does not exist in this
installation. For sixteen of twenty-one there is a name and three axis labels, nothing more.
Separately, the brief's genre (dense application UI) routes to _modern-minimal_, whose
rotation cluster is exactly two themes — Coral and Cobalt — and Cobalt is a Space-Grotesk +
mono dev-tool register. The choice was not between rich options.

**Two consequences worth carrying into other work:**

- **S-05's Polish display map is now moot.** The roadmap parked reader-defined relationship
  types with the note that "because the five cannot be renamed, a Polish display map stops
  being optional — it is the only way 'ally' and 'antagonist' stop reading as fantasy-saga in
  domestic fiction." That argument assumed a Polish UI. With English chosen, the five read as
  themselves and the map is dead requirement. The rest of S-05 (custom types, the two-column
  shape, `on delete restrict`) is untouched. **S-05 planning should not inherit it.**
- **Update 2026-09-10 — the S-04 blocker is cleared, and S-05 went with it.** Both slices landed
  and were archived while this plan was being written; main moved 25 commits and +1505 lines.
  The branch is rebased onto `cd6eb2c` and the plan re-verified against it. Two findings worth
  carrying:

- **S-05 did not ship the Polish display map**, exactly as predicted below — and it went
  further: `src/types.ts` and every page are already English. Only `src/lib/config-status.ts`
  still holds Polish strings, so decision 1 is nearly already true and Phase 5 § 4 shrinks to
  one file.
- **S-04/S-05 made two interaction decisions this change must preserve:** the "Add a
  character" form is now a collapsed `<details>`, and every destructive action sits behind a
  nested `<details>` confirmation. The mockups predate both. Where they disagree, the shipped
  behaviour wins — this change owns the visual layer, not the interaction model.

**(Superseded, kept for the record.) S-04 is mid-flight and owns two of the four files this
change rewrites.**
`book-status-and-recall` is `status: implementing`; `src/pages/books/[id].astro` already
carries `finished_at`, the finish/reopen form and a date line, and `/books` is expected to
grow the active/finished filter. **This change must not start until S-04 is committed** —
otherwise both rewrite the same templates and one of them loses. Phase 3 additionally
_depends_ on S-04's filter existing, because the library screen groups by status.

**Inherited and settled, unchanged here:**

- **Astro trap:** no top-level `return` in frontmatter — `Astro.response.status`.
  `context/foundation/lessons.md`.
- **Verify scripted edits by structure, not exit code** — same file, third lesson. This change
  touches large templates with repeated class strings; a regex sweep over `bg-white/10` is
  exactly the shape that lesson warns about.
- Native POST + formData + Zod + `?error=` redirect. **No form is converted to an island.**
  Every disclosure, edit and delete on `/books/[id]` works with JavaScript disabled today and
  must still work after.
- No database change, no migration, no RLS work, no `db:types`. `npm run db:verify-rls` should
  pass untouched — if it does not, something outside this change's scope broke.
- Test data in the local stack: book _Dune_, characters Paul Atreides / Chani / Duncan Idaho,
  one relationship (Chani ↔ Duncan, family). Readers `ra@t.test` / `rb@t.test`, password
  `probe-123456`.

**Deadline context.** `hard_deadline: 2026-09-12` applies to M-1. This change is not part of
M-1 and must not be allowed to delay S-04 or S-05.
