-- Isolation contract for public.books -- roadmap F-01 (private-by-default-data-contract).
--
-- Asserts, at the policy level, that one reader cannot read, update or delete another
-- reader's rows. Exits non-zero on the first failed assertion (run with ON_ERROR_STOP=1).
--
-- Safety, in order of strength:
--   1. This transaction ALWAYS ends in rollback -- it commits nothing, ever.
--   2. It refuses to start without -v rls_test_ack=local-only, so a bare
--      `psql -f` against a production URL fails before touching anything.
--   3. It refuses a server on a non-private address. Note this is a weak line:
--      managed Postgres also sits on private IPs. Do not rely on it alone.
--
-- Extend this file with a matching block for every new table that carries RLS.

-- Self-arming: the file must fail hard even if the caller forgot ON_ERROR_STOP.
\set ON_ERROR_STOP on

-- NOTE: \quit always exits 0, so it cannot be used to refuse -- a refusal that exits 0
-- reads as a pass. The ack is enforced by a raised exception below instead.
\if :{?rls_test_ack}
\else
\warn 'refusing to run: pass -v rls_test_ack=local-only (this script writes auth.users fixtures)'
\set rls_test_ack 'MISSING'
\endif

begin;

-- Carry the ack into SQL so its value, not just its presence, is checked.
select set_config('rls_test.ack', :'rls_test_ack', true) as ack;

do $$
begin
  if current_setting('rls_test.ack', true) is distinct from 'local-only' then
    raise exception 'refusing to run: pass -v rls_test_ack=local-only';
  end if;

  if inet_server_addr() is not null
     and not (inet_server_addr() <<= any (
       array['127.0.0.0/8','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']::inet[]))
  then
    raise exception 'refusing to run against non-private server address %', inet_server_addr();
  end if;
end $$;

-- Fixtures. Direct auth.users inserts are acceptable only because of the rollback above.
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'reader-a@rls.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reader-b@rls.test');

insert into public.books (id, user_id, title) values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Reader A book'),
  ('b0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Reader B book');

do $$
declare
  a_id   uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b_id   uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  a_book uuid := 'a0000000-0000-4000-8000-000000000001';
  a_own  uuid;
  owner  uuid;
  n      int;
  denied boolean;
begin
  -- Sanity: as superuser, RLS is bypassed and both fixture rows are visible. If this
  -- fails, the fixtures are wrong and every assertion below would be meaningless.
  -- Scoped to the two fixture owners on purpose: counting every row in the table would
  -- couple this check to an empty database, and from S-01 onward the dev database holds
  -- real books. Reader-scoped assertions below are unaffected either way, because RLS
  -- hides other users' rows from the fixture readers.
  select count(*) into n from public.books where user_id in (a_id, b_id);
  if n <> 2 then
    raise exception 'FIXTURE FAIL: expected 2 fixture rows as superuser, saw %', n;
  end if;

  ----------------------------------------------------------------- reader A
  perform set_config('request.jwt.claims',
    json_build_object('sub', a_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  if auth.uid() <> a_id then
    raise exception 'HARNESS FAIL: auth.uid() is %, expected reader A %', auth.uid(), a_id;
  end if;

  select count(*) into n from public.books;
  if n <> 1 then
    raise exception 'FAIL select: reader A sees % rows, expected exactly 1', n;
  end if;

  select count(*) into n from public.books where user_id = b_id;
  if n <> 0 then
    raise exception 'FAIL select: reader A can see % of reader B''s rows', n;
  end if;

  -- Positive controls. Every other assertion in this file is negative -- B cannot see,
  -- update, delete or forge; anon is refused -- so a policy that is too NARROW passes
  -- unnoticed: narrowing books_update_own to `using (false)` still yields row_count = 0
  -- for B, exactly as expected, while the app can no longer edit any book. The negative
  -- control guards against a policy that is too broad; these guard the other direction.
  -- They also exercise `default auth.uid()`, which the fixtures above bypass by setting
  -- user_id explicitly as superuser. A SECOND row is used so that reader B's assertions
  -- below still have a live target to fail against.
  insert into public.books (title) values ('Reader A self-insert')
    returning id, user_id into a_own, owner;
  if owner is distinct from a_id then
    raise exception 'FAIL insert default: row owned by %, expected reader A % '
      '(is `default auth.uid()` still on user_id?)', owner, a_id;
  end if;

  update public.books set author = 'set by A' where id = a_own;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL update own: reader A updated % of their own rows, expected 1 '
      '(is books_update_own too narrow?)', n;
  end if;

  delete from public.books where id = a_own;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL delete own: reader A deleted % of their own rows, expected 1 '
      '(is books_delete_own too narrow?)', n;
  end if;

  ----------------------------------------------------------------- reader B
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', b_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.books;
  if n <> 1 then
    raise exception 'FAIL select: reader B sees % rows, expected exactly 1', n;
  end if;

  -- RLS filters rather than refuses: B's write against A's row must affect zero rows.
  update public.books set title = 'hijacked' where id = a_book;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL update: reader B updated % of reader A''s rows', n;
  end if;

  delete from public.books where id = a_book;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL delete: reader B deleted % of reader A''s rows', n;
  end if;

  -- Forging ownership on insert must be refused outright by the WITH CHECK predicate.
  denied := false;
  begin
    insert into public.books (user_id, title) values (a_id, 'forged');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL insert: reader B inserted a row owned by reader A';
  end if;

  ----------------------------------------------------------------- anon
  -- anon holds no grant at all, so its denial is structural (privilege), not a
  -- filtered-empty result. This is what Studio reports as "API DISABLED".
  perform set_config('role', 'postgres', true);
  perform set_config('role', 'anon', true);
  denied := false;
  begin
    select count(*) into n from public.books;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL anon: anon read books (saw % rows) -- expected permission denied', n;
  end if;

  perform set_config('role', 'postgres', true);
  raise notice 'PASS: reader A can act on own rows (incl. default auth.uid()); reader B isolated on select/insert/update/delete; anon denied at grant level';
end $$;

-- ============================================================================
-- characters -- roadmap S-02 (character-notes-crud)
-- Same shape as the books block above: negative assertions that reader B cannot
-- act on reader A's rows, and positive ones that reader A can act on their own.
-- ============================================================================

do $$
declare
  a_id   uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  b_id   uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  a_book uuid := 'a0000000-0000-4000-8000-000000000001';
  b_book uuid := 'b0000000-0000-4000-8000-000000000001';
  a_char uuid;
  b_char uuid;
  a_own  uuid;
  owner  uuid;
  n      int;
  denied boolean;
begin
  -- Fixtures as superuser, one character per reader.
  insert into public.characters (user_id, book_id, name)
    values (a_id, a_book, 'Reader A character') returning id into a_char;
  insert into public.characters (user_id, book_id, name)
    values (b_id, b_book, 'Reader B character') returning id into b_char;

  select count(*) into n from public.characters where user_id in (a_id, b_id);
  if n <> 2 then
    raise exception 'FIXTURE FAIL: expected 2 fixture characters as superuser, saw %', n;
  end if;

  ----------------------------------------------------------------- reader A
  perform set_config('request.jwt.claims',
    json_build_object('sub', a_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.characters;
  if n <> 1 then
    raise exception 'FAIL select: reader A sees % characters, expected exactly 1', n;
  end if;

  select count(*) into n from public.characters where user_id = b_id;
  if n <> 0 then
    raise exception 'FAIL select: reader A can see % of reader B''s characters', n;
  end if;

  -- Positive controls: guard against a policy that is too NARROW, which every negative
  -- assertion below would pass happily. Also exercises `default auth.uid()`, which the
  -- fixtures above bypass. Uses a second row so B's assertions keep a live target.
  insert into public.characters (book_id, name) values (a_book, 'A self-insert')
    returning id, user_id into a_own, owner;
  if owner is distinct from a_id then
    raise exception 'FAIL insert default: character owned by %, expected reader A % '
      '(is `default auth.uid()` still on user_id?)', owner, a_id;
  end if;

  update public.characters set description = 'set by A' where id = a_own;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL update own: reader A updated % of their own characters, expected 1 '
      '(is characters_update_own too narrow?)', n;
  end if;

  delete from public.characters where id = a_own;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL delete own: reader A deleted % of their own characters, expected 1 '
      '(is characters_delete_own too narrow?)', n;
  end if;

  ----------------------------------------------------------------- reader B
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', b_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.characters;
  if n <> 1 then
    raise exception 'FAIL select: reader B sees % characters, expected exactly 1', n;
  end if;

  update public.characters set name = 'hijacked' where id = a_char;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL update: reader B updated % of reader A''s characters', n;
  end if;

  delete from public.characters where id = a_char;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL delete: reader B deleted % of reader A''s characters', n;
  end if;

  denied := false;
  begin
    insert into public.characters (user_id, book_id, name) values (a_id, a_book, 'forged');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL insert: reader B inserted a character owned by reader A';
  end if;

  ----------------------------------------------------------------- anon
  perform set_config('role', 'postgres', true);
  perform set_config('role', 'anon', true);
  denied := false;
  begin
    select count(*) into n from public.characters;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'FAIL anon: anon read characters (saw % rows) -- expected permission denied', n;
  end if;

  perform set_config('role', 'postgres', true);
  raise notice 'PASS characters: reader A can act on own rows (incl. default auth.uid()); '
    'reader B isolated on select/insert/update/delete; anon denied at grant level';
end $$;

rollback;
