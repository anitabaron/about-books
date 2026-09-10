-- Local development seed. Runs automatically after migrations on `npx supabase db reset`
-- (configured in supabase/config.toml as [db.seed] sql_paths = ["./seed.sql"]).
--
-- Why this exists: every `db reset` wipes auth.users, so hand-made test accounts vanished
-- three times in one day and each disappearance cost time diagnosing "the credentials don't
-- work". Seeded accounts survive every reset by construction.
--
--   reader-a@local.test / local-dev-password    owns the sample book
--   reader-b@local.test / local-dev-password    owns nothing — for isolation checks
--
-- LOCAL ONLY. These are well-known credentials in a file with no secrets; never point
-- .dev.vars at a remote project while this seed can run against it.
--
-- Idempotent: every insert is ON CONFLICT DO NOTHING, so re-running is harmless.

-- Fixed ids so relationships between the seeded rows stay stable across resets.
-- The four token columns must be '' and NOT null. GoTrue scans them into non-nullable Go
-- strings, so a null makes every sign-in fail with "Database error querying schema" — an
-- error that names the schema and says nothing about the actual cause. Diffed against a row
-- GoTrue creates itself; those are the only four columns where it writes '' over null.
-- Every column below was established by diffing a seeded row against one GoTrue creates
-- itself, column by column across the whole table. Two classes matter:
--   * the four token columns must be '' and NOT null — GoTrue scans them into non-nullable
--     Go strings, and a null makes sign-in fail with "Database error querying schema", an
--     error that names the schema and says nothing about the real cause;
--   * raw_app_meta_data / raw_user_meta_data and the timestamps must be populated for the
--     same reason.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reader-a@local.test',
   extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"sub":"11111111-1111-4111-8111-111111111111","email":"reader-a@local.test","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'reader-b@local.test',
   extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
   '', '', '', '',
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"sub":"22222222-2222-4222-8222-222222222222","email":"reader-b@local.test","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now(), now())
on conflict (id) do nothing;

-- GoTrue lists a user's login methods here; password sign-in works without it, but the
-- account looks half-created in Studio and in the API without a matching identity.
insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
values
  (extensions.uuid_generate_v4(), '11111111-1111-4111-8111-111111111111', 'email',
   '11111111-1111-4111-8111-111111111111',
   '{"sub":"11111111-1111-4111-8111-111111111111","email":"reader-a@local.test","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now(), now()),
  (extensions.uuid_generate_v4(), '22222222-2222-4222-8222-222222222222', 'email',
   '22222222-2222-4222-8222-222222222222',
   '{"sub":"22222222-2222-4222-8222-222222222222","email":"reader-b@local.test","email_verified":true,"phone_verified":false}'::jsonb,
   now(), now(), now())
on conflict (provider_id, provider) do nothing;

-- Sample data for reader A: enough to exercise every screen built so far. Reader B stays
-- empty on purpose, so an isolation check has a meaningful "sees nothing" side.
insert into public.books (id, user_id, title, author)
values ('aaaa0000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'Solaris', 'Stanisław Lem')
on conflict (id) do nothing;

insert into public.characters (id, user_id, book_id, name, description)
values
  ('cccc0000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaa0000-0000-4000-8000-000000000001', 'Kris Kelvin', 'Psycholog, narrator'),
  ('cccc0000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'aaaa0000-0000-4000-8000-000000000001', 'Harey', null),
  ('cccc0000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'aaaa0000-0000-4000-8000-000000000001', 'Snaut', 'Cybernetyk na stacji')
on conflict (id) do nothing;

-- One relationship, so the cast view has something to render -- and Snaut has none, which is
-- the zero-relationship state S-03 was careful about.
insert into public.relationships (id, user_id, character_a_id, character_b_id, type)
values ('dddd0000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'cccc0000-0000-4000-8000-000000000001', 'cccc0000-0000-4000-8000-000000000002',
        'romantic')
on conflict (id) do nothing;
