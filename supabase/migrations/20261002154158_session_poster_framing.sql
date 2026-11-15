-- Frame metadata never modifies the original poster. All cards use the same aspect ratio.
ALTER TABLE public.sessions
    ADD COLUMN poster_focus_x double precision NOT NULL DEFAULT 0.5 CHECK (poster_focus_x BETWEEN 0 AND 1),
    ADD COLUMN poster_focus_y double precision NOT NULL DEFAULT 0.5 CHECK (poster_focus_y BETWEEN 0 AND 1);
CREATE INDEX sessions_owner_poster_idx ON public.sessions(user_id, poster_url) WHERE poster_url IS NOT NULL;

-- Inherit an existing image's frame for new/replaced session posters belonging to the same owner.
CREATE FUNCTION public.inherit_session_poster_frame() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved_x double precision; saved_y double precision;
BEGIN
    IF NEW.poster_url IS NULL THEN NEW.poster_focus_x := 0.5; NEW.poster_focus_y := 0.5; RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND NEW.poster_url IS NOT DISTINCT FROM OLD.poster_url THEN RETURN NEW; END IF;
    SELECT s.poster_focus_x, s.poster_focus_y INTO saved_x, saved_y
    FROM public.sessions s WHERE s.user_id = NEW.user_id AND s.poster_url = NEW.poster_url AND s.id <> NEW.id
    ORDER BY s.updated_at DESC, s.id LIMIT 1;
    IF FOUND THEN NEW.poster_focus_x := saved_x; NEW.poster_focus_y := saved_y; END IF;
    RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.inherit_session_poster_frame() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER inherit_session_poster_frame BEFORE INSERT OR UPDATE OF poster_url ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.inherit_session_poster_frame();

-- Same owner + same stored poster = one frame, including recurring occurrences. RLS still applies.
CREATE FUNCTION public.sync_session_poster_frame() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF pg_trigger_depth() > 1 OR NEW.poster_url IS NULL THEN RETURN NEW; END IF;
    UPDATE public.sessions SET poster_focus_x = NEW.poster_focus_x, poster_focus_y = NEW.poster_focus_y
    WHERE user_id = NEW.user_id AND poster_url = NEW.poster_url AND id <> NEW.id
      AND (poster_focus_x IS DISTINCT FROM NEW.poster_focus_x OR poster_focus_y IS DISTINCT FROM NEW.poster_focus_y);
    RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_session_poster_frame() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_session_poster_frame AFTER UPDATE OF poster_focus_x, poster_focus_y ON public.sessions
FOR EACH ROW WHEN (OLD.poster_focus_x IS DISTINCT FROM NEW.poster_focus_x OR OLD.poster_focus_y IS DISTINCT FROM NEW.poster_focus_y)
EXECUTE FUNCTION public.sync_session_poster_frame();

ALTER TYPE public.community_session_card ADD ATTRIBUTE poster_focus_x double precision;
ALTER TYPE public.community_session_card ADD ATTRIBUTE poster_focus_y double precision;

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
        recurrence_type, recurrence_end_date, venue_id, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid,
        COALESCE(input->>'status', 'pending'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
        COALESCE((input->>'poster_focus_x')::double precision, 0.5), COALESCE((input->>'poster_focus_y')::double precision, 0.5)
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.poster_focus_x, first_session.poster_focus_y, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session_series(jsonb, date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session_series(jsonb, date[]) TO authenticated;


create or replace function community_private.collaboration_inbox(page_offset integer)
returns setof jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('session_id',s.id,'dj_id',i.dj_id,'status',i.status,'inviter_id',i.inviter_id,
  'owner_name',coalesce(p.artist_name,'DJ'),'created_at',i.created_at,
  'session',jsonb_build_object('id',s.id,'user_id',s.user_id,'date',s.date,'title',s.title,'venue',s.venue,
   'start_time',s.start_time,'end_time',s.end_time,'color',s.color,'status',s.status,'poster_url',s.poster_url,'poster_focus_x',s.poster_focus_x,'poster_focus_y',s.poster_focus_y,
   'is_collective',true,'djs','[]'::jsonb,'earning_type','free','earning_amount',0,'currency',s.currency,
   'created_at',s.created_at,'updated_at',s.updated_at,'is_guest',true,'owner_name',coalesce(p.artist_name,'DJ')))
 from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id
 left join public.users_profile p on p.id=s.user_id
 where auth.uid() is not null and i.dj_id=auth.uid()
 order by i.created_at desc,i.session_id limit 1000 offset greatest(coalesce(page_offset,0),0);
$$;

create or replace function community_private.session_feed(only_following boolean, author uuid, page_offset integer, page_size integer)
returns setof public.community_session_card
language sql stable security definer set search_path = ''
as $$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y
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
