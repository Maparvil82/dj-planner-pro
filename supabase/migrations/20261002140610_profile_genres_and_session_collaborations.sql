-- Canonical musical styles, retaining legacy values already saved by the owner.
create function community_private.normalize_profile_genres()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare token text; canonical text; result text[] := '{}'; legacy text[] := '{}';
begin
    if TG_OP = 'UPDATE' then legacy := regexp_split_to_array(old.genres, '[,·;|]'); end if;
    foreach token in array regexp_split_to_array(new.genres, '[,·;|]') loop
        token := btrim(token); if token = '' then continue; end if;
        select label into canonical from (values ('house','House'),
('deep house','Deep House'),
('tech house','Tech House'),
('progressive house','Progressive House'),
('afro house','Afro House'),
('organic house','Organic House'),
('melodic house','Melodic House'),
('disco house','Disco House'),
('soulful house','Soulful House'),
('techno','Techno'),
('melodic techno','Melodic Techno'),
('hard techno','Hard Techno'),
('minimal','Minimal'),
('trance','Trance'),
('progressive trance','Progressive Trance'),
('psytrance','Psytrance'),
('drum & bass','Drum & Bass'),
('jungle','Jungle'),
('dubstep','Dubstep'),
('uk garage','UK Garage'),
('bass house','Bass House'),
('breakbeat','Breakbeat'),
('electro','Electro'),
('electronica','Electronica'),
('ambient','Ambient'),
('downtempo','Downtempo'),
('disco','Disco'),
('nu disco','Nu Disco'),
('funk','Funk'),
('soul','Soul'),
('hip hop','Hip Hop'),
('r&b','R&B'),
('reggaeton','Reggaeton'),
('afrobeats','Afrobeats'),
('dancehall','Dancehall'),
('latin','Latin'),
('salsa','Salsa'),
('bachata','Bachata'),
('pop','Pop'),
('rock','Rock'),
('indie dance','Indie Dance'),
('dance','Dance'),
('edm','EDM'),
('hardstyle','Hardstyle'),
('hardcore','Hardcore'),
('open format','Open Format'),
('hause','House'),
('haus','House'),
('dnb','Drum & Bass'),
('drum and bass','Drum & Bass'),
('drum n bass','Drum & Bass'),
('hip-hop','Hip Hop'),
('hiphop','Hip Hop'),
('rnb','R&B'),
('r and b','R&B'),
('reggaetón','Reggaeton'),
('regueton','Reggaeton'),
('nu-disco','Nu Disco'),
('tech-house','Tech House'),
('deep-house','Deep House')) as catalog(alias,label)
          where alias = lower(regexp_replace(token, '\s+', ' ', 'g')) limit 1;
        if canonical is null then
            if TG_OP = 'UPDATE' and exists(select 1 from unnest(legacy) v where btrim(v)=token) then canonical := token;
            else raise exception 'Choose a musical style from the catalogue' using errcode='22023'; end if;
        end if;
        if not canonical = any(result) then result := array_append(result,canonical); end if;
    end loop;
    new.genres := array_to_string(result, ' · '); return new;
end;
$$;
revoke all on function community_private.normalize_profile_genres() from public, anon, authenticated;
create trigger normalize_profile_genres before insert or update of genres on public.community_profiles
for each row execute function community_private.normalize_profile_genres();
update public.community_profiles set genres=genres;

alter table public.sessions add column dj_profile_ids uuid[] not null default '{}';
alter table public.sessions add constraint session_dj_profile_ids_limit check (cardinality(dj_profile_ids) <= 20 and array_position(dj_profile_ids,null) is null);
create table public.session_collaborators (
    session_id uuid not null references public.sessions(id) on delete cascade,
    dj_id uuid not null references auth.users(id) on delete cascade,
    inviter_id uuid not null references auth.users(id) on delete cascade,
    artist_name text not null,
    status text not null default 'invited' check(status in ('invited','accepted','declined')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key(session_id,dj_id), check(dj_id <> inviter_id)
);
alter table public.session_collaborators enable row level security;
revoke all on public.session_collaborators from public, anon, authenticated;
grant select on public.session_collaborators to authenticated;
grant update(status) on public.session_collaborators to authenticated;
create policy session_collaborators_read on public.session_collaborators for select to authenticated
using(dj_id=(select auth.uid()) or inviter_id=(select auth.uid()));
create policy session_collaborators_reply on public.session_collaborators for update to authenticated
using(dj_id=(select auth.uid())) with check(dj_id=(select auth.uid()) and status in ('accepted','declined'));
create index session_collaborators_dj_status_idx on public.session_collaborators(dj_id,status,session_id);
create index session_collaborators_inviter_idx on public.session_collaborators(inviter_id,session_id);

-- Internal trigger is the sole invitation creator. It validates visible targets and preserves responses on ordinary edits.
create function community_private.sync_session_collaborators()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
    if auth.uid() is not null and auth.uid() <> new.user_id then raise exception 'Session owner required' using errcode='42501'; end if;
    if not new.is_collective and cardinality(new.dj_profile_ids)>0 then raise exception 'Collective session required' using errcode='22023'; end if;
    if (select count(distinct id) from unnest(new.dj_profile_ids) id) <> cardinality(new.dj_profile_ids) then raise exception 'Duplicate DJ' using errcode='22023'; end if;
    foreach target in array new.dj_profile_ids loop
        if target=new.user_id then raise exception 'Cannot invite yourself' using errcode='22023'; end if;
        if not exists(select 1 from public.session_collaborators where session_id=new.id and dj_id=target)
            and not exists(select 1 from public.community_profiles where user_id=target and is_visible) then
            raise exception 'DJ profile unavailable' using errcode='22023';
        end if;
        insert into public.session_collaborators(session_id,dj_id,inviter_id,artist_name) select new.id,target,new.user_id,p.artist_name from public.community_profiles p where p.user_id=target on conflict do nothing;
    end loop;
    delete from public.session_collaborators where session_id=new.id and not dj_id=any(new.dj_profile_ids);
    return new;
end;
$$;
revoke all on function community_private.sync_session_collaborators() from public, anon, authenticated;
create trigger sync_session_collaborators after insert or update of dj_profile_ids,is_collective on public.sessions
for each row execute function community_private.sync_session_collaborators();

-- Invitation/agenda projection deliberately omits finances, private guest names, venue notes and account details.
create function community_private.collaboration_inbox(page_offset integer)
returns setof jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('session_id',s.id,'dj_id',i.dj_id,'status',i.status,'inviter_id',i.inviter_id,
  'owner_name',coalesce(p.artist_name,'DJ'),'created_at',i.created_at,
  'session',jsonb_build_object('id',s.id,'user_id',s.user_id,'date',s.date,'title',s.title,'venue',s.venue,
   'start_time',s.start_time,'end_time',s.end_time,'color',s.color,'status',s.status,'poster_url',s.poster_url,
   'is_collective',true,'djs','[]'::jsonb,'earning_type','free','earning_amount',0,'currency',s.currency,
   'created_at',s.created_at,'updated_at',s.updated_at,'is_guest',true,'owner_name',coalesce(p.artist_name,'DJ')))
 from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id
 left join public.users_profile p on p.id=s.user_id
 where auth.uid() is not null and i.dj_id=auth.uid()
 order by i.created_at desc,i.session_id limit 1000 offset greatest(coalesce(page_offset,0),0);
$$;
revoke all on function community_private.collaboration_inbox(integer) from public,anon;
grant execute on function community_private.collaboration_inbox(integer) to authenticated;
create function public.session_collaboration_inbox(page_offset integer default 0)
returns setof jsonb language sql stable security invoker set search_path = '' as $$ select * from community_private.collaboration_inbox(page_offset); $$;
revoke all on function public.session_collaboration_inbox(integer) from public,anon;
grant execute on function public.session_collaboration_inbox(integer) to authenticated;

CREATE OR REPLACE FUNCTION public.create_session_series(input jsonb, session_dates date[])
RETURNS SETOF public.sessions
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    owner_id uuid := auth.uid();
    first_session public.sessions;
BEGIN
    IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF session_dates IS NULL OR cardinality(session_dates) NOT BETWEEN 1 AND 500
       OR session_dates[1] IS DISTINCT FROM (input->>'date')::date
       OR array_position(session_dates, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid session dates';
    END IF;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, status, poster_url, dj_profile_ids
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid,
        COALESCE(input->>'status', 'pending'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid)
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, status, poster_url, dj_profile_ids, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session_series(jsonb, date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session_series(jsonb, date[]) TO authenticated;

alter type public.community_session_card add attribute collaborators jsonb;
create or replace function community_private.session_feed(only_following boolean, author uuid, page_offset integer, page_size integer)
returns setof public.community_session_card
language sql stable security definer set search_path = ''
as $$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb)
    from public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and s.status = 'confirmed'
      and (author is null or s.user_id = author or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=author))
      and (not coalesce(only_following, false) or exists (
        select 1 from public.community_follows f where f.follower_id = (select auth.uid()) and (f.following_id = s.user_id or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=f.following_id))
      ))
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$$;
