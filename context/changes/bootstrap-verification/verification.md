---
bootstrapped_at: 2026-06-30T15:24:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: about-books
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: about-books
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

about-books is a mobile-first web app for a solo builder with a 4-week after-hours deadline. The 10x Astro Starter (Astro 6 + React 19 + Supabase + Cloudflare Pages) ships auth, a PostgreSQL-backed database, TypeScript throughout, and edge deployment out of the box — eliminating the three highest-risk setup tasks (auth plumbing, database schema, deploy pipeline) before the first line of domain code. Supabase Row-Level Security enforces the PRD's strict per-user data isolation without custom middleware. Cloudflare Pages handles mobile-first delivery with low-latency edge routing. The AI character hints feature (FR-006) connects to any LLM API from Astro server routes or a Cloudflare Worker — no additional backend service required. The relationship diagram (FR-007) runs client-side in a React island, keeping the rest of the app zero-JS by default. All four agent-friendly gates pass: fully typed (TypeScript + Zod at boundaries), convention-based (Astro file routing), popular in training data, and well-documented.

## Pre-scaffold verification

| Signal      | Value                                          | Severity | Notes                                       |
| ----------- | ---------------------------------------------- | -------- | ------------------------------------------- |
| npm package | not run                                        | —        | cmd_template uses git clone; no npm package |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh | from card.docs_url via GitHub API          |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (cloned starter repo without keeping its git history)
**Exit code**: 0
**Files moved**: ~20 (src/, public/, supabase/, node_modules/, package.json, package-lock.json, astro.config.mjs, components.json, tsconfig.json, wrangler.jsonc, eslint.config.js, README.md, .gitignore, .env.example, .github/, .husky/, .nvmrc, .prettierrc.json, .vscode/)
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold (CLAUDE.MD already existed in cwd)
**.gitignore handling**: moved silently (no prior .gitignore in cwd before scaffold)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary (post `npm audit fix`, 2026-07-01)**: 0 CRITICAL, 0 HIGH, 5 MODERATE, 3 LOW
**Direct vs transitive**: no direct HIGH or CRITICAL; all remaining are dev tooling

#### MODERATE findings

- **@astrojs/check** (direct) — via @astrojs/language-server → volar-service-yaml → yaml. Dev tooling (language server). Fix requires `--force` (breaking change to @astrojs/check@0.9.2).
- **@astrojs/language-server** (transitive) — via volar-service-yaml → yaml. Dev tooling.
- **volar-service-yaml** (transitive) — via yaml. Dev tooling.
- **yaml** (transitive, in yaml-language-server) — Stack overflow via deeply nested YAML collections (GHSA-48c2-rrv3-qjmp). Dev tooling only; not in app code path.
- **yaml-language-server** (transitive) — Dev tooling.

#### LOW findings

- **@astrojs/cloudflare** (direct) — transitive esbuild dependency. Dev/build tooling only.
- **astro** (direct) — residual low via esbuild chain. Fix requires `--force` (Astro v7 breaking change).
- **esbuild** (transitive) — arbitrary file read on Windows dev server (GHSA-g7r4-m6w7-qqqr). Dev-only; does not affect production build or deployed app.

**Status**: `npm audit fix` run on 2026-07-01. All HIGH and CRITICAL cleared. Remaining 8 findings are exclusively in dev tooling (language server, esbuild). Fixing them requires `--force` which would pull in Astro v7 (breaking change) — deferred until Astro v7 is stable and the starter is updated.

## Hints recorded but not acted on

| Hint                    | Value             |
| ----------------------- | ----------------- |
| bootstrapper_confidence | first-class       |
| quality_override        | false             |
| path_taken              | standard          |
| self_check_answers      | null              |
| team_size               | solo              |
| deployment_target       | cloudflare-pages  |
| ci_provider             | github-actions    |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true              |
| has_payments            | false             |
| has_realtime            | false             |
| has_ai                  | true              |
| has_background_jobs     | false             |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` — this is what the starter ships; your existing `CLAUDE.MD` was preserved. Decide which to keep.
- Run `npm audit fix` to address the HIGH findings (mostly an `astro` upgrade chain). Re-audit after.
- Address remaining audit findings per your project's risk tolerance — the full breakdown is in this log.
