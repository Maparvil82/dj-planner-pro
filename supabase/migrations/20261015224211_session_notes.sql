-- Owner-only notes. Public/community/guest projections remain unchanged.
ALTER TABLE public.sessions ADD COLUMN notes text
    CONSTRAINT sessions_notes_length CHECK (char_length(notes) <= 5000);
COMMENT ON COLUMN public.sessions.notes IS 'Private owner notes. Never include in guest or community projections.';

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
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, event_type, notes
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid, nullif(input->>'booking_timezone',''),
        COALESCE(input->>'status', 'confirmed'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
        COALESCE((input->>'poster_focus_x')::double precision, 0.5), COALESCE((input->>'poster_focus_y')::double precision, 0.5), NULLIF(input->'fee_agreement','null'::jsonb), input->>'event_type', nullif(btrim(input->>'notes'), '')
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, event_type, notes, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.booking_timezone, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.poster_focus_x, first_session.poster_focus_y, first_session.fee_agreement, first_session.event_type, first_session.notes, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$function$
;


NOTIFY pgrst, 'reload schema';
