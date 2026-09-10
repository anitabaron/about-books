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

## A top-level `return` in Astro frontmatter trips the lint, not the compiler

**Rule.** Do not use an early `return` at the top level of an `.astro` frontmatter block to
short-circuit a page. It compiles and behaves correctly, but the frontmatter is analysed as an
async function body, so `@typescript-eslint/no-misused-promises` reports "Expected non-Promise
value in a boolean conditional" or similar — a confusing message that points nowhere near the
actual line of intent. Set the status and render instead:

```astro
---
const { data: book } = await supabase.from("books").select("*").eq("id", id).single();
if (!book) Astro.response.status = 404; // not: if (!book) return new Response(null, {status: 404});
---
```

**What happened.** S-02's `/books/[id]` page needed a 404 for a book the reader does not own.
The obvious early return produced a real 404 and a red lint. Working around it with
`Astro.response.status = 404` plus a conditional template gives the same HTTP response with no
suppression comment, so the rule stays on for the cases it is meant to catch.

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
