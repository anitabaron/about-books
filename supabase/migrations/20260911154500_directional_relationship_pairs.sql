-- Connections become one-way: a relationship belongs to the character it was created FROM,
-- and renders only on that character's card.
--
-- This reverses, deliberately, the central argument of 20260911110400. That migration
-- normalised the pair with `least`/`greatest` so that A->B and B->A would collide, because
-- under mirrored rendering the reversal WAS the duplicate -- the same fact entered twice, once
-- from each end. Rendering no longer mirrors, so the reversal stops being a duplicate and
-- becomes a second fact the reader may or may not want to record: "Agnieszka -- corka -> Ewa"
-- and "Ewa -- matka -> Agnieszka" are two notes, not one note written twice. Normalising the
-- pair would silently refuse the second one, which is the behaviour this change exists to
-- remove.
--
-- What still counts as a duplicate, and what the index therefore keeps out: the SAME direction
-- with the SAME type. That is the double submit, the double tap, the reader forgetting she
-- already wrote it -- and it is still caught, with the same 23505 the write paths already
-- translate into a sentence.
--
-- `nulls not distinct` is carried over unchanged and is still the whole thing. Exactly one of
-- `type` and `custom_type_id` is null in every row (relationships_one_type), so every index
-- entry contains a null. Postgres treats nulls as DISTINCT by default, which would make every
-- row distinct from every other and the index reject NOTHING -- while looking correct in \d and
-- in a migration diff. Measured 2026-09-11: removing the clause makes the harness's
-- custom-type duplicate assertion pass an insert it must refuse. Requires Postgres 15+;
-- this project runs 17.
--
-- No data migration, and none is possible to need: the new index is strictly LOOSER than the
-- old one -- equal `character_a_id`/`character_b_id` implies equal `least`/`greatest` -- so any
-- pair of rows that collides under the new definition already collided under the old one. The
-- creation cannot fail on existing rows.
--
-- The name is kept. It is the name production, `\d`, and the previous migration's comment all
-- already use; the semantics live in the comment below, which is rewritten.
drop index public.relationships_unique_pair_type;

create unique index relationships_unique_pair_type
  on public.relationships (
    character_a_id,
    character_b_id,
    type,
    custom_type_id
  ) nulls not distinct;

comment on index public.relationships_unique_pair_type is
  'One connection per (from-character, to-character, type). Direction is significant: the '
  'reverse is a separate note the reader may record, not a duplicate.';
