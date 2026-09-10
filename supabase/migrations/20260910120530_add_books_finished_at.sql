-- Roadmap item S-04 (change: book-status-and-recall)
--
-- FR-009 needs exactly two facts about a book: whether it is finished, and when. One nullable
-- column carries both, so "finished with no date" and "currently reading with a date" are
-- structurally impossible. There is deliberately NO separate status flag -- adding one would
-- reintroduce exactly the contradiction this shape removes.
--
-- null            = currently reading
-- a timestamp     = finished on that date
--
-- No RLS change: the four books policies act on whole rows, so they already cover this column.
-- No index: the filter runs over a personal collection, and books already carries
-- (user_id, created_at desc) for the ordering.

alter table public.books add column finished_at timestamptz;

comment on column public.books.finished_at is
  'When the reader marked this book finished. Null means currently reading; there is no separate status flag.';
