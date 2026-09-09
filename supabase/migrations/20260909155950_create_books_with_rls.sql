-- Roadmap item F-01 (change: private-by-default-data-contract)
--
-- First domain table. Establishes the ownership + isolation convention that every
-- later domain table copies:
--   * user_id defaults to auth.uid() and cascades from auth.users
--   * RLS enabled, with four granular per-operation policies for `authenticated`
--   * `anon` holds neither policy nor grant, so its denial is structural
-- See CLAUDE.md - Key conventions.

-- updated_at maintenance, established once here as the shared convention.
-- `set search_path = ''` is mandatory, not decorative: a trigger function with a mutable
-- search_path is a hijack vector (Supabase's linter flags it as function_search_path_mutable).
-- Unqualified now() still resolves because pg_catalog is always searched.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.books is
  'A reader''s book collection. Private per reader, enforced by row-level security.';

-- Every policy predicate and every future list query filters by user_id.
create index books_user_id_created_at_idx on public.books (user_id, created_at desc);

create trigger books_set_updated_at
  before update on public.books
  for each row
  execute function public.set_updated_at();

alter table public.books enable row level security;

create policy "books_select_own" on public.books
  for select to authenticated using (auth.uid() = user_id);

create policy "books_insert_own" on public.books
  for insert to authenticated with check (auth.uid() = user_id);

create policy "books_update_own" on public.books
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "books_delete_own" on public.books
  for delete to authenticated using (auth.uid() = user_id);

-- Explicit privileges: `authenticated` gets exactly the four operations policed above.
-- `anon` gets none, so isolation does not rest on RLS alone.
grant select, insert, update, delete on public.books to authenticated;
revoke all on public.books from anon;
