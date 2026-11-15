-- Optional classification; legacy sessions keep NULL and existing row permissions.
ALTER TABLE public.sessions ADD COLUMN event_type text
    CHECK (event_type IN ('club', 'festival', 'wedding', 'corporate', 'residency'));
COMMENT ON COLUMN public.sessions.event_type IS 'Optional event format selected by the DJ, independent of recurrence.';

-- Persist the same classification on every occurrence in the existing atomic operation.
CREATE OR REPLACE FUNCTION public.create_session_series(input jsonb, session_dates date[])
 RETURNS SETOF sessions
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

    PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text, 301));
    IF NOT (public.get_session_usage()->>'isPro')::boolean
       AND (public.get_session_usage()->>'count')::bigint + cardinality(session_dates)>(public.get_session_usage()->>'limit')::bigint THEN
        RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, event_type
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid, nullif(input->>'booking_timezone',''),
        COALESCE(input->>'status', 'confirmed'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
        COALESCE((input->>'poster_focus_x')::double precision, 0.5), COALESCE((input->>'poster_focus_y')::double precision, 0.5), NULLIF(input->'fee_agreement','null'::jsonb), input->>'event_type'
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, event_type, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.booking_timezone, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.poster_focus_x, first_session.poster_focus_y, first_session.fee_agreement, first_session.event_type, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$function$
;

-- Retain the existing safe guest projection and account-blocking checks.
CREATE OR REPLACE FUNCTION community_private.collaboration_inbox(page_offset integer)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('session_id',s.id,'dj_id',i.dj_id,'status',i.status,'inviter_id',i.inviter_id,
  'owner_name',coalesce(p.artist_name,'DJ'),'created_at',i.created_at,
  'session',jsonb_build_object('id',s.id,'user_id',s.user_id,'date',s.date,'title',s.title,'event_type',s.event_type,'venue',s.venue,'venue_city',s.venue_city,'venue_city_location',s.venue_city_location,'venue_address',s.venue_address,'booking_timezone',s.booking_timezone,
   'start_time',s.start_time,'end_time',s.end_time,'color',s.color,'status',s.status,'poster_url',s.poster_url,'poster_focus_x',s.poster_focus_x,'poster_focus_y',s.poster_focus_y,
   'is_collective',true,'djs','[]'::jsonb,'earning_type','free','earning_amount',0,'currency',s.currency,
   'created_at',s.created_at,'updated_at',s.updated_at,'is_guest',true,'owner_name',coalesce(p.artist_name,'DJ')))
 from (select * from public.session_collaborators where status='accepted' or not community_private.blocked_between(auth.uid(),inviter_id)) i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id
 left join public.users_profile p on p.id=s.user_id
 where auth.uid() is not null and i.dj_id=auth.uid()
 order by i.created_at desc,i.session_id limit 1000 offset greatest(coalesce(page_offset,0),0);
$function$
;


NOTIFY pgrst, 'reload schema';
