-- New trials last exactly 15 days. Existing trial dates and sessions are preserved.
CREATE OR REPLACE FUNCTION public.get_session_usage()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE account uuid:=auth.uid(); used bigint;
BEGIN
 IF account IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT count(*) INTO used FROM public.sessions WHERE user_id=account;
 RETURN jsonb_build_object('count',used,'limit',15,'remaining',greatest(15-used,0)) || billing_private.pro_access_status();
END; $$;

CREATE OR REPLACE FUNCTION billing_private.activate_pro_trial()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE account uuid:=auth.uid();
BEGIN
 IF account IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF NOT account_private.active_user(account) THEN RAISE EXCEPTION 'trial.accountUnavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(account::text,301));
 -- Retries are idempotent; an expired trial is never restarted.
 IF EXISTS(SELECT 1 FROM billing_private.pro_trials WHERE user_id=account) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=account AND pro_until>now()) THEN
  RAISE EXCEPTION 'trial.alreadyPro';
 END IF;
 INSERT INTO billing_private.pro_trials(user_id,started_at,expires_at)
 VALUES(account,now(),now()+interval '360 hours');
END; $$;

CREATE OR REPLACE FUNCTION billing_private.enforce_session_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,301));
 IF EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=NEW.user_id AND pro_until>now())
  OR EXISTS(SELECT 1 FROM billing_private.pro_trials WHERE user_id=NEW.user_id AND expires_at>now()) THEN RETURN NEW; END IF;
 IF (SELECT count(*) FROM public.sessions WHERE user_id=NEW.user_id)>=15 THEN
  RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END; $$;

-- Recurrence uses the current server limit, not a separate hardcoded quota.
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
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid, nullif(input->>'booking_timezone',''),
        COALESCE(input->>'status', 'confirmed'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
        COALESCE((input->>'poster_focus_x')::double precision, 0.5), COALESCE((input->>'poster_focus_y')::double precision, 0.5), NULLIF(input->'fee_agreement','null'::jsonb)
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.booking_timezone, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.poster_focus_x, first_session.poster_focus_y, first_session.fee_agreement, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$function$
;
