-- 002 — membership form can also create a member-portal account (email + password).
-- Run once in Supabase → SQL Editor (also included in schema.sql for fresh setups).

-- Called by the website right after supabase.auth.signUp(), i.e. by the brand-new account itself:
-- saves the membership exactly like submit_membership and links it to that account.
create or replace function public.submit_membership_account(p_name text, p_phone text, p_place text, p_tier text,
  p_amount integer, p_message text, p_lang text, p_notice text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_no text; v_uid uuid := auth.uid(); v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then raise exception 'not logged in'; end if;
  if public.is_admin() then raise exception 'admin account'; end if;
  v_no := public.submit_membership(p_name, p_phone, p_place, p_tier, p_amount, p_message, p_lang, p_notice);
  -- one login ↔ one membership; a second pledge from the same account is saved without a link
  if not exists (select 1 from public.members where user_id = v_uid) then
    update public.members set user_id = v_uid, login_email = v_email where member_no = v_no;
    insert into public.activity_log (action, detail, actor) values ('portal', v_no || ' — खाता फ़ॉर्म से बना', v_email);
  end if;
  return v_no;
end $$;

revoke execute on function public.submit_membership_account(text,text,text,text,integer,text,text,text) from public, anon;
grant execute on function public.submit_membership_account(text,text,text,text,integer,text,text,text) to authenticated;
