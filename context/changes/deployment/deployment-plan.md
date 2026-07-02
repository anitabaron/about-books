# Cloudflare Workers — First Deploy Plan

## Context

The project (`about-books`) is an Astro 6 + React 19 SSR app already wired to the Cloudflare Workers adapter (`@astrojs/cloudflare` v13+). The stack is correct; what's missing is the actual deployment. The `wrangler.jsonc` still carries the scaffold name `10x-astro-starter`. Supabase integration is out of scope for this deploy — `SUPABASE_URL` / `SUPABASE_KEY` are declared `optional: true` in `astro.config.mjs` so the app builds and runs without them (auth features will be no-ops until Supabase is wired in a later phase).

This plan covers: CLI prerequisites → rename fix → manual first deploy → Cloudflare Git integration for auto-deploy on push to `main`. The Supabase CLI and OpenAI SDK are set up here as prerequisites even though their integrations land in later phases.

---

## Phase 0: CLI prerequisites

### Task 0 — Install and verify all required CLIs

#### Wrangler (Cloudflare Workers CLI)

- [ ] Verify wrangler is available (bundled as project dev dependency):
  ```bash
  npx wrangler --version
  # Expected: wrangler X.X.X
  ```
  If missing: `npm install --save-dev wrangler`

- [ ] Authenticate:
  ```bash
  npx wrangler login
  # Opens browser OAuth → Cloudflare account
  # Success: "Successfully logged in"
  ```

- [ ] Verify authenticated account:
  ```bash
  npx wrangler whoami
  # Expected: "You are logged in with an OAuth Token, associated with the email <your-email>"
  ```

> **Edge case — wrong account:** `npx wrangler logout` then `npx wrangler login` again.

> **Edge case — CI / headless environment:** Use an API token instead of OAuth. Create one at Cloudflare dashboard → My Profile → API Tokens → Edit Cloudflare Workers template, scoped to the `about-books` Worker. Export as `CLOUDFLARE_API_TOKEN` env var — wrangler picks it up automatically.

---

#### Supabase CLI

> Supabase backend integration is out of scope for the first deploy. Install the CLI now so it's ready when that phase begins.

- [ ] Install Supabase CLI:
  ```bash
  # macOS (Homebrew — recommended)
  brew install supabase/tap/supabase

  # Or via npm (no Homebrew)
  npm install --save-dev supabase
  ```

- [ ] Verify:
  ```bash
  supabase --version
  # Expected: supabase version X.X.X
  ```

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
> ```bash
> npx wrangler secret put OPENAI_API_KEY
> ```
> Do NOT commit the key to `.dev.vars` in version control — `.dev.vars` is gitignored but double-check before any commit touching that file.

> **Edge case — SDK compatibility in workerd:** Before building FR-006, test that `openai` npm package works in the Workers runtime. The SDK uses `fetch` under the hood (supported), but verify retry/timeout logic doesn't depend on Node.js-only APIs. See `infrastructure.md` — Unknown Unknowns §1.

---

#### GitHub CLI

- [x] Install GitHub CLI — confirmed installed (`gh version 2.95.0`).

---

## Phase 1: Manual setup gate (human step — agent cannot perform)

### Task 1 — Authenticate wrangler

- [ ] **Run in terminal:** `npx wrangler login`
  - Opens browser OAuth to your Cloudflare account
  - Succeeds when terminal prints: `Successfully logged in`

> **Edge case — wrong account:** Run `npx wrangler logout` first, then `npx wrangler login` again.

---

## Phase 2: First deploy

### Task 2 — Build and deploy to production

- [ ] Run production build:
  ```bash
  npm run build
  ```
  Expected: `dist/` created, no errors. Watch for any `node:fs`, `child_process`, or Node-only module errors — these indicate a package incompatible with the Workers runtime.

- [ ] Deploy:
  ```bash
  npx wrangler deploy
  ```
  Expected output includes:
  ```
  Uploaded about-books (X.XX sec)
  Published about-books (X.XX sec)
    https://about-books.workers.dev
  ```

- [ ] Open `https://about-books.workers.dev` in browser — confirm the app loads (pages render, no blank screen or 500 errors)

- [ ] Tail live logs for 2–3 minutes while navigating the app:
  ```bash
  npx wrangler tail about-books --format pretty
  ```
  Watch for: `1102 CPU exceeded` errors or unhandled exceptions.

> **Edge case — 1102 CPU exceeded:** Free tier CPU limit is 10ms/invocation. If SSR pages trigger this, upgrade to the $5/month paid plan (raises limit to 30ms) or move expensive rendering to React islands.

> **Edge case — build fails with workerd module error:** Run `wrangler dev` locally (not `npm run dev`) to reproduce the Workers runtime. Divergence between Node.js and workerd surfaces here before deploy.

- [ ] Commit: `chore: first Cloudflare Workers deploy — about-books`

---

## Phase 3: Cloudflare Git integration (auto-deploy on push)

### Task 3 — Connect GitHub repo to Cloudflare Workers via Git integration

Cloudflare natively watches the GitHub repo and triggers build+deploy on every push to `main` — no CI secret or workflow change required.

- [ ] **Cloudflare dashboard → Workers & Pages → `about-books` Worker → Settings → Build & Deploy**
- [ ] Connect to GitHub and select the `about-books` repository
- [ ] Set **Production branch:** `main` (confirm this matches the default branch — current CI runs on `master`)
- [ ] Set **Build command:** `npm run build`
- [ ] Set **Build output directory:** `dist`
- [ ] Save and trigger a manual deploy from the dashboard to confirm the pipeline works end-to-end
- [ ] Verify the live URL is still healthy after the dashboard-triggered deploy

> **Note:** The existing GitHub Actions workflow (`.github/workflows/ci.yml`) continues to run lint + build checks on PRs — it does not deploy. No changes to CI are needed.

> **Edge case — branch name mismatch:** Current CI references `master`; confirm whether the repo default branch is `main` or `master` before setting the production branch in the dashboard. Push a test commit if unsure.

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
