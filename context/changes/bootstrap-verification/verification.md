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
**Summary**: 0 CRITICAL, 6 HIGH, 10 MODERATE, 2 LOW
**Direct vs transitive**: direct HIGH: `astro` (2 advisories); remaining 4 HIGH are transitive

#### HIGH findings

- **astro** (<6.3.3) — Reflected XSS via unescaped slot name (GHSA-8hv8-536x-4wqp, CVSS 7.1). Fix: upgrade astro to >=6.3.3. Direct dependency.
- **astro** (<6.4.6) — Host header SSRF in prerendered error page fetch (GHSA-2pvr-wf23-7pc7, CVSS 7.5). Fix: upgrade astro to >=6.4.6. Direct dependency.
- **devalue** (5.6.3–5.8.0) — DoS via sparse array deserialization (GHSA-77vg-94rm-hx3p, CVSS 7.5). Transitive (via astro). Fix available.
- **ws** (8.0.0–8.20.1) — Memory exhaustion DoS from tiny fragments (GHSA-96hv-2xvq-fx4p, CVSS 7.5). Transitive (via wrangler/miniflare and @supabase/realtime-js). Fix available.
- **vite** (7.0.0–7.3.3) — server.fs.deny bypass on Windows alternate paths (GHSA-fx2h-pf6j-xcff). Transitive (via astro). Fix available.
- **miniflare / @cloudflare/vite-plugin** — HIGH finding in truncated audit output. Transitive. Fix available.

#### MODERATE findings

- @astrojs/check, @astrojs/language-server, @cloudflare/vite-plugin, astro (XSS via unescaped attribute names in spread props CVSS 4.2), wrangler, ws (uninitialized memory disclosure CVSS 4.4), volar-service-yaml, yaml, yaml-language-server (10 total). All transitive or dev dependencies. Fix available for most.

#### LOW findings

- @babel/core (arbitrary file read via sourceMappingURL CVSS 3.2), esbuild (arbitrary file read CVSS 2.8). Both transitive. Fix available.

**Recommended action**: `npm audit fix` resolves most findings without breaking changes. The `astro` direct dependency is the root cause of several HIGH/MODERATE chains — upgrading it likely resolves the majority. Run `npm audit fix` after reviewing, then re-audit.

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
