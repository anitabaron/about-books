-- Roadmap item S-03 (change: cast-and-relationships-view)
--
-- Third domain table, from the CLAUDE.md template. Relationships are UNDIRECTED: one row,
-- rendered beneath both characters. FR-004's vocabulary (family / ally / antagonist /
-- romantic / other) is symmetric -- "ally" reads the same from either side -- so direction
-- would only matter for role labels like "son / mother", which the PRD does not have.
--
-- Deliberately NOT constrained: nothing stops a reader entering A<->B and then B<->A as two
-- rows. Accepted for the MVP; `unique (least(a,b), greatest(a,b))` is the fix if it ever
-- becomes a real problem.

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  -- Ownership column. `default auth.uid()` means the client never sends an owner id,
  -- and the insert policy below means it could not forge one if it tried.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The two ends. Deleting either character takes the relationship with it.
  character_a_id uuid not null references public.characters (id) on delete cascade,
  character_b_id uuid not null references public.characters (id) on delete cascade,
  type text not null check (type in ('family', 'ally', 'antagonist', 'romantic', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A character cannot be related to itself. Cheaper here than in every path that writes.
  constraint relationships_distinct_characters check (character_a_id <> character_b_id)
);

comment on table public.relationships is
  'Undirected named connections between two of a reader''s characters. Private per reader.';

-- From the template: every policy predicate filters on user_id.
create index relationships_user_id_created_at_idx on public.relationships (user_id, created_at desc);
-- The lookup matches either end, so each column needs its own index; a composite would only
-- serve the leading column.
create index relationships_character_a_idx on public.relationships (character_a_id);
create index relationships_character_b_idx on public.relationships (character_b_id);

-- public.set_updated_at() already exists -- the books migration created it. Attach the
-- trigger only; `create or replace function` would overwrite the shared one.
create trigger relationships_set_updated_at
  before update on public.relationships
  for each row
  execute function public.set_updated_at();

alter table public.relationships enable row level security;

create policy "relationships_select_own" on public.relationships
  for select to authenticated using (auth.uid() = user_id);

create policy "relationships_insert_own" on public.relationships
  for insert to authenticated with check (auth.uid() = user_id);

create policy "relationships_update_own" on public.relationships
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "relationships_delete_own" on public.relationships
  for delete to authenticated using (auth.uid() = user_id);

-- REQUIRED, not defensive: this project's default ACLs grant new public tables only Dxtm.
grant select, insert, update, delete on public.relationships to authenticated;
revoke all on public.relationships from anon;
