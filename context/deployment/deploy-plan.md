# Cloudflare Workers — First Deploy Plan

## Context

The project (`about-books`) is an Astro 6 + React 19 SSR app already wired to the Cloudflare Workers adapter (`@astrojs/cloudflare` v13+). The stack is correct; what's missing is the actual deployment. The `wrangler.jsonc` still carries the scaffold name `10x-astro-starter`. Supabase integration is out of scope for this deploy — `SUPABASE_URL` / `SUPABASE_KEY` are declared `optional: true` in `astro.config.mjs` so the app builds and runs without them (auth features will be no-ops until Supabase is wired in a later phase).

This plan covers: CLI prerequisites → rename fix → manual first deploy → Cloudflare Git integration for auto-deploy on push to `main`. The Supabase CLI and OpenAI SDK are set up here as prerequisites even though their integrations land in later phases.

---

## Phase 0: CLI prerequisites

### Task 0 — Install and verify all required CLIs

#### Wrangler (Cloudflare Workers CLI)

- [x] Verify wrangler is available (bundled as project dev dependency) — confirmed `wrangler 4.105.0`.

- [x] Authenticate — already logged in.

- [x] Verify authenticated account — confirmed via `wrangler whoami`: logged in as `anita.baron@i4b.pl`, account has `workers (write)` scope.

> **Edge case — wrong account:** `npx wrangler logout` then `npx wrangler login` again.

> **Edge case — CI / headless environment:** Use an API token instead of OAuth. Create one at Cloudflare dashboard → My Profile → API Tokens → Edit Cloudflare Workers template, scoped to the `about-books` Worker. Export as `CLOUDFLARE_API_TOKEN` env var — wrangler picks it up automatically.

---

#### Supabase CLI

> Supabase backend integration is out of scope for the first deploy. Install the CLI now so it's ready when that phase begins.

- [x] Install Supabase CLI — confirmed installed.

- [x] Verify — confirmed working (`supabase status` / `supabase link` succeed).

- [x] Authenticate to Supabase Cloud:

  ```bash
  supabase login
  # Opens browser OAuth → Supabase account
  # Stores token at ~/.supabase/access-token
  ```

- [x] Link to the project — already done (project ref `hzazucfzlnfqnlhfevsq`):
  ```bash
  # From project root — requires project ref from Supabase dashboard → Settings → General
  supabase link --project-ref <PROJECT_REF>
  ```

> **Edge case — Docker not installed:** `supabase start` (local dev stack) requires Docker Desktop. The CLI itself installs without Docker; `supabase link` and cloud commands also work without it. Only `supabase start` / `supabase db reset` need Docker.

> **Edge case — `supabase` not found after `npm install`:** Use `npx supabase` instead, or add `./node_modules/.bin` to `PATH`.

---

#### OpenAI SDK

> OpenAI integration (AI enrich, FR-006) is out of scope for the first deploy. Set up the SDK now so it's ready. Note: there is no standalone `openai` CLI — the OpenAI product surface is an SDK plus a web dashboard, not a shell tool.

- [x] Install OpenAI Node SDK (project runtime is Node/Cloudflare Workers, not Python):

  ```bash
  npm install openai
  ```

- [x] Set your API key locally for testing (get it from https://platform.openai.com/api-keys):

  ```bash
  # Added OPENAI_API_KEY=sk-... to .dev.vars for Cloudflare local dev (gitignored)
  ```

  Also registered in `astro.config.mjs` env schema (`OPENAI_API_KEY`, context: "server", access: "secret").

- [x] Verify API access with a small script — confirmed working, key authenticates and returns model list.

> **Edge case — API key in Cloudflare Workers:** The OpenAI API key must be added as a Worker secret (not env var) before wiring FR-006:
>
> ```bash
> npx wrangler secret put OPENAI_API_KEY
> ```
>
> Do NOT commit the key to `.dev.vars` in version control — `.dev.vars` is gitignored but double-check before any commit touching that file.

> **Edge case — SDK compatibility in workerd:** Before building FR-006, test that `openai` npm package works in the Workers runtime. The SDK uses `fetch` under the hood (supported), but verify retry/timeout logic doesn't depend on Node.js-only APIs. See `infrastructure.md` — Unknown Unknowns §1.

---

#### GitHub CLI

- [x] Install GitHub CLI — confirmed installed (`gh version 2.95.0`).

---

## Phase 1: Manual setup gate (human step — agent cannot perform)

### Task 1 — Authenticate wrangler

- [x] Already authenticated — confirmed via `wrangler whoami` (see Phase 0).

> **Edge case — wrong account:** Run `npx wrangler logout` first, then `npx wrangler login` again.

---

## Phase 2: First deploy

### Task 2 — Build and deploy to production

- [x] Run production build — confirmed, `dist/` created, no errors.

- [x] Deploy — confirmed. Required registering an account-level `workers.dev` subdomain first (dashboard → Workers & Pages → account subdomain setup — the CLI's non-interactive prompt can't do this, it's a one-time manual step). Live at:

  ```
  https://about-books.ab-app.workers.dev
  ```

- [x] Confirmed the app loads — HTTP 200 response.

- [x] Tail live logs while navigating the app — confirmed clean: `/` and `/auth/signin` both returned `Ok`, no CPU-exceeded or unhandled exceptions.

> **Edge case — 1102 CPU exceeded:** Free tier CPU limit is 10ms/invocation. If SSR pages trigger this, upgrade to the $5/month paid plan (raises limit to 30ms) or move expensive rendering to React islands.

> **Edge case — build fails with workerd module error:** Run `wrangler dev` locally (not `npm run dev`) to reproduce the Workers runtime. Divergence between Node.js and workerd surfaces here before deploy.

- [ ] Commit: `chore: first Cloudflare Workers deploy — about-books`

---

## Phase 3: Cloudflare Git integration (auto-deploy on push)

### Task 3 — Connect GitHub repo to Cloudflare Workers via Git integration

Cloudflare natively watches the GitHub repo and triggers build+deploy on every push to `main` — no CI secret or workflow change required.

- [x] **Cloudflare dashboard → Workers & Pages → `about-books` Worker → Settings → Build & Deploy**
- [x] Connect to GitHub and select the `about-books` repository — connected to `anitabaron/about-books`
- [x] Set **Production branch:** `main` — confirmed, matches repo default branch
- [x] Set **Build command:** `npm run build` — confirmed (dashboard also auto-set deploy command `npx wrangler deploy` and version command `npx wrangler versions upload`)
- [x] Build output directory — not applicable for this setup; deploy runs via `npx wrangler deploy`, not a static output directory
- [ ] Save and trigger a manual deploy from the dashboard to confirm the pipeline works end-to-end
- [ ] Verify the live URL is still healthy after the dashboard-triggered deploy

---

### Task 3b — Set production secrets for Supabase auth

> Originally out of scope for this deploy (see Context) — added because auth is now being wired up: Supabase redirect URL has been configured for this deploy's live URL. Dashboard shows **Variables and secrets: None** for the Git-integration build, and `SUPABASE_URL`/`SUPABASE_KEY` only exist locally in `.dev.vars` — production has no way to authenticate users until these are set as Worker secrets.

- [x] Set Supabase secrets on the production Worker (same values as `.dev.vars`) — set via the Cloudflare dashboard's Git-integration "Variables and secrets" panel rather than `wrangler secret put`. Used the **Publishable (anon) key** for `SUPABASE_KEY`, not the Secret/service_role key — this client relies on RLS, not admin access.

> **Edge case — dashboard "Variable" vs "Secret" type:** The dashboard's Git-integration panel defaults new entries to plaintext **Variable** type (visible to anyone with dashboard read access), not encrypted **Secret** type. All three entries (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`) were initially added as Variable and had to be converted to Secret type manually. Double-check this when adding new env values here — it's easy to miss since both types "work" functionally.

- [x] Redeploy triggered by the dashboard save — confirmed live site still healthy (`/` and `/auth/signin` both return HTTP 200).

- [ ] Verify auth works end-to-end on the live URL: sign up, confirm email redirect lands correctly, sign in, sign out.

> **Edge case — secrets set via `wrangler secret put` vs. Git-integration deploys:** Worker secrets are stored per-Worker on Cloudflare, independent of the deploy source (CLI or Git integration) — setting them once via `wrangler secret put` persists across future Git-triggered deploys. They do not need to be re-entered in the dashboard's "Variables and secrets" panel unless rotated.

> **Note:** The existing GitHub Actions workflow (`.github/workflows/ci.yml`) continues to run lint + build checks on PRs — it does not deploy. No changes to CI are needed.

> **Edge case — Cloudflare build fails but local build passes:** Cloudflare's build runners use Node.js (not workerd). Build-time failures here are usually missing env vars or platform differences (Linux vs macOS). Check the build log in the Cloudflare dashboard for the exact error.

---

## Rollback procedure (reference)

If a bad deploy reaches production:

```bash
npx wrangler rollback                    # revert to previous deployment immediately
npx wrangler deployments list            # list versions with IDs
npx wrangler rollback <VERSION_ID>       # revert to a specific version
```

Note: rollback is code-only — Supabase database migrations do NOT roll back automatically.

---

## Out of scope (this plan)

- Staging / preview environments (use `wrangler dev` locally for now)
- Cloudflare Access policy on `workers.dev` subdomain during development
- Multi-region / HA configuration
- Cloudflare D1 / KV / R2 (Supabase is the data layer)
