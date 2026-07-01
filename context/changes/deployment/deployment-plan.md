# Cloudflare Workers — First Deploy Plan

## Context

The project (`about-books`) is an Astro 6 + React 19 SSR app already wired to the Cloudflare Workers adapter (`@astrojs/cloudflare` v13+). The stack is correct; what's missing is the actual deployment. The `wrangler.jsonc` still carries the scaffold name `10x-astro-starter`. Supabase integration is out of scope for this deploy — `SUPABASE_URL` / `SUPABASE_KEY` are declared `optional: true` in `astro.config.mjs` so the app builds and runs without them (auth features will be no-ops until Supabase is wired in a later phase).

This plan covers: rename fix → pre-deploy safety check → manual first deploy → Cloudflare Git integration for auto-deploy on push to `main`.

---

## Phase 1: Pre-deploy fixes (automated)

### Task 1 — Fix Worker name in `wrangler.jsonc`

**File:** `wrangler.jsonc` (root)

Rename before ANY `wrangler deploy` — renaming after first deploy creates a second Worker instead of updating the existing one.

- [ ] Change `"name": "10x-astro-starter"` → `"name": "about-books"`
- [ ] Verify `compatibility_date` is `"2026-05-08"` (already ≥ 2024-09-23 required for `nodejs_compat` + Supabase SSR cookies ✓)
- [ ] Verify `compatibility_flags` includes `"nodejs_compat"` ✓
- [ ] Commit: `fix: rename Worker to about-books before first deploy`

---

## Phase 2: Manual setup gate (human step — agent cannot perform)

### Task 2 — Authenticate wrangler

- [ ] **Run in terminal:** `npx wrangler login`
  - Opens browser OAuth to your Cloudflare account
  - Succeeds when terminal prints: `Successfully logged in`

> **Edge case — wrong account:** Run `npx wrangler logout` first, then `npx wrangler login` again.

---

## Phase 3: First deploy

### Task 3 — Build and deploy to production

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

## Phase 4: Cloudflare Git integration (auto-deploy on push)

### Task 4 — Connect GitHub repo to Cloudflare Workers via Git integration

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
