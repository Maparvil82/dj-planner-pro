CREATE SCHEMA IF NOT EXISTS billing_private;
REVOKE ALL ON SCHEMA billing_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA billing_private TO service_role;
CREATE TABLE billing_private.subscription_access (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 pro_until timestamptz NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE billing_private.subscription_access ENABLE ROW LEVEL SECURITY;
GRANT ALL ON billing_private.subscription_access TO service_role;

CREATE FUNCTION public.sync_subscription_access(account_id uuid, valid_until timestamptz)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 INSERT INTO billing_private.subscription_access(user_id, pro_until, checked_at)
 VALUES(account_id, least(valid_until, now()+interval '5 minutes'), now())
 ON CONFLICT(user_id) DO UPDATE SET pro_until=excluded.pro_until, checked_at=excluded.checked_at;
$$;
REVOKE ALL ON FUNCTION public.sync_subscription_access(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_access(uuid,timestamptz) TO service_role;

CREATE FUNCTION public.get_session_usage()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid := auth.uid(); used bigint; pro boolean;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT count(*) INTO used FROM public.sessions WHERE user_id=owner_id;
 SELECT EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=owner_id AND pro_until>now()) INTO pro;
 RETURN jsonb_build_object('count',used,'limit',30,'isPro',pro,'remaining',greatest(30-used,0));
END; $$;
REVOKE ALL ON FUNCTION public.get_session_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_usage() TO authenticated;

-- This also covers legacy/direct inserts. The owner lock serializes simultaneous
-- creates. Multi-row statements roll back in full when any row exceeds the cap.
CREATE FUNCTION billing_private.enforce_session_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 301));
 IF EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=NEW.user_id AND pro_until>now()) THEN RETURN NEW; END IF;
 IF (SELECT count(*) FROM public.sessions WHERE user_id=NEW.user_id)>=30 THEN
  RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION billing_private.enforce_session_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_free_session_limit BEFORE INSERT ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION billing_private.enforce_session_limit();
-- Prevent an update from being used to transfer a session into another quota.
CREATE FUNCTION billing_private.keep_session_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Session owner cannot change'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION billing_private.keep_session_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER keep_session_owner BEFORE UPDATE OF user_id ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION billing_private.keep_session_owner();

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

    PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text, 301));
    IF NOT (public.get_session_usage()->>'isPro')::boolean
       AND (public.get_session_usage()->>'count')::bigint + cardinality(session_dates)>30 THEN
        RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
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
        COALESCE(input->>'status', 'confirmed'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
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
