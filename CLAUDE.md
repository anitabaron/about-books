# Rules for AI

This file provides guidance to AI Agent when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss).
  Note: this is `prettier --write .` across the whole repo, and 39 files are currently
  unformatted. Prefer `npx prettier --check <files you touched>` unless you intend a
  repo-wide reformat as its own commit.
- `npm run db:verify-rls` — assert per-user isolation on every RLS table (needs the local
  stack running). Extend `supabase/tests/rls_books.sql` whenever you add a table. Requires
  `psql` on PATH: it is **not** an npm dependency, so a fresh clone needs libpq installed
  separately (`brew install libpq` on macOS) even after `npm install`.
- `npm run db:types` — regenerate `src/db/database.types.ts` from the local schema

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

Runtime is Cloudflare Workers (not Node.js) — no `process`, no filesystem, no long-running timers. Full-stack: Astro 6 SSR + React 19 islands + Supabase + Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: validate all input with Zod before accessing `request.json()`. Use uppercase `GET`, `POST` named exports.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies. Copy the template below; `supabase/migrations/20260909155950_create_books_with_rls.sql` is the worked example.

  ```sql
  create table public.<table> (
    id uuid primary key default gen_random_uuid(),
    -- Ownership column. `default auth.uid()` means the client never sends an owner id,
    -- and the insert policy below means it could not forge one if it tried.
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  -- Every policy predicate filters on user_id, so index it.
  create index <table>_user_id_created_at_idx on public.<table> (user_id, created_at desc);

  -- public.set_updated_at() already exists -- the books migration created it. Attach the
  -- trigger, and do NOT re-create the function: `create or replace function
  -- public.set_updated_at()` would overwrite the shared one, including its pinned
  -- search_path. Omitting this trigger gives you an updated_at that is set on insert and
  -- never changes again -- a column that exists, looks right, and lies.
  create trigger <table>_set_updated_at
    before update on public.<table>
    for each row
    execute function public.set_updated_at();

  alter table public.<table> enable row level security;

  create policy "<table>_select_own" on public.<table>
    for select to authenticated using (auth.uid() = user_id);
  create policy "<table>_insert_own" on public.<table>
    for insert to authenticated with check (auth.uid() = user_id);
  create policy "<table>_update_own" on public.<table>
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "<table>_delete_own" on public.<table>
    for delete to authenticated using (auth.uid() = user_id);

  -- REQUIRED, not defensive. This project's default ACLs grant new public tables only
  -- Dxtm (truncate/references/trigger/maintain) -- no DML. Omit this line and the table
  -- is unreachable by the app no matter how correct the policies are.
  grant select, insert, update, delete on public.<table> to authenticated;
  revoke all on public.<table> from anon;
  ```

  Rules that go with the template:
  - **`anon` gets no policy and no grant.** Its denial is therefore structural: an
    unauthenticated request gets HTTP 401 / SQLSTATE 42501, not an empty set. Studio badges
    such a table "API DISABLED" — that is the intended state. Do **not** "fix" a 401 by
    granting `anon` SELECT; that trades a structural guarantee for a policy-dependent one.
    An authenticated user who lacks rows correctly gets `[]`, because they _do_ hold the grant
    and RLS does the filtering.
  - **`service_role` holds no DML on these tables** and nothing in `src/` uses it. If a script
    or job ever needs it, grant it explicitly — and remember a `service_role` key bypasses RLS
    entirely, so isolation silently disappears if `SUPABASE_KEY` is ever swapped for a secret key.
  - **Trigger functions must pin `search_path`.** Use `set search_path = ''` (see
    `public.set_updated_at()`); a mutable search_path is a hijack vector, flagged by Supabase's
    linter as `function_search_path_mutable`. Unqualified `now()` still resolves, because
    `pg_catalog` is always searched.
  - **Extend `supabase/tests/rls_books.sql`** with a block for each new table, and keep both
    directions: negative assertions (another reader cannot see, update, delete or forge) _and_
    positive ones (the owner can act on their own rows). Negatives alone pass happily when a
    policy is too narrow — `using (false)` breaks the app while every negative still holds.
  - **Run `npm run db:types`** after every migration so `src/db/database.types.ts` matches the
    schema. Hand-written types in `src/types.ts` describe user input (Zod commands) and may
    mirror a row shape; the generated file is the source of truth for row shapes.

- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.23.2 (see `.nvmrc`). Must be >= 22.15: Vite needs `module.registerHooks`, added in that release, and Cloudflare's build runner reads `.nvmrc` — a lower pin fails the remote build while local builds pass.
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to main. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 1

Open Module 3 by producing a **durable, risk-first quality contract** before any test is written — then drive each rollout phase through the standard change chain.

```
PRD + roadmap + archive
        │
        ▼
   /10x-test-plan  ──►  context/foundation/test-plan.md  (strategy §1–§5 frozen + cookbook §6 grows)
        │
        ▼  (one rollout phase at a time, /clear between handoffs)
   /10x-new ──► /10x-research ──► /10x-plan ──► /10x-implement
```

`/10x-test-plan` is a **stateful orchestrator**, not a one-shot generator. On first run it writes the phased rollout to `context/foundation/test-plan.md`. On every subsequent run it re-derives state from on-disk artifacts and presents the next handoff. The lesson focus is **strategy and rollout sequencing, not configuration**. Hooks, MCP servers, and CI YAML are configured in later lessons of this module.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Quality strategy as a rules-file (lesson focus)** | |
| `/10x-test-plan` | You have a PRD (and ideally a roadmap and a few archived slices) and you are about to write the project's first tests, or you noticed that AI-generated tests are landing on helpers while critical flows go uncovered. First invocation runs discovery (PRD + roadmap + archive + hot-spot scan), a 5-question user interview, and a synthesis pass with a mandatory challenger check, then writes `test-plan.md` in `context/foundation/` with a risk map (5–7 failure scenarios), a phased rollout table, a stack table, a quality-gates table, a cookbook section (`§6`, fills in as phases ship), and a negative-space section (what we deliberately don't test). Subsequent invocations advance the rollout one handoff at a time. |
| `/10x-test-plan --status` | A `test-plan.md` already exists and you want a compact snapshot of where the rollout stands — which phases are `not started`, `change opened`, `researched`, `planned`, `implementing`, or `complete`, and what the next action is. Does no work; safe to run any time. |
| `/10x-test-plan --refresh` | A `test-plan.md` already exists and one of: a new top-3 risk surfaced from the roadmap or archive, a tool's `checked:` date is older than three months, the project's tech stack changed, or §7 negative-space no longer matches what the team believes. Opens a new `test-plan-refresh-<YYYY-MM-DD>` change folder rather than editing the guide in place. |

### Rollout chain — what happens after the guide is written

The guide's §3 *Phased Rollout* table is the orchestrator's state. For each non-`complete` row the orchestrator selects the next handoff based on which artifacts exist in `context/changes/<change-id>/`:

| State on disk | Next handoff | Status transitions to |
| --- | --- | --- |
| change folder missing | `/10x-new <change-id>` | `change opened` |
| `change.md` only | `/10x-research` (with a risks-to-verify brief) | `researched` |
| `+ research.md` | `/10x-plan` (with cost × signal + cookbook-update constraints) | `planned` |
| `+ plan.md` with pending `## Progress` items | `/10x-implement <change-id> phase <N>` | `implementing` / `complete` |
| `+ plan.md` fully `[x]` | Mark §3 row `complete`; loop to next pending row | — |

Each handoff is a **STOP point**. The orchestrator copies the next command to the clipboard, asks the user to `/clear` and run it, then exits. Re-invoke `/10x-test-plan` (no arguments) to advance.

### Risk-first prioritization rules

- Risks are **failure scenarios in user / business terms**, not test names. "Logged-out user reaches paid content via stale token" is a risk; "test the login form" is not.
- 5 to 7 risks. Fewer is too coarse; more makes prioritization useless.
- Impact and likelihood are user/business ratings, not technical complexity.
- Every risk traces to a source: PRD section, archived slice, roadmap entry, Phase 2 interview question, hot-spot **directory** with churn count, or a tech-stack constraint. No invented risks.
- **Signal, not knowledge.** §2 cites *evidence that raised the risk*, never a file as "where the failure lives." File:line anchors, function names, schema names, and module names are forbidden in §2 — they belong in `/10x-research`'s output, produced per rollout phase against current code. The plan is a QA spec; it is not a code audit.
- Coverage is not the metric. **Risk coverage** is the metric.

### Dual-layer mapping rules

- Classic layer first: the cheapest test that gives a real signal wins. Promote to e2e only when no cheaper layer covers the risk.
- AI-native layer second, and only where it adds signal classic tests do not give cheaply.
- Every AI-native row has a **"When NOT to use"** line. If you cannot write one, drop the row.
- Every tool name carries a `checked: <YYYY-MM-DD>` date. Tool names are examples of the category, not endorsements.
- Both layers must be non-empty in the final guide if the project warrants them. Classic-only is a 2020 plan; AI-native-only is hype. AI-native phases are not mandatory — include them only when the brief justified them under cost × signal.

### Quality gates rules

- Required gates (lint, typecheck, unit+integration, e2e on critical flows) must map to actual CI steps. If a required gate is not yet wired, mark it as `required after §3 Phase <N>` and let the named rollout phase wire it.
- Post-edit hook is **recommended local**, not a CI substitute.
- Multimodal visual review is **selective**, applied to 1–3 critical screens, not to every page.
- Vision-driven fallback (Anthropic Computer Use or OpenAI CUA) is reserved for DOM-unreachable surfaces; expensive per action.

### Cookbook patterns (§6) — fills in over time

`test-plan.md` is both a phased strategy and a **growing cookbook**. §6 starts as placeholders (`TBD — see §3 Phase <N>`) and fills in incrementally — each rollout phase's plan ends with a sub-phase that updates the relevant §6 entry (location, naming, reference test, run command). After Module 3 completes, §6 becomes the canonical answer to "how do I add a test for X in this project?" — and is what `/10x-tdd` reads in Lesson 2.

### Lesson boundaries

- Do not write test code. That is Lesson 2 (`/10x-tdd` and unit-test authoring).
- Do not configure hooks, hook lifecycle, or debugging hooks. That is Lesson 3.
- Do not configure MCP servers, Playwright API, e2e code, or multimodal scenario code. That is Lesson 4.
- Do not run the bug-to-fix-to-regression-test workflow. That is Lesson 5.
- Do not author CI/CD pipelines from scratch or write GitHub Actions YAML. The guide names gates; configuration is owned by Module 1 Lesson 5 and Module 2 Lesson 5.
- Do not benchmark multimodal models. Cite criteria (cost, latency, agent-friendliness), never a ranking.
- Do not read the codebase for knowledge (call graphs, schemas, "which file owns this failure"). That is `/10x-research`'s job, per rollout phase.

### Paths used by this lesson

- `context/foundation/test-plan.md` — the quality contract produced and maintained by `/10x-test-plan`
- `context/foundation/prd.md` — primary risk source
- `context/foundation/roadmap.md` — likelihood weighting
- `context/foundation/tech-stack.md` — stack input (when present)
- `context/archive/<change-id>/plan.md` — implemented risk surface
- `context/changes/<change-id>/` — per-rollout-phase change folder (one per row in §3)

<!-- END @przeprogramowani/10x-cli -->
