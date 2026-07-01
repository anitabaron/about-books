---
project: about-books
researched_at: 2026-07-01
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript / TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare v13+
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project already runs on this platform — `wrangler.jsonc` targets Workers, `@astrojs/cloudflare` v13 is installed, and `nodejs_compat` is set. Zero migration cost. The free tier covers 100,000 requests/day (≈3M/month), which is well beyond any MVP traffic. Cloudflare scored 5/5 on every agent-friendly criterion: `wrangler` CLI handles deploy, rollback, and log-tailing in one command each; docs are available as `llms.txt` and per-page markdown; and 16 official GA MCP servers cover the full operational loop. The user has existing Cloudflare familiarity, reinforcing the recommendation.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP / Integration | **Total** |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **5/5** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial (beta MCP, 8mo stale) | **4.5/5** |
| **Netlify** | Partial (rollback = UI only) | Pass | Pass | Partial (rollback = dashboard) | Pass | **4/5** |
| **Render** | Pass | Pass | Pass | Partial (scaling/delete = dashboard) | Partial (MCP can't trigger deploys) | **4/5** |
| **Fly.io** | Pass | Partial (VMs + Dockerfile required) | Pass | Partial (rollback = manual image tag) | Partial (4-commit experimental MCP) | **3.5/5** |

*Railway was excluded from scoring (timed out during research).*

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already in use — no adapter migration, no config changes. Free tier covers the full MVP workload. `wrangler deploy` / `wrangler rollback` / `wrangler tail` are single commands with structured output. Cloudflare publishes `llms.txt`, per-page markdown, and 16 GA MCP servers covering deploy, observability, and the full API surface. Cold starts are sub-10ms (V8 isolate reuse). The only operational risk is the 10ms CPU limit on the free tier — manageable by staying below CPU-heavy SSR patterns or upgrading to the $5/month paid plan.

#### 2. Netlify

Strong second option. Free tier handles 100k+ monthly requests within 300 credits. The official GA MCP server covers deploys, env vars, and extensions. `netlify logs --follow` streams live. Primary weakness: rollback requires the dashboard (no CLI command). Cold starts are 800ms–1.5s vs. Cloudflare's ~10ms — a meaningful difference for a mobile-first app where the first byte matters. Switching requires swapping `@astrojs/cloudflare` for `@astrojs/netlify` (~2 hours).

#### 3. Render

Good CLI + MCP combination, and auto-detects Astro Node SSR without a Dockerfile. However: the free tier spins down after 15 minutes of inactivity (~60s cold start on first request), which is unusable for a real user-facing MVP. Paid tier minimum is ~$26/month (Starter service $7 + Professional workspace $19/user). Eliminated primarily by cost at the paid tier required to avoid cold starts.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **CPU time ceiling on free tier (10ms/invocation)** — an SSR page doing two Supabase round-trips plus React component rendering can exceed 10ms CPU. This causes a 1102 error in production that does not surface in local development (Node.js, no CPU limit). The paid plan raises the ceiling to 30ms; Standard pricing removes it entirely.

2. **No persistent filesystem** — `node:fs` reads work for bundled files but writes don't persist across requests or isolates. Any future feature assuming a writable disk (e.g., caching processed images) will fail silently and be hard to debug.

3. **workerd ≠ Node.js in edge cases** — even with `nodejs_compat`, packages using `child_process`, `cluster`, or native addons fail at runtime. Any LLM client library (for FR-006, AI enrich) must be verified to run in the Workers runtime before building on it.

4. **Vendor lock-in via runtime APIs** — `import { env } from 'cloudflare:workers'` and any Durable Object usage creates Cloudflare-specific code paths. Migrating away later is non-trivial.

5. **wrangler dev vs. deployed behavior** — `wrangler dev` now uses the real workerd runtime (major improvement), but edge cases around compatibility dates and module resolution still occasionally diverge. A bug that only appears after `wrangler deploy` is hard to reproduce and fix under a tight deadline.

### Pre-Mortem — How This Could Fail

The team ships about-books on the Cloudflare Workers free tier. In week 2, they wire up the AI enrich feature (FR-006) using the Anthropic SDK. The SDK works locally on Node.js. On first deploy, the endpoint returns 1102 CPU exceeded errors — the Anthropic API call itself consumes 15ms of CPU time before the response arrives. The team upgrades to the paid plan ($5/month) for 30ms CPU time. This solves AI enrich, but the relationship diagram endpoint (FR-007) then starts hitting the CPU limit on books with 20+ characters — the graph layout computation runs during SSR. Two weeks into the four-week deadline, the team is debugging runtime-only CPU errors that don't reproduce locally, refactoring hot paths, and reconsidering whether the diagram should be fully client-side. The deadline slips because the platform's CPU model was never stress-tested against the real SSR workload.

### Unknown Unknowns

1. **AI SDK compatibility in workerd** — the Anthropic JS SDK makes HTTP calls (supported), but internal retry/timeout logic may use `setTimeout` or `AbortController` patterns that behave differently under the 30-second wall-clock limit. Verify SDK compatibility in a Workers context before building FR-006.

2. **Supabase auth cookie handling** — `@supabase/ssr` with `@astrojs/cloudflare` uses cookie-based sessions. The `nodejs_compat` flag is required for cookie parsing. The `compatibility_date` in `wrangler.jsonc` must be ≥ 2024-09-23 for the flag to work fully; an older date causes silent auth failures in production.

3. **Prerendering now runs in workerd** — Astro 6 prerendering runs in workerd (not Node.js). Any page with `prerender = true` that imports a Node.js-only dependency will throw at build time. Set `prerenderEnvironment: 'node'` in adapter config if needed.

4. **Worker name in wrangler.jsonc is wrong** — the current `wrangler.jsonc` has `"name": "10x-astro-starter"` (scaffold default). This becomes the Worker's name in the Cloudflare dashboard and in rollback history. Rename to `about-books` before first deploy; renaming after first deploy creates a new Worker rather than updating the existing one.

5. **`workers.dev` subdomain is public immediately** — the default `about-books.workers.dev` URL is publicly accessible as soon as you deploy, with no auth gate. If you deploy before auth middleware is wired, all data endpoints are open.

## Operational Story

- **Preview deploys**: Cloudflare does not create automatic PR preview URLs like Vercel/Netlify. Preview environments must be set up manually via `wrangler deploy --env staging`. For MVP, a single production Worker is sufficient — preview is handled by `wrangler dev` locally.
- **Secrets**: env vars and secrets live in Cloudflare Workers settings (dashboard) or via `wrangler secret put <KEY>`. For local dev, secrets go in `.dev.vars` (gitignored). Secrets are scoped to the Worker and not readable after write — only overwritable. Rotation: `wrangler secret put` with the new value; takes effect on next deploy.
- **Rollback**: `wrangler rollback` (no version ID = previous deployment; with version ID = specific version). Takes effect immediately across all routes. Data note: database migrations (Supabase) do not roll back automatically — rollback is code-only.
- **Approval**: deploy to production (`wrangler deploy`) requires human execution. An agent may run `wrangler dev`, `wrangler tail`, and `wrangler rollback` unattended. `wrangler secret put` (rotating a primary secret) and any `wrangler d1` destructive commands require human approval. Do not grant agents write access to Cloudflare API tokens.
- **Logs**: `wrangler tail [worker-name]` — live stream of console output and exceptions. Flags: `--format json`, `--status error`, `--search "keyword"`. Also available via the Cloudflare Observability MCP server at `https://observability.mcp.cloudflare.com/mcp`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CPU exceeded (1102) on AI enrich or diagram SSR | Devil's advocate | M | H | Benchmark FR-006 (Anthropic SDK) and FR-007 (graph render) in workerd early. Move diagram render fully client-side (React island) if CPU budget is tight. Upgrade to $5/month paid plan if needed. |
| AI SDK incompatibility in workerd | Unknown unknowns | M | H | Test Anthropic JS SDK in a minimal Worker before building FR-006. Check `cloudflare:workers` fetch vs SDK's internal fetch wrapper. |
| Supabase auth cookie failures due to compatibility_date | Unknown unknowns | L | H | Verify `compatibility_date` ≥ 2024-09-23 in `wrangler.jsonc` before first deploy. |
| Worker deployed under wrong name (10x-astro-starter) | Unknown unknowns | H | M | Rename `"name"` in `wrangler.jsonc` to `about-books` immediately — before any `wrangler deploy`. |
| Public `workers.dev` URL before auth is wired | Unknown unknowns | M | M | Do not deploy to production until `src/middleware.ts` auth guard covers all data routes. Or: set a Cloudflare Access policy on the subdomain during development. |
| workerd/Node.js divergence causing deploy-only bugs | Devil's advocate | L | M | Run `wrangler dev` (workerd mode) locally, not just `npm run dev`. Catch divergence before deploy. |
| No vendor-independent rollback path | Pre-mortem | L | M | Keep auth and Supabase connection logic in framework-agnostic files (`src/lib/`). Avoid deep Cloudflare runtime API usage outside adapter config. |

## Getting Started

1. **Fix the Worker name** — update `wrangler.jsonc`: change `"name": "10x-astro-starter"` to `"name": "about-books"` before the first deploy.

2. **Authenticate wrangler** — run `npx wrangler login` (opens browser OAuth to your Cloudflare account). One-time per machine.

3. **Set production secrets** — after login, push Supabase credentials:
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```

4. **Deploy** — from the project root:
   ```bash
   npm run build
   npx wrangler deploy
   ```
   Output includes the deployed URL (e.g., `https://about-books.workers.dev`).

5. **Tail logs in production**:
   ```bash
   npx wrangler tail about-books --format pretty
   ```

6. **Rollback if needed**:
   ```bash
   npx wrangler rollback          # revert to previous deployment
   npx wrangler deployments list  # find a specific version ID
   npx wrangler rollback <VERSION_ID>
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wrangler deploy workflow)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare D1 / KV / R2 configuration (Supabase is the data layer)
