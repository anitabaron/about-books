-- Roadmap item S-02 of M-2 (deduplicate-relationship-pairs), parked with its decision made
-- and now built alongside the shared write-side resolution it shares an error path with.
--
-- Nothing stopped a reader recording A<->B and then B<->A: two rows, one connection, shown
-- twice in the cast and drawn as one line on the map. The key is the PAIR PLUS THE TYPE, not
-- the pair alone: two characters can legitimately be connected in more than one way -- family
-- and "mieszka z" between the same two women -- so the only true duplicate is the same pair
-- with the same type, usually entered once from each end.
--
-- Two details this depends on, neither obvious:
--
-- 1. `least`/`greatest` normalise the pair. Without them A->B and B->A are different index
--    entries and the defect survives the fix, which is the entire failure mode.
--
-- 2. `nulls not distinct` is not a refinement, it is the whole thing. Postgres treats nulls
--    as DISTINCT in a unique index by default, and EXACTLY ONE of `type` and `custom_type_id`
--    is null in every row by construction (relationships_one_type). So without this clause
--    every index entry contains a null, every row counts as distinct from every other, and
--    the index rejects NOTHING -- while looking, in \d and in a migration diff, exactly like
--    a working duplicate check. Measured 2026-09-11 by rebuilding the index without the
--    clause: the harness's very first duplicate assertion failed. Requires Postgres 15+;
--    this project runs 17.
create unique index relationships_unique_pair_type
  on public.relationships (
    least(character_a_id, character_b_id),
    greatest(character_a_id, character_b_id),
    type,
    custom_type_id
  ) nulls not distinct;

comment on index public.relationships_unique_pair_type is
  'One connection per (character pair, type). Pair order normalised so A->B and B->A collide.';
