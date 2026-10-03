-- All fixtures and subscription grants are rolled back.
BEGIN;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000981','{}'),('00000000-0000-4000-8000-000000000982','{}');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE input jsonb := '{"date":"2027-01-01","title":"Quota fixture","venue":"Test","start_time":"22:00","end_time":"04:00"}'; dates date[]; root public.sessions; usage jsonb;
BEGIN
 SELECT array_agg('2027-01-01'::date+n ORDER BY n) INTO dates FROM generate_series(0,28) n;
 SELECT * INTO root FROM public.create_session_series(input,dates);
 IF (public.get_session_usage()->>'count')::int<>29 THEN RAISE EXCEPTION 'Series count incorrect'; END IF;
 BEGIN
  PERFORM public.create_session_series(input,ARRAY['2027-01-01','2027-01-02']::date[]);
  RAISE EXCEPTION 'Overflow series accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'session_limit_reached' THEN RAISE; END IF; END;
 IF (public.get_session_usage()->>'count')::int<>29 THEN RAISE EXCEPTION 'Partial series persisted'; END IF;
 PERFORM public.create_session_series(input,ARRAY['2027-01-01']::date[]);
 IF (public.get_session_usage()->>'count')::int<>30 THEN RAISE EXCEPTION '30th session rejected'; END IF;
 BEGIN
  INSERT INTO public.sessions(user_id,date,title,venue,start_time,end_time) VALUES(auth.uid(),'2027-01-01','Direct bypass','Test','22:00','04:00');
  RAISE EXCEPTION 'Direct insert bypassed limit';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'session_limit_reached' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.sync_subscription_access(auth.uid(),now()+interval '1 year');
  RAISE EXCEPTION 'Client granted itself PRO';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.sessions SET status='cancelled',earning_amount=200 WHERE id=root.id;
 IF (public.get_session_usage()->>'count')::int<>30 THEN RAISE EXCEPTION 'Cancellation freed quota'; END IF;
 PERFORM public.delete_session_safely((SELECT id FROM public.sessions WHERE parent_session_id=root.id LIMIT 1),'single');
 PERFORM public.create_session_series(input,ARRAY['2027-01-01']::date[]);
 IF (public.get_session_usage()->>'count')::int<>30 THEN RAISE EXCEPTION 'Deleted space was not reusable'; END IF;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000982',true);
 IF (public.get_session_usage()->>'count')::int<>0 THEN RAISE EXCEPTION 'Count leaked another account'; END IF;
END $$;
RESET ROLE;
SELECT public.sync_subscription_access('00000000-0000-4000-8000-000000000981', now()+interval '1 year');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000981',true);
SET LOCAL ROLE authenticated;
SELECT public.create_session_series('{"date":"2027-01-01","title":"PRO fixture","venue":"Test","start_time":"22:00","end_time":"04:00"}',ARRAY['2027-01-01','2027-01-02']::date[]);
DO $$ BEGIN
 IF (public.get_session_usage()->>'count')::int<>32 OR NOT (public.get_session_usage()->>'isPro')::boolean THEN RAISE EXCEPTION 'Verified PRO was capped'; END IF;
END $$;
RESET ROLE;
SELECT public.sync_subscription_access('00000000-0000-4000-8000-000000000981',now()-interval '1 minute');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.create_session_series('{"date":"2027-01-01","title":"Expired fixture","venue":"Test","start_time":"22:00","end_time":"04:00"}',ARRAY['2027-01-01']::date[]);
  RAISE EXCEPTION 'Expired PRO bypassed cap';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'session_limit_reached' THEN RAISE; END IF; END;
 UPDATE public.sessions SET title='Still editable' WHERE user_id=auth.uid();
 IF (public.get_session_usage()->>'count')::int<>32 THEN RAISE EXCEPTION 'Existing sessions lost after expiry'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: 30th allowed, 31st blocked, atomic series, direct bypass blocked, no self-granted PRO, cancellation counts, deletion frees space, own count, paid unlimited, expired paid retains editable sessions' AS result;
ROLLBACK;
