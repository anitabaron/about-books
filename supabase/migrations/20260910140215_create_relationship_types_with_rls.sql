-- Roadmap item S-01 of M-2 (change: reader-defined-relationship-types)
--
-- Fourth domain table, from the CLAUDE.md template. FR-004's five shared types stay in code
-- and stay immutable -- the check constraint on public.relationships still holds them. This
-- table holds only the types a reader invents themselves, scoped to one book: a type coined
-- for one novel is rarely meaningful in another, and per-book scoping keeps each book's
-- vocabulary short enough to pick from.
--
-- Scope guard, because this table invites growth: name, book, owner. No colours, no icons,
-- no ordering, no per-type notes.

create table public.relationship_types (
  id uuid primary key default gen_random_uuid(),
  -- Ownership column. `default auth.uid()` means the client never sends an owner id,
  -- and the insert policy below means it could not forge one if it tried.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The vocabulary belongs to one book; deleting the book takes its types with it.
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A custom type may not shadow one of the five that live in code. Two entries both reading
  -- "ally" in one select -- one a literal, one a row -- is a bug the reader cannot diagnose.
  constraint relationship_types_not_shared check (
    lower(btrim(name)) not in ('family', 'ally', 'antagonist', 'romantic', 'other')
  )
);

comment on table public.relationship_types is
  'Relationship type names a reader defined for one of their own books. Private per reader.';

-- From the template: every policy predicate filters on user_id. The page also reads by book.
create index relationship_types_user_id_book_id_idx on public.relationship_types (user_id, book_id);

-- One book cannot hold the same name twice, however it was cased or padded. This is what
-- makes a rename safe to propagate: the name identifies the row within its book.
create unique index relationship_types_book_name_idx
  on public.relationship_types (book_id, lower(btrim(name)));

-- public.set_updated_at() already exists -- the books migration created it. Attach the
-- trigger only; `create or replace function` would overwrite the shared one, including its
-- pinned search_path.
create trigger relationship_types_set_updated_at
  before update on public.relationship_types
  for each row
  execute function public.set_updated_at();

alter table public.relationship_types enable row level security;

create policy "relationship_types_select_own" on public.relationship_types
  for select to authenticated using (auth.uid() = user_id);

create policy "relationship_types_insert_own" on public.relationship_types
  for insert to authenticated with check (auth.uid() = user_id);

create policy "relationship_types_update_own" on public.relationship_types
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "relationship_types_delete_own" on public.relationship_types
  for delete to authenticated using (auth.uid() = user_id);

-- REQUIRED, not defensive: this project's default ACLs grant new public tables only Dxtm.
grant select, insert, update, delete on public.relationship_types to authenticated;
revoke all on public.relationship_types from anon;

-- ----------------------------------------------------------------------------------------
-- A connection now points at EITHER one of the five literals or one custom type's row.
--
-- The name is never copied into the relationship: a custom name lives in exactly one place,
-- so fixing a typo fixes every connection holding it at once.
--
-- The FK deliberately carries NO ACTION (the default), not RESTRICT. Both refuse to delete a
-- type that a connection still points at, which is the guarantee we want -- the application
-- only translates the error into a sentence with a count. The difference is when the check
-- runs: RESTRICT fires immediately, NO ACTION at end of statement. Deleting a BOOK cascades
-- to characters (and through them to relationships) and to relationship_types in the same
-- statement, so with RESTRICT the book delete succeeds only if the characters cascade happens
-- to run first -- which depends on FK order, not on anything we declared. NO ACTION sees the
-- end state, where the relationships are already gone, and lets the book delete through.
--
-- The existing `type in (...)` check needs no change: it evaluates to NULL, and therefore
-- passes, when type is NULL. That also means the order of the two statements below is free --
-- every existing row has `type` set and `custom_type_id` null, so the XOR check validates
-- true whether or not NOT NULL has been dropped yet.
-- ----------------------------------------------------------------------------------------

alter table public.relationships
  alter column type drop not null,
  add column custom_type_id uuid references public.relationship_types (id);

alter table public.relationships
  add constraint relationships_one_type check ((type is null) <> (custom_type_id is null));

-- Postgres does not index a foreign key automatically. Both the referential check on delete
-- and the "how many connections use this type" count read this column.
create index relationships_custom_type_idx on public.relationships (custom_type_id);

comment on column public.relationships.type is
  'One of FR-004''s five shared types, or NULL when custom_type_id is set.';
comment on column public.relationships.custom_type_id is
  'A reader-defined type from public.relationship_types, or NULL when type is set.';
