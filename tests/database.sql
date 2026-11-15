-- Runs with the database owner through the SQL editor. All fixtures roll back.
BEGIN;
INSERT INTO auth.users (id, raw_user_meta_data) VALUES
    ('00000000-0000-4000-8000-000000000901', '{"artist_name":"DJ Planner test A"}'),
    ('00000000-0000-4000-8000-000000000902', '{"artist_name":"DJ Planner test B"}');
INSERT INTO public.sessions (user_id, date, title, venue, start_time, end_time)
VALUES ('00000000-0000-4000-8000-000000000902', '2026-10-02', 'Other owner fixture', 'Test venue', '22:00', '04:00');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000901', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    root public.sessions;
    affected integer;
BEGIN
    IF EXISTS (SELECT 1 FROM public.sessions WHERE user_id = '00000000-0000-4000-8000-000000000902') THEN
        RAISE EXCEPTION 'RLS exposed another owner';
    END IF;
    SELECT * INTO root FROM public.create_session_series(
        '{"date":"2026-10-02","title":"Series fixture","venue":"Test venue","start_time":"22:00","end_time":"04:00","earning_type":"fixed","earning_amount":300,"recurrence_type":"quarterly"}'::jsonb,
        ARRAY['2026-10-02','2027-01-02','2027-04-02']::date[]
    );
    IF root.user_id <> auth.uid() OR root.amount_paid <> 0 THEN RAISE EXCEPTION 'Incorrect owner or payment default'; END IF;
    IF (SELECT count(*) FROM public.sessions WHERE id = root.id OR parent_session_id = root.id) <> 3 THEN
        RAISE EXCEPTION 'Series incomplete';
    END IF;
    UPDATE public.sessions SET amount_paid = 100 WHERE id = root.id;
    IF (SELECT amount_paid FROM public.sessions WHERE id = root.id) <> 100 THEN RAISE EXCEPTION 'Payment update failed'; END IF;
    BEGIN
        UPDATE public.sessions SET amount_paid = -1 WHERE id = root.id;
        RAISE EXCEPTION 'Negative payment accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.sessions SET amount_paid = 'NaN'::numeric WHERE id = root.id;
        RAISE EXCEPTION 'NaN payment accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.sessions SET user_id = '00000000-0000-4000-8000-000000000902' WHERE id = root.id;
        RAISE EXCEPTION 'Ownership transfer accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE public.sessions SET amount_paid = 100 WHERE user_id = '00000000-0000-4000-8000-000000000902';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'Another owner could be updated'; END IF;

    INSERT INTO storage.objects (bucket_id, name) VALUES ('sessions', auth.uid()::text || '/permission-test.jpg');
    BEGIN
        INSERT INTO storage.objects (bucket_id, name) VALUES ('sessions', '00000000-0000-4000-8000-000000000902/permission-test.jpg');
        RAISE EXCEPTION 'Another owner folder accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM public.create_session_series('{"date":"2026-10-02"}', ARRAY['2026-10-02', NULL]::date[]);
        RAISE EXCEPTION 'Null occurrence accepted';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Invalid session dates' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;
SELECT 'PASS: series, payments, RLS and image ownership' AS result;
ROLLBACK;
