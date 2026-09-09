---
starter_id: 10x-astro-starter
package_manager: npm
project_name: about-books
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers # corrected 2026-09-09: shipped as a Worker, not Pages
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
---

## Why this stack

about-books is a mobile-first web app for a solo builder, now on a 3-day after-hours budget (scope re-cut 2026-09-09 — see `prd.md` § Scope Triage). The 10x Astro Starter (Astro 6 + React 19 + Supabase + Cloudflare Pages) ships auth, a PostgreSQL-backed database, TypeScript throughout, and edge deployment out of the box — eliminating the three highest-risk setup tasks (auth plumbing, database schema, deploy pipeline) before the first line of domain code. Supabase Row-Level Security enforces the PRD's strict per-user data isolation without custom middleware. Cloudflare Pages handles mobile-first delivery with low-latency edge routing. The AI character hints feature (FR-006) would connect to any LLM API from Astro server routes — no additional backend service required — and the relationship diagram (FR-007) would run client-side in a React island. Both are phase 2 (see `prd.md` § Scope Triage), not cancelled; the stack supports them unchanged whenever they return, so this choice does not need revisiting when they do. All four agent-friendly gates pass: fully typed (TypeScript + Zod at boundaries), convention-based (Astro file routing), popular in training data, and well-documented.
