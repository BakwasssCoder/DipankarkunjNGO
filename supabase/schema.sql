-- =====================================================================
-- Deepankar-Kunj — full database setup (Supabase / Postgres)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run again: tables use IF NOT EXISTS, policies/functions are replaced.
--
-- Who can do what (enforced by Row Level Security, not by the website):
--   visitors (publishable key) : submit forms via functions, read published notices/media/settings, count visits
--   members (logged in)        : read ONLY their own membership, notifications, tasks, achievements; mark own task done
--   admins  (email in admins)  : everything
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- admins + helpers ----------
create table if not exists public.admins (
  email    text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create sequence if not exists public.member_seq   start 1001;
create sequence if not exists public.donation_seq start 1001;
create sequence if not exists public.request_seq  start 1001;

-- ---------- core tables ----------
create table if not exists public.members (
  id             uuid primary key default gen_random_uuid(),
  member_no      text unique not null,
  name           text not null check (char_length(name) between 2 and 100),
  phone          text not null check (phone ~ '^[6-9][0-9]{9}$'),
  place          text not null default '',
  tier           text not null default '',
  amount         integer not null check (amount between 1 and 1000000),
  message        text not null default '',
  lang           text not null default 'hi',
  status         text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  notes          text not null default '',
  source         text not null default 'website',          -- website | office
  consent_at     timestamptz,                               -- DPDP: when the person agreed (null = added by office)
  consent_notice text,
  paid_at        timestamptz,
  paid_amount    integer,
  payment_mode   text,
  payment_ref    text,
  donation_id    uuid,
  user_id        uuid unique references auth.users(id) on delete set null,  -- member portal login
  login_email    text,
  activation_code text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists members_phone_idx on public.members(phone);

create table if not exists public.donations (
  id          uuid primary key default gen_random_uuid(),
  receipt_no  text unique not null,
  donor_name  text not null check (char_length(donor_name) between 2 and 100),
  phone       text not null default '',
  place       text not null default '',
  amount      integer not null check (amount between 1 and 100000000),
  mode        text not null default 'cash' check (mode in ('cash','upi','bank','cheque','other')),
  payment_ref text not null default '',
  donated_on  date not null default current_date,
  purpose     text not null default '',
  member_id   uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text not null,
  subject        text not null default '',
  message        text not null,
  read           boolean not null default false,
  consent_at     timestamptz,
  consent_notice text,
  created_at     timestamptz not null default now()
);

create table if not exists public.requests (     -- DPDP rights requests
  id         uuid primary key default gen_random_uuid(),
  ref        text unique not null,
  type       text not null,
  name       text not null,
  phone      text not null,
  details    text not null default '',
  status     text not null default 'open' check (status in ('open','done')),
  closed_at  timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  title_en   text not null default '',
  date       date,
  text       text not null default '',
  text_en    text not null default '',
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('gallery','press')),
  image        text not null,          -- public URL in the "media" storage bucket
  storage_path text not null default '',
  caption      text not null default '',
  caption_en   text not null default '',
  published    boolean not null default true,
  sort         bigint not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.settings (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.activity_log (   -- DPDP Rule 8(3): kept ≥ 1 year, never edited
  id         bigserial primary key,
  action     text not null,
  detail     text not null default '',
  actor      text not null default coalesce(auth.jwt() ->> 'email', 'website'),
  created_at timestamptz not null default now()
);

create table if not exists public.visits_daily (
  day date primary key,
  n   bigint not null default 0
);

-- ---------- member portal tables ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid references public.members(id) on delete cascade,   -- null = all members
  title      text not null check (char_length(title) between 2 and 140),
  body       text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  title      text not null check (char_length(title) between 2 and 140),
  details    text not null default '',
  due_on     date,
  status     text not null default 'todo' check (status in ('todo','done')),
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  title      text not null check (char_length(title) between 2 and 140),
  details    text not null default '',
  awarded_on date not null default current_date,
  created_at timestamptz not null default now()
);

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.members where user_id = auth.uid() and auth.uid() is not null limit 1;
$$;

-- ---------- Row Level Security ----------
alter table public.admins        enable row level security;
alter table public.members       enable row level security;
alter table public.donations     enable row level security;
alter table public.messages      enable row level security;
alter table public.requests      enable row level security;
alter table public.notices       enable row level security;
alter table public.media         enable row level security;
alter table public.settings      enable row level security;
alter table public.activity_log  enable row level security;
alter table public.visits_daily  enable row level security;
alter table public.notifications enable row level security;
alter table public.tasks         enable row level security;
alter table public.achievements  enable row level security;

do $$
declare t text;
begin
  -- admin: full access to every table except the append-only log
  foreach t in array array['members','donations','messages','requests','notices','media','settings','notifications','tasks','achievements'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated using (public.is_admin());

drop policy if exists log_read on public.activity_log;
create policy log_read on public.activity_log for select to authenticated using (public.is_admin());
drop policy if exists log_insert on public.activity_log;
create policy log_insert on public.activity_log for insert to authenticated with check (public.is_admin());

drop policy if exists visits_admin on public.visits_daily;
create policy visits_admin on public.visits_daily for select to authenticated using (public.is_admin());

-- public website reads
drop policy if exists notices_public on public.notices;
create policy notices_public on public.notices for select to anon, authenticated using (published);
drop policy if exists media_public on public.media;
create policy media_public on public.media for select to anon, authenticated using (published);
drop policy if exists settings_public on public.settings;
create policy settings_public on public.settings for select to anon, authenticated using (true);

-- members see only their own rows
drop policy if exists member_self on public.members;
create policy member_self on public.members for select to authenticated using (user_id = auth.uid());
drop policy if exists member_notifications on public.notifications;
create policy member_notifications on public.notifications for select to authenticated
  using (public.my_member_id() is not null and (member_id is null or member_id = public.my_member_id()));
drop policy if exists member_tasks on public.tasks;
create policy member_tasks on public.tasks for select to authenticated using (member_id = public.my_member_id());
drop policy if exists member_achievements on public.achievements;
create policy member_achievements on public.achievements for select to authenticated using (member_id = public.my_member_id());

-- table privileges (RLS above still decides which rows)
revoke all on all tables in schema public from anon;
grant select on public.notices, public.media, public.settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- public functions (website forms) ----------
create or replace function public.submit_membership(p_name text, p_phone text, p_place text, p_tier text,
  p_amount integer, p_message text, p_lang text, p_notice text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_no text;
begin
  p_name := btrim(coalesce(p_name, '')); p_phone := btrim(coalesce(p_phone, ''));
  if char_length(p_name) not between 2 and 100 then raise exception 'invalid name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'invalid phone'; end if;
  if p_amount is null or p_amount not between 1 and 1000000 then raise exception 'invalid amount'; end if;
  if (select count(*) from public.members where phone = p_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many requests'; end if;
  v_no := 'DK-' || extract(year from now())::int || '-' || nextval('public.member_seq');
  insert into public.members (member_no, name, phone, place, tier, amount, message, lang, consent_at, consent_notice, source)
  values (v_no, p_name, p_phone, left(coalesce(p_place, ''), 120), left(coalesce(p_tier, ''), 60), p_amount,
          left(coalesce(p_message, ''), 500), case when p_lang = 'en' then 'en' else 'hi' end, now(), left(coalesce(p_notice, ''), 40), 'website');
  insert into public.activity_log (action, detail, actor) values ('collect', 'सदस्यता अनुरोध ' || v_no || ' (वेबसाइट फ़ॉर्म, सहमति सहित)', 'website');
  return v_no;
end $$;

create or replace function public.submit_message(p_name text, p_phone text, p_subject text, p_message text, p_notice text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  p_name := btrim(coalesce(p_name, '')); p_phone := btrim(coalesce(p_phone, ''));
  if char_length(p_name) not between 2 and 100 or p_phone !~ '^[6-9][0-9]{9}$' or char_length(btrim(coalesce(p_message, ''))) < 2 then
    raise exception 'invalid input'; end if;
  if (select count(*) from public.messages where phone = p_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many requests'; end if;
  insert into public.messages (name, phone, subject, message, consent_at, consent_notice)
  values (p_name, p_phone, left(coalesce(p_subject, ''), 60), left(p_message, 2000), now(), left(coalesce(p_notice, ''), 40));
  insert into public.activity_log (action, detail, actor) values ('collect', 'संपर्क संदेश (वेबसाइट फ़ॉर्म, सहमति सहित)', 'website');
  return true;
end $$;

create or replace function public.submit_request(p_type text, p_name text, p_phone text, p_details text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_ref text;
begin
  p_name := btrim(coalesce(p_name, '')); p_phone := btrim(coalesce(p_phone, ''));
  if char_length(p_name) not between 2 and 100 or p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'invalid input'; end if;
  if (select count(*) from public.requests where phone = p_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many requests'; end if;
  v_ref := 'DPR-' || extract(year from now())::int || '-' || nextval('public.request_seq');
  insert into public.requests (ref, type, name, phone, details)
  values (v_ref, left(coalesce(p_type, ''), 60), p_name, p_phone, left(coalesce(p_details, ''), 2000));
  insert into public.activity_log (action, detail, actor) values ('request', 'अधिकार अनुरोध ' || v_ref || ' — ' || left(coalesce(p_type, ''), 60), 'website');
  return v_ref;
end $$;

-- visitor counter: +1 per browser session (the website only calls it once per session)
create or replace function public.count_visit() returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.visits_daily (day, n) values (current_date, 1)
  on conflict (day) do update set n = public.visits_daily.n + 1;
  return (select coalesce(sum(n), 0) from public.visits_daily);
end $$;

-- member portal: look up the login email for a member number (no personal data returned)
create or replace function public.member_login_email(p_member_no text) returns text
language sql stable security definer set search_path = '' as $$
  select login_email from public.members where member_no = upper(btrim(p_member_no)) and user_id is not null;
$$;

-- member portal: link a freshly signed-up account to its membership using the admin-issued code
create or replace function public.claim_member(p_member_no text, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare m public.members; v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  select * into m from public.members where member_no = upper(btrim(p_member_no)) for update;
  if not found or m.activation_code is null or m.activation_code <> btrim(p_code) then raise exception 'invalid code'; end if;
  if m.status not in ('approved', 'paid') then raise exception 'membership not active'; end if;
  -- the account email is derived from member no + code, so a code can't be used from another account
  if v_email <> lower(m.member_no || '-' || m.activation_code || '@members.deepankarkunj.org') then raise exception 'invalid code'; end if;
  update public.members set user_id = auth.uid(), login_email = v_email, activation_code = null, updated_at = now() where id = m.id;
  insert into public.activity_log (action, detail, actor) values ('portal', m.member_no || ' ने सदस्य-पोर्टल सक्रिय किया', v_email);
  return m.member_no;
end $$;

create or replace function public.member_complete_task(p_task uuid, p_done boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set status = case when p_done then 'done' else 'todo' end, done_at = case when p_done then now() end
  where id = p_task and member_id = public.my_member_id();
  if not found then raise exception 'not allowed'; end if;
end $$;

-- ---------- admin functions (each checks is_admin) ----------
create or replace function public.admin_add_member(p_name text, p_phone text, p_place text, p_amount integer, p_tier text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_no text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  v_no := 'DK-' || extract(year from now())::int || '-' || nextval('public.member_seq');
  insert into public.members (member_no, name, phone, place, tier, amount, status, source)
  values (v_no, btrim(p_name), btrim(p_phone), coalesce(p_place, ''), coalesce(p_tier, 'कार्यालय से जोड़ा गया'), p_amount, 'approved', 'office');
  insert into public.activity_log (action, detail) values ('collect', 'सदस्यता ' || v_no || ' (कार्यालय द्वारा)');
  return v_no;
end $$;

create or replace function public.add_donation(p_name text, p_phone text, p_place text, p_amount integer, p_mode text,
  p_ref text, p_date date, p_purpose text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_no text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  v_no := 'DKD-' || extract(year from coalesce(p_date, current_date))::int || '-' || nextval('public.donation_seq');
  insert into public.donations (receipt_no, donor_name, phone, place, amount, mode, payment_ref, donated_on, purpose)
  values (v_no, btrim(p_name), coalesce(p_phone, ''), coalesce(p_place, ''), p_amount, p_mode, left(coalesce(p_ref, ''), 80),
          coalesce(p_date, current_date), left(coalesce(p_purpose, ''), 120));
  insert into public.activity_log (action, detail) values ('payment', 'दान ' || v_no || ' ₹' || p_amount);
  return v_no;
end $$;

-- mark a member paid: one transaction records the payment AND the matching donation receipt
create or replace function public.mark_member_paid(p_member uuid, p_amount integer, p_mode text, p_ref text, p_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare m public.members; v_no text; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into m from public.members where id = p_member for update;
  if not found then raise exception 'member not found'; end if;
  if m.status = 'paid' then raise exception 'already paid'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'invalid amount'; end if;
  if p_mode not in ('cash','upi','bank','cheque','other') then raise exception 'invalid mode'; end if;
  v_no := 'DKD-' || extract(year from coalesce(p_date, current_date))::int || '-' || nextval('public.donation_seq');
  insert into public.donations (receipt_no, donor_name, phone, place, amount, mode, payment_ref, donated_on, purpose, member_id)
  values (v_no, m.name, m.phone, m.place, p_amount, p_mode, left(coalesce(p_ref, ''), 80), coalesce(p_date, current_date),
          'सदस्यता शुल्क — ' || m.member_no, m.id)
  returning id into v_id;
  update public.members set status = 'paid', paid_at = now(), paid_amount = p_amount, payment_mode = p_mode,
    payment_ref = left(coalesce(p_ref, ''), 80), donation_id = v_id, updated_at = now() where id = m.id;
  insert into public.activity_log (action, detail) values ('payment', m.member_no || ' भुगतान ₹' || p_amount || ' (' || p_mode || ') → ' || v_no);
  return v_no;
end $$;

-- undo a mistaken "paid": removes the linked donation entry, member goes back to approved
create or replace function public.unmark_member_paid(p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.members;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into m from public.members where id = p_member for update;
  if not found or m.status <> 'paid' then raise exception 'not paid'; end if;
  delete from public.donations where id = m.donation_id;
  update public.members set status = 'approved', paid_at = null, paid_amount = null, payment_mode = null,
    payment_ref = null, donation_id = null, updated_at = now() where id = m.id;
  insert into public.activity_log (action, detail) values ('payment', m.member_no || ' का भुगतान रद्द किया');
end $$;

-- issue a 6-digit portal activation code (also used to reset a lost password)
create or replace function public.admin_issue_code(p_member uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0'); m public.members;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into m from public.members where id = p_member for update;
  if not found then raise exception 'member not found'; end if;
  if m.status not in ('approved', 'paid') then raise exception 'membership not active'; end if;
  update public.members set activation_code = v_code, user_id = null, login_email = null, updated_at = now() where id = m.id;
  insert into public.activity_log (action, detail) values ('portal', m.member_no || ' के लिए लॉगिन कोड जारी');
  return v_code;
end $$;

-- assign the same task to every active member at once
create or replace function public.admin_task_all(p_title text, p_details text, p_due date) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  insert into public.tasks (member_id, title, details, due_on)
  select id, btrim(p_title), coalesce(p_details, ''), p_due from public.members where status in ('approved', 'paid');
  get diagnostics n = row_count;
  return n;
end $$;

-- DPDP erasure by mobile number; donation records stay (accounting law)
create or replace function public.erase_by_phone(p_phone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a integer; b integer;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  delete from public.members where phone = p_phone; get diagnostics a = row_count;
  delete from public.messages where phone = p_phone; get diagnostics b = row_count;
  insert into public.activity_log (action, detail) values ('erase', 'मोबाइल …' || right(p_phone, 4) || ': ' || a || ' सदस्यता, ' || b || ' संदेश मिटाए');
  return jsonb_build_object('members', a, 'messages', b);
end $$;

create or replace function public.visit_total() returns bigint
language sql stable security definer set search_path = '' as $$ select coalesce(sum(n), 0) from public.visits_daily; $$;

-- function permissions: public ones for visitors, the rest only for logged-in users (and they check is_admin)
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.my_member_id(), public.submit_membership(text,text,text,text,integer,text,text,text),
  public.submit_message(text,text,text,text,text), public.submit_request(text,text,text,text), public.count_visit(),
  public.visit_total(), public.member_login_email(text) to anon, authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------- storage: photos uploaded from the admin panel ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists media_admin_read on storage.objects;
create policy media_admin_read on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_insert on storage.objects;
create policy media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------- first admin ----------
-- 1) Supabase → Authentication → Users → Add user (email + password, tick "Auto Confirm User")
-- 2) then run (with that email, lowercase):
-- insert into public.admins (email) values ('your-admin@example.com');
