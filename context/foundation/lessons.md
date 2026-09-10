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

It surfaced on the first Cloudflare Git-integration build, and it surfaced *silently*: from
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
