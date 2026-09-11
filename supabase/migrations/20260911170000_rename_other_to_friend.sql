-- `other` becomes `friend`, and the shadowing rule follows it.
--
-- This is the first exercise of what the presets table is for. Before it, renaming a shared
-- type meant editing a TypeScript array, two `<select>` blocks and two check constraints, and
-- hoping nothing was missed. Now it is one update, and the foreign key's `on update cascade`
-- carries the new name into every connection that used the old one.
--
-- Order matters. `relationship_types_not_shared` still lists `other`, so it has to come off
-- BEFORE the rename and go back on after, listing `friend`. Re-adding it first would validate
-- reader-defined names against a list that no longer describes the presets.
--
-- Adding a check constraint validates existing rows, so if a reader has already coined a type
-- called "friend" this migration fails here -- inside its transaction, with nothing written.
-- That failure is deliberate and was measured before it was accepted: on 2026-09-11 neither
-- the local nor the production database held such a row. The fix, if it ever fires, is to
-- rename that one row by hand and run again.
alter table public.relationship_types drop constraint relationship_types_not_shared;

-- The `where` is what makes this safe to run twice, and the `update` is what makes it correct
-- at all: `on update cascade` rewrites `relationships.type` for every affected connection.
-- Both environments measured zero `other` connections on 2026-09-11, but a measurement is a
-- fact about a moment, not a guarantee about the deploy.
update public.relationship_type_presets set slug = 'friend' where slug = 'other';

alter table public.relationship_types
  add constraint relationship_types_not_shared check (
    lower(btrim(name)) not in ('family', 'ally', 'antagonist', 'romantic', 'friend')
  );

-- The five now live in exactly two places, both of them here: these rows, and the list above.
-- A check constraint cannot subquery, so that duplication is structural rather than sloppy --
-- what keeps it honest is the assertion in supabase/tests/rls_books.sql that the two describe
-- the same set. Adding a sixth shared type means touching both, in one migration.
