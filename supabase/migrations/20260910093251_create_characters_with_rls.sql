-- Roadmap item S-02 (change: character-notes-crud)
--
-- Second domain table. Copies the RLS template from CLAUDE.md verbatim and adds book_id as
-- the relation. Policies check `auth.uid() = user_id` directly: ownership is never derived
-- by joining through books -- that would be slower, and this template is the convention the
-- remaining tables share.

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  -- Ownership column. `default auth.uid()` means the client never sends an owner id,
  -- and the insert policy below means it could not forge one if it tried.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The relation. Deleting a book takes its characters with it.
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.characters is
  'Characters a reader recorded while reading one of their own books. Private per reader.';

-- From the template: every policy predicate filters on user_id.
create index characters_user_id_created_at_idx on public.characters (user_id, created_at desc);
-- An addition, not a substitution: every listing query filters by book.
create index characters_book_id_created_at_idx on public.characters (book_id, created_at desc);

-- public.set_updated_at() already exists -- the books migration created it. Attach the
-- trigger only; `create or replace function` would overwrite the shared one, including its
-- pinned search_path.
create trigger characters_set_updated_at
  before update on public.characters
  for each row
  execute function public.set_updated_at();

alter table public.characters enable row level security;

create policy "characters_select_own" on public.characters
  for select to authenticated using (auth.uid() = user_id);

create policy "characters_insert_own" on public.characters
  for insert to authenticated with check (auth.uid() = user_id);

create policy "characters_update_own" on public.characters
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "characters_delete_own" on public.characters
  for delete to authenticated using (auth.uid() = user_id);

-- REQUIRED, not defensive: this project's default ACLs grant new public tables only Dxtm.
grant select, insert, update, delete on public.characters to authenticated;
revoke all on public.characters from anon;
