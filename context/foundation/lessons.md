# Lessons

Recurring rules and pitfalls, learned the hard way on this project. Read before planning or
implementing; each entry exists because something got through every check we had.

## A toolchain version pin is only tested by the environment that reads it

**Rule.** A pinned toolchain version (`.nvmrc`, `.node-version`, `engines`, `.tool-versions`)
is exercised only by whatever actually reads it. Your shell usually does not — it runs
whatever is installed. CI may use a different mechanism. So a wrong pin stays invisible until
the one environment that honours it tries to build, which is typically the deploy runner:
the furthest place from where you can see it.

**What happened.** `.nvmrc` pinned `22.14.0`, while Vite needed `module.registerHooks`, added
in Node `22.15.0`. Nothing caught it:

- local `npm run build` passed — the workstation was on Node 24, ignoring the pin;
- GitHub Actions CI passed on every commit;
- `npm run lint` and `npx astro check` never look at the runtime version;
- the first production deploy had gone out via `wrangler deploy` from a workstation, which
  also ignores `.nvmrc` — so the pipeline that reads it had never actually run.

It surfaced on the first Cloudflare Git-integration build, and it surfaced _silently_: from
the repository's point of view everything was green, while the deployed app was simply an
older build. The signal was `/books` returning 404 in production after a commit that added
`/books`.

**How to apply.**

- When a dependency upgrade changes build behaviour, check whether it raised the minimum
  runtime, and move the pin with it. The dependency's own `engines` field is the cheapest
  place to look.
- Treat "local build passes" and "CI passes" as weak evidence about the deploy runner. The
  only real evidence is a build that ran through the actual pipeline.
- **Verify a deploy by requesting a route that only the new code can serve** — a 404 on a
  newly added route is the tell. Checking that the site "still loads" proves nothing, because
  the previous build serves the old routes perfectly well.

## A top-level `return` in Astro frontmatter crashes the linter, not the compiler

**Rule.** Do not use an early `return` at the top level of an `.astro` frontmatter block to
short-circuit a page. It compiles and behaves correctly, but it breaks
`@typescript-eslint/no-misused-promises`.

**This is a tool crash, not a lint finding.** Exit 2 with
`Non-null Assertion Failed: Expected node to have a parent` means the rule could not walk the
AST — nothing is wrong with your code's logic, and no amount of reading the diff will show it.
The cause is the top-level `return`; the fix is `Astro.response.status`. Exit 1 is a finding
about your code; exit 2 is the tooling failing, and the message names the rule that broke
rather than the defect.

Set the status and render instead:

```astro
---
const { data: book } = await supabase.from("books").select("*").eq("id", id).single();
if (!book) Astro.response.status = 404; // not: if (!book) return new Response(null, {status: 404});
---
```

**What happened.** S-02's `/books/[id]` page needed a 404 for a book the reader does not own.
The obvious early return produced a real 404 and an ESLint run that exited 2 with the message
above, pointing at the `return` line. Moving the return moved the crash with it, which is what
identified the cause: the construct, not the surrounding code. `Astro.response.status = 404`
plus a conditional template gives the same HTTP response with no suppression comment, so the
rule stays on for the cases it is meant to catch.

This entry originally described the symptom as a lint _finding_ — "Expected non-Promise value
in a boolean conditional" — which was inferred from how the rule usually behaves rather than
from the run. Corrected against the measured output. The symptom is the only thing anyone will
search for, so getting it wrong made the entry useless at the moment it was needed.

**How to apply.** Every dynamic route hits this the first time it needs a not-found branch.
Reach for `Astro.response.status` before reaching for `eslint-disable`. A suppression here
would disable a rule that catches genuine floating-promise bugs elsewhere in the same file.

## A scripted edit reports that it ran, not that it did the right thing

**Rule.** After editing a file with a script — regex, byte offsets, `sed` — look at the
resulting text, not just the exit code and the changed-line count. For structured files, check
the structure: the heading list for markdown, the policy list for a migration, the key order
for JSON.

**What happened.** A regex edit to `roadmap.md` used offsets computed against a stale copy of
the string and corrupted a section heading. `git diff --stat` showed a plausible number of
changed lines, so it passed review and survived two commits. Nobody had reason to open
`## Slices` until the next slice needed it.

**How to apply.** The failure mode is shared with the version-pin lesson above: **a tool
confirming that it did something is not evidence that it did the intended thing.** One command
after the edit is usually enough — `grep '^#' file.md`, `grep 'create policy' migration.sql`.

## A probe must be able to fail for the reason you are testing

**Rule.** `curl` without `-X` sends GET when there is no body, and a POST-only Astro route
answers 404 to a GET — indistinguishable from a route that does not exist. Probe route
matching with a nonexistent UUID; never with a real id on a destructive route.

**What happened.** A shell helper defined as `curl … "$@"` relied on `--data-*` to imply the
method. The delete calls carry no body, so three requests went out as GETs and came back 404.
The 404s were read as a broken route manifest and diagnosed as such; the manifest was fine.
The same helper, in the same run, also issued real POSTs to destructive endpoints used as
existence probes, which deleted seed rows — a character, and a connection that a later
assertion depended on.

**Why the rule did not save it.** `test-plan.md` §6.5 already carries this exact rule — "pick
a probe that can actually distinguish present from absent — a `GET` on a POST-only route
answers 404 either way" — committed about an hour before it was walked into. Nobody opens a
TBD stub in a cookbook before writing a shell helper. That is why the rule belongs here:
`CLAUDE.md` loads this file every session.

**How to apply.**

- Put `-X POST` in the helper itself, not in the calls that happen to have a body.
- Probe existence with input that cannot destroy anything — a nonexistent UUID on a route
  whose handler answers "not found" with a redirect tells you the route matched.
- The wider class: a shortcut looks cheap because you are looking at what the command is
  meant to check, not at what it does on the way there. The `GIT_INDEX_FILE` workaround
  earlier in this project was the same shape — it silently reverted a manifest and two
  documentation files.

## Restart the dev server before debugging CSS that is already correct

- **Context**: any `.astro` component with a scoped `<style>` block, while iterating against `npm run dev`
- **Problem**: an edit to a scoped `<style>` can stop reaching the browser while markup from the same file keeps hot-reloading — the rule sits in the file and the browser computes the old value (`display: block` where the file says `flex`; `--muted-fg` where it says `--accent`). Hit three times in one session; twice it cost a rewritten selector that never needed changing.
- **Rule**: when a scoped `<style>` change does not appear after a hard reload, restart the dev server before touching the CSS. Confirm which state you are looking at with `getComputedStyle`, not with the rendering — "it looks unchanged" is not evidence that the code is wrong.
- **Applies to**: implement, impl-review

## An assertion that can fail is not yet an assertion that fails on THIS bug

**Rule.** When a test guards a threshold — clearance, spacing, timing, a size — assert the
value the design actually calls for, not the boundary at which the thing breaks outright.
`> 0` is not a spacing rule; `>= the gap we designed` is. Then mutate the code back to the
defect and watch the test fail. A test that survives that mutation measures nothing, however
precisely its name describes the bug.

**What happened.** The cast map drew relationship labels along the line between two
characters, sized from the number of characters and not from the length of the words, so a
long reader-defined type ran over the dots at both ends. Anita reported it twice — once for
the person view, once for the circle view.

The person-view fix came with a test asserting the label stays clear of both ends. It caught
the regression, so the same shape was reused for the circle view. It passed — and it also
passed with the fix reverted. The circle's geometry leaves **7.76 px** of clearance at the
defect: enough to satisfy "greater than zero", and visibly a label touching a dot. The
assertion could fail, just not on the thing it was written for. Tightening it to the designed
14 px made the mutation fail, reporting exactly 7.76.

The near-miss is the point: the test was written, named after the bug, run, and green, and it
would have shipped as evidence that the circle view was fixed.

**How to apply.**

- Run the mutation before believing the test, not after the review asks. It is one edit and
  one `npm test`.
- Prefer the constant the code uses over a literal in the test — importing `CHORD_GAP` keeps
  the assertion in step with the design instead of encoding a number that slowly stops being
  true.
- This is the sibling of "a probe must be able to fail for the reason you are testing" above.
  That entry is about sending the wrong request; this one is about asking the right question
  with the bar set too low. Both pass, both prove nothing, and both look like coverage.
