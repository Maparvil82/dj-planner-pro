-- Community safety: private evidence, explicit consent, bilateral blocks and staff review.
create table community_private.safety_settings (
 id boolean primary key default true check(id), contact_email text,
 terms_version text not null default '2026-10-09',
 check(contact_email is null or contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
);
insert into community_private.safety_settings(id) values(true);
create table community_private.moderators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table community_private.terms_acceptances (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null, accepted_at timestamptz not null default now()
);
create table community_private.user_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id),
 check(blocker_id <> blocked_id)
);
create index safety_blocks_reverse_idx on community_private.user_blocks(blocked_id,blocker_id);
create table community_private.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references auth.users(id) on delete set null,
 author_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('profile','session','mix')), target_id uuid not null,
 reason text not null check(reason in ('harassment','hate','sexual','violence','spam','copyright','other')),
 details text not null default '' check(length(details)<=1000), snapshot jsonb not null,
 status text not null default 'open' check(status in ('open','dismissed','removed')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null, review_note text,
 unique(reporter_id,kind,target_id)
);
create index safety_reports_queue_idx on community_private.reports(status,created_at,id);
create index safety_reports_owner_idx on community_private.reports(reporter_id,created_at desc);
create table community_private.removed_content (
 kind text not null check(kind in ('profile','session','mix')), target_id uuid not null,
 report_id uuid not null references community_private.reports(id) on delete cascade,
 removed_at timestamptz not null default now(), primary key(kind,target_id,report_id)
);
create table community_private.review_log (
 id bigint generated always as identity primary key, report_id uuid not null references community_private.reports(id) on delete cascade,
 moderator_id uuid references auth.users(id) on delete set null,
 action text not null, note text not null, created_at timestamptz not null default now()
);
-- No client can access moderation tables or appoint moderators directly.
do $$ declare t text; begin
 foreach t in array array['safety_settings','moderators','terms_acceptances','user_blocks','reports','removed_content','review_log'] loop
  execute format('alter table community_private.%I enable row level security',t);
  execute format('revoke all on community_private.%I from public,anon,authenticated',t);
 end loop;
end $$;

create function community_private.blocked_between(a uuid,b uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from community_private.user_blocks x where (x.blocker_id=a and x.blocked_id=b) or (x.blocker_id=b and x.blocked_id=a));
$$;
create function community_private.viewer_blocked(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or community_private.blocked_between(auth.uid(),target);
$$;
create function community_private.content_allowed(content_kind text, target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and not exists(select 1 from community_private.removed_content r where r.kind=content_kind and r.target_id=target)
 and not exists(select 1 from community_private.reports r where r.reporter_id=auth.uid() and r.kind=content_kind and r.target_id=target and r.status='open');
$$;
create function community_private.profile_allowed(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not community_private.blocked_between(auth.uid(),target)
 and community_private.content_allowed('profile',target);
$$;
create function community_private.can_publish()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from community_private.terms_acceptances a join community_private.safety_settings s on s.id and a.version=s.terms_version where a.user_id=auth.uid())
 and not exists(select 1 from community_private.removed_content r where r.kind='profile' and r.target_id=auth.uid());
$$;
create function community_private.assert_publication(text_value text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 if not community_private.can_publish() then raise exception 'COMMUNITY_TERMS_OR_RESTRICTION' using errcode='42501'; end if;
 -- Baseline multilingual text screening; images and contextual cases go to human review.
 if lower(text_value) ~ '(\m(heil hitler|kill all (jews|muslims)|matar a todos los (judíos|judios|musulmanes)|pornografía infantil|pornografia infantil|child pornography|child porn|nigger|niggers|faggot|faggots)\M)' then
  raise exception 'COMMUNITY_CONTENT_REVIEW' using errcode='22023';
 end if;
end $$;

create function community_private.publication_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare text_value text;
begin
 if TG_TABLE_NAME='community_profiles' then
  if not new.is_visible then return new; end if;
  text_value:=concat_ws(' ',new.artist_name,new.bio);
 elsif TG_TABLE_NAME='community_profile_mixes' then text_value:=new.title;
 elsif TG_TABLE_NAME='community_session_shares' then
  select concat_ws(' ',s.title,s.venue) into text_value from public.sessions s where s.id=new.session_id;
 elsif TG_TABLE_NAME='sessions' then
  if not exists(select 1 from public.community_session_shares sh where sh.session_id=new.id) then return new; end if;
  text_value:=concat_ws(' ',new.title,new.venue);
 end if;
 perform community_private.assert_publication(coalesce(text_value,'')); return new;
end $$;
create trigger safety_profile_publication before insert or update on public.community_profiles for each row execute function community_private.publication_guard();
create trigger safety_mix_publication before insert or update on public.community_profile_mixes for each row execute function community_private.publication_guard();
create trigger safety_session_publication before insert on public.community_session_shares for each row execute function community_private.publication_guard();
-- Only social text edits require renewed acceptance; private bookkeeping remains available.
create trigger safety_shared_session_text before update of title,venue on public.sessions for each row when ((new.title,new.venue) is distinct from (old.title,old.venue)) execute function community_private.publication_guard();

create policy safety_profiles_read on public.community_profiles as restrictive for select to authenticated
 using(user_id=(select auth.uid()) or community_private.profile_allowed(user_id));
create policy safety_mixes_read on public.community_profile_mixes as restrictive for select to authenticated
 using(user_id=(select auth.uid()) or (community_private.profile_allowed(user_id) and community_private.content_allowed('mix',id)));
create policy safety_follow_insert on public.community_follows as restrictive for insert to authenticated
 with check(community_private.can_publish() and community_private.profile_allowed(following_id));

-- Privileged feed projections also filter before LIMIT/OFFSET. RLS alone cannot
-- protect SECURITY DEFINER functions. Keep all existing location/search behaviour.
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='community_private' and p.proname in
 ('session_feed','session_feed_filtered','session_feed_search','filter_options','profile_session_counts','profile_posters','following_activity','session_shelf','saved_mix_list') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'public.community_profiles','(select * from public.community_profiles where community_private.profile_allowed(user_id))');
  definition:=replace(definition,'public.community_session_shares','(select * from public.community_session_shares where community_private.content_allowed(''session'',session_id))');
  definition:=replace(definition,'public.community_profile_mixes','(select * from public.community_profile_mixes where community_private.content_allowed(''mix'',id))');
  execute definition;
 end loop;
end $$;

create function community_private.social_delivery_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='session_collaborators' then
  if TG_OP='INSERT' or (new.status='accepted' and old.status is distinct from 'accepted') then
   if community_private.blocked_between(new.inviter_id,new.dj_id) then raise exception 'COMMUNITY_USER_BLOCKED' using errcode='42501'; end if;
   if exists(select 1 from community_private.removed_content r where r.kind='profile' and r.target_id in (new.inviter_id,new.dj_id)) then raise exception 'COMMUNITY_RESTRICTED' using errcode='42501'; end if;
  end if;
 else
  if new.actor_id is not null and community_private.blocked_between(new.recipient_id,new.actor_id) then return null; end if;
 end if;
 return new;
end $$;
create trigger safety_new_invitation before insert on public.session_collaborators for each row execute function community_private.social_delivery_guard();
create trigger safety_accept_invitation before update of status on public.session_collaborators for each row execute function community_private.social_delivery_guard();
create policy safety_pending_invitations_read on public.session_collaborators as restrictive for select to authenticated
 using(status='accepted' or not community_private.viewer_blocked(case when inviter_id=(select auth.uid()) then dj_id else inviter_id end));
-- This privileged agenda projection must retain accepted collaborations, while
-- hiding pending invitations from blocked accounts before pagination.
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='community_private' and p.proname='collaboration_inbox' loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'public.session_collaborators','(select * from public.session_collaborators where status=''accepted'' or not community_private.blocked_between(auth.uid(),inviter_id))');
  execute definition;
 end loop;
end $$;
create trigger safety_notification_delivery before insert on public.social_notifications for each row execute function community_private.social_delivery_guard();
create policy safety_notifications_read on public.social_notifications as restrictive for select to authenticated
 using(actor_id is null or not community_private.viewer_blocked(actor_id));

create function community_private.safety_command(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); target uuid; author uuid; evidence jsonb; report community_private.reports;
 is_staff boolean; terms_revision text; contact text; outcome text; note text;
begin
 if viewer is null or not exists(select 1 from auth.users where id=viewer) then raise exception 'Authentication required' using errcode='42501'; end if;
 select exists(select 1 from community_private.moderators where user_id=viewer) into is_staff;
 select terms_version,contact_email into terms_revision,contact from community_private.safety_settings where id;
 if action='status' then
  return jsonb_build_object('version',terms_revision,'accepted',exists(select 1 from community_private.terms_acceptances where user_id=viewer and terms_acceptances.version=terms_revision),'moderator',is_staff,'contact',contact,'restricted',exists(select 1 from community_private.removed_content where kind='profile' and target_id=viewer));
 elsif action='accept' then
  if input->>'version' is distinct from terms_revision then raise exception 'COMMUNITY_TERMS_CHANGED' using errcode='22023'; end if;
  insert into community_private.terms_acceptances(user_id,version) values(viewer,terms_revision) on conflict(user_id) do update set version=excluded.version,accepted_at=now();
  return jsonb_build_object('accepted',true);
 elsif action='blocked' then
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',b.blocked_id,'artist_name',coalesce(p.artist_name,'DJ'),'avatar_url',p.avatar_url) order by b.created_at desc) from community_private.user_blocks b left join public.community_profiles p on p.user_id=b.blocked_id where b.blocker_id=viewer),'[]');
 elsif action in ('block','unblock') then
  target:=(input->>'user_id')::uuid;
  if target is null or target=viewer or not exists(select 1 from public.community_profiles where user_id=target) then raise exception 'Invalid target' using errcode='22023'; end if;
  if action='block' then
   insert into community_private.user_blocks(blocker_id,blocked_id) values(viewer,target) on conflict do nothing;
   delete from public.community_follows where (follower_id=viewer and following_id=target) or (follower_id=target and following_id=viewer);
  else delete from community_private.user_blocks where blocker_id=viewer and blocked_id=target;
  end if;
  return jsonb_build_object('blocked',action='block');
 elsif action='report' then
  target:=(input->>'target_id')::uuid;
  -- Serialize per reporter: retries are idempotent and the daily limit cannot race.
  perform pg_advisory_xact_lock(hashtextextended(viewer::text,7301));
  select * into report from community_private.reports where reporter_id=viewer and kind=input->>'kind' and target_id=target;
  if found then return jsonb_build_object('id',report.id); end if;
  if (select count(*) from community_private.reports where reporter_id=viewer and created_at>now()-interval '24 hours')>=20 then raise exception 'COMMUNITY_REPORT_LIMIT' using errcode='54000'; end if;
  if input->>'reason'='other' and length(btrim(coalesce(input->>'details','')))<3 then raise exception 'Report details required' using errcode='22023'; end if;
  if input->>'kind'='profile' then
   select p.user_id,jsonb_build_object('name',p.artist_name,'bio',p.bio,'avatar_url',p.avatar_url,'cover_url',p.cover_url) into author,evidence from public.community_profiles p where p.user_id=target and p.is_visible and community_private.profile_allowed(p.user_id);
  elsif input->>'kind'='session' then
   select s.user_id,jsonb_build_object('title',s.title,'venue',s.venue,'date',s.date,'poster_url',s.poster_url) into author,evidence from public.sessions s join public.community_session_shares sh on sh.session_id=s.id and sh.user_id=s.user_id join public.community_profiles p on p.user_id=s.user_id and p.is_visible where s.id=target and s.status='confirmed' and community_private.profile_allowed(s.user_id) and community_private.content_allowed('session',s.id);
  elsif input->>'kind'='mix' then
   select m.user_id,jsonb_build_object('title',m.title,'source_url',m.source_url,'platform',m.platform) into author,evidence from public.community_profile_mixes m join public.community_profiles p on p.user_id=m.user_id and p.is_visible where m.id=target and community_private.profile_allowed(m.user_id) and community_private.content_allowed('mix',m.id);
  end if;
  if author is null or author=viewer then raise exception 'Content unavailable' using errcode='42501'; end if;
  insert into community_private.reports(reporter_id,author_id,kind,target_id,reason,details,snapshot)
   values(viewer,author,input->>'kind',target,input->>'reason',btrim(coalesce(input->>'details','')),evidence) returning * into report;
  return jsonb_build_object('id',report.id);
 elsif action='queue' then
  if not is_staff then raise exception 'Moderator required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q)) from (select id,kind,target_id,author_id,reason,details,snapshot,status,created_at,reviewed_at,review_note from community_private.reports where status=case when input->>'status'='closed' then status else 'open' end and (input->>'status' is distinct from 'closed' or status<>'open') order by created_at,id limit 20 offset least(greatest(coalesce((input->>'offset')::integer,0),0),5000)) q),'[]');
 elsif action='review' then
  if not is_staff then raise exception 'Moderator required' using errcode='42501'; end if;
  outcome:=input->>'outcome'; note:=btrim(coalesce(input->>'note',''));
  if outcome is null or outcome not in ('dismiss','remove','suspend','restore') or length(note) not between 3 and 1000 then raise exception 'Invalid review' using errcode='22023'; end if;
  select * into report from community_private.reports where id=(input->>'id')::uuid for update;
  if not found then raise exception 'Report unavailable' using errcode='22023'; end if;
  if outcome='restore' then
   delete from community_private.removed_content where report_id=report.id;
  elsif outcome in ('remove','suspend') then
   insert into community_private.removed_content(kind,target_id,report_id) values(report.kind,report.target_id,report.id) on conflict do nothing;
   if outcome='suspend' and report.author_id is not null then insert into community_private.removed_content(kind,target_id,report_id) values('profile',report.author_id,report.id) on conflict do nothing; end if;
  end if;
  update community_private.reports set status=case when outcome in ('remove','suspend') then 'removed' else 'dismissed' end,reviewed_at=now(),reviewed_by=viewer,review_note=note where id=report.id;
  insert into community_private.review_log(report_id,moderator_id,action,note) values(report.id,viewer,outcome,note);
  return jsonb_build_object('reviewed',true);
 end if;
 raise exception 'Unknown safety action' using errcode='22023';
end $$;
create function public.community_safety(action text,input jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select community_private.safety_command(action,input); $$;
revoke all on function public.community_safety(text,jsonb) from public,anon;
grant execute on function public.community_safety(text,jsonb) to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='community_private' and p.proname in ('blocked_between','viewer_blocked','content_allowed','profile_allowed','can_publish','assert_publication','publication_guard','social_delivery_guard','safety_command') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.proname in ('viewer_blocked','content_allowed','profile_allowed','can_publish','safety_command') then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;
