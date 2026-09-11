-- The five shared relationship types become rows.
--
-- Until now they existed only as a list written out three times: `RELATIONSHIP_TYPES` in
-- src/types.ts, two `<select>` blocks in the book page, and two check constraints here. A
-- reader who went looking for them in the database could not find them, which is the whole
-- reason for this table. After this migration the set of valid shared types is DATA, and the
-- column that uses it is checked by referential integrity instead of by a list someone has to
-- remember to keep in step.
--
-- This migration deliberately seeds the names EXACTLY as they are today, `other` included.
-- Renaming it to `friend` belongs to the next phase, together with the application change that
-- stops offering `other`. Splitting them is the point: with the names unchanged, the deployed
-- application's own list still agrees with these rows, so this migration can go to production
-- on its own and change nothing anybody can see.
create table public.relationship_type_presets (
  slug text primary key,
  -- The order the reader sees in the dropdown. Unique so two presets cannot claim one
  -- position and leave the ordering down to whatever the planner returns.
  sort_order smallint not null unique
);

comment on table public.relationship_type_presets is
  'The shared relationship types every reader gets. Immutable from the application: readable '
  'by any signed-in reader, writable by none, so a sixth type is a migration and not a form.';

insert into public.relationship_type_presets (slug, sort_order) values
  ('family', 1),
  ('ally', 2),
  ('antagonist', 3),
  ('romantic', 4),
  ('other', 5);

alter table public.relationship_type_presets enable row level security;

-- Not the per-user template: these rows belong to nobody, so the predicate is `true` rather
-- than an ownership test. What keeps the table safe is the ABSENCE of the other three
-- policies -- there is no insert, update or delete policy, and no write grant, so the
-- application cannot change a preset no matter what it sends.
create policy "relationship_type_presets_select_all" on public.relationship_type_presets
  for select to authenticated using (true);

-- REQUIRED, not defensive: this project's default ACLs grant new public tables only Dxtm.
-- Select alone, because select is all the application ever needs.
grant select on public.relationship_type_presets to authenticated;
revoke all on public.relationship_type_presets from anon;

-- `type` stops being checked against a literal list and starts pointing at those rows.
--
-- `on update cascade` is not decoration: it is what lets the next phase rename a preset with
-- one statement and have every connection follow. Without it the same rename needs
-- insert-new, rewrite-references, delete-old, in an order that is wrong more often than right.
--
-- `on delete no action` keeps a preset in use undeletable, which is the same guarantee the
-- custom-type foreign key already carries.
alter table public.relationships
  drop constraint relationships_type_check,
  add constraint relationships_type_fkey
    foreign key (type) references public.relationship_type_presets (slug)
    on update cascade on delete no action;

-- Deliberately NO index on public.relationships (type), against the template's usual rule
-- for foreign keys. That rule earns its place on `custom_type_id`, which has one value per
-- reader-defined type; `type` has five values for the whole table, so no read will ever use
-- an index on it, and the only write path that would -- a preset rename or delete -- happens
-- once, inside a migration, against a table this size. An index nobody reads still costs
-- every insert.
