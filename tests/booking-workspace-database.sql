-- Real-project regression checks. Every fixture, cache grant and notification is rolled back.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id IN ('00000000-0000-4000-8000-000000000991','00000000-0000-4000-8000-000000000992')) THEN RAISE EXCEPTION 'Fixture IDs are already in use'; END IF;
END $$;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000991','{"artist_name":"Booking fixture"}'),
 ('00000000-0000-4000-8000-000000000992','{"artist_name":"Other fixture"}');
INSERT INTO public.community_profiles(user_id,artist_name,is_visible) VALUES
 ('00000000-0000-4000-8000-000000000991','Booking fixture',true);
CREATE TEMP TABLE booking_fixture(key text PRIMARY KEY, value jsonb);
GRANT ALL ON booking_fixture TO authenticated,service_role;
SELECT public.sync_subscription_access('00000000-0000-4000-8000-000000000991',now()+interval '5 minutes');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000991',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.booking_dj_action('settings','{"slug":"booking-regression-fixture","enabled":false,"timezone":"Europe/Madrid","default_terms":"Equipment included"}');
 BEGIN
  PERFORM public.booking_dj_action('settings','{"slug":"booking-regression-fixture","enabled":true,"timezone":"Europe/Madrid","default_terms":""}');
  RAISE EXCEPTION 'Unconfigured public link was enabled';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'service_not_ready' THEN RAISE; END IF; END;
 IF has_function_privilege('authenticated','public.booking_guest_action(text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.booking_guest_action(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Guest RPC publicly exposed'; END IF;
 BEGIN
  PERFORM * FROM booking_private.guest_access;
  RAISE EXCEPTION 'Private tokens exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT public.booking_set_ready(true);
SET LOCAL ROLE authenticated;
SELECT public.booking_dj_action('settings','{"slug":"booking-regression-fixture","enabled":true,"timezone":"Europe/Madrid","default_terms":""}');
RESET ROLE;
SET LOCAL ROLE service_role;
INSERT INTO booking_fixture VALUES('request',public.booking_guest_action('request','{"slug":"booking-regression-fixture","submission_key":"00000000-0000-4000-8000-000000000997","promoter_name":"Fixture promoter","promoter_email":"fixture@example.invalid","event_title":"Fixture night","venue":"Fixture club","city":"Madrid","date":"2027-06-01","start_time":"22:00","end_time":"04:00","budget":500,"currency":"EUR","language":"es","body":"Equipment included","token":"fixture-token-not-used-for-http","token_hash":"booking-regression-hash"}'));
DO $$ DECLARE r jsonb; BEGIN
 SELECT value INTO r FROM booking_fixture WHERE key='request';
 BEGIN
  PERFORM public.booking_guest_action('read',jsonb_build_object('id',r->>'id','token_hash','wrong'));
  RAISE EXCEPTION 'Invalid access was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'access_expired' THEN RAISE; END IF; END;
 PERFORM public.booking_guest_action('verify',jsonb_build_object('id',r->>'id','token_hash','booking-regression-hash'));
 PERFORM public.booking_guest_action('verify',jsonb_build_object('id',r->>'id','token_hash','booking-regression-hash'));
 IF (SELECT count(*) FROM public.social_notifications WHERE booking_id=(r->>'id')::uuid AND kind='booking_request')<>1 THEN RAISE EXCEPTION 'Verification notification duplicated'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; first jsonb; latest jsonb; BEGIN
 SELECT value INTO r FROM booking_fixture WHERE key='request';
 first:=public.booking_dj_action('propose',jsonb_build_object('id',r->>'id','event_title','Fixture night','venue','Fixture club','city','Madrid','date','2027-06-01','start_time','22:00','end_time','04:00','fee',600,'currency','EUR','terms','Transport included','expires_hours',48,'hold',true));
 INSERT INTO booking_fixture VALUES('first',first);
 BEGIN
  INSERT INTO public.sessions(user_id,date,title,venue,start_time,end_time) VALUES(auth.uid(),'2027-06-02','Clash fixture','Test','02:00','05:00');
  RAISE EXCEPTION 'Overnight hold bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'booking_hold_conflict' THEN RAISE; END IF; END;
 latest:=public.booking_dj_action('propose',jsonb_build_object('id',r->>'id','event_title','Fixture night','venue','Fixture club','city','Madrid','date','2027-06-01','start_time','22:00','end_time','04:00','fee',750,'currency','EUR','terms','Equipment and transport included','expires_hours',48,'hold',true));
 IF jsonb_array_length(latest->'proposals')<>2 THEN RAISE EXCEPTION 'Proposal history lost'; END IF;
 INSERT INTO booking_fixture VALUES('latest',latest);
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000992',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.booking_requests) THEN RAISE EXCEPTION 'Another DJ saw a private request'; END IF;
 BEGIN
  PERFORM public.booking_dj_action('read',jsonb_build_object('id',(SELECT value->>'id' FROM booking_fixture WHERE key='request')));
  RAISE EXCEPTION 'Another DJ opened private conversation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request_not_found' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE service_role;
DO $$ DECLARE r jsonb; first jsonb; latest jsonb; result jsonb; repeated jsonb; BEGIN
 SELECT value INTO r FROM booking_fixture WHERE key='request';
 SELECT value INTO first FROM booking_fixture WHERE key='first';
 SELECT value INTO latest FROM booking_fixture WHERE key='latest';
 BEGIN
  PERFORM public.booking_guest_action('accept',jsonb_build_object('id',r->>'id','token_hash','booking-regression-hash','proposal_id',first->'request'->>'latest_proposal_id'));
  RAISE EXCEPTION 'Old proposal was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'proposal_changed' THEN RAISE; END IF; END;
 result:=public.booking_guest_action('accept',jsonb_build_object('id',r->>'id','token_hash','booking-regression-hash','proposal_id',latest->'request'->>'latest_proposal_id'));
 repeated:=public.booking_guest_action('accept',jsonb_build_object('id',r->>'id','token_hash','booking-regression-hash','proposal_id',latest->'request'->>'latest_proposal_id'));
 IF result->'request'->>'state'<>'accepted' OR result->'request'->>'session_id' IS NULL THEN RAISE EXCEPTION 'Agreement not finalized'; END IF;
 IF repeated->'request'->>'session_id' IS DISTINCT FROM result->'request'->>'session_id' THEN RAISE EXCEPTION 'Double acceptance duplicated session'; END IF;
 IF (SELECT count(*) FROM public.sessions WHERE user_id=(r->>'owner_id')::uuid)<>1 THEN RAISE EXCEPTION 'Unexpected session count'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=(result->'request'->>'session_id')::uuid AND status='confirmed' AND earning_amount=750 AND amount_paid=0 AND booking_timezone='Europe/Madrid') THEN RAISE EXCEPTION 'Session terms mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.community_session_shares WHERE session_id=(result->'request'->>'session_id')::uuid) THEN RAISE EXCEPTION 'Private agreement published'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.social_notifications WHERE booking_id=(r->>'id')::uuid AND kind='booking_confirmed') THEN RAISE EXCEPTION 'Confirmation notification absent'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: settings, unpublished gate, RPC permissions, private tokens, verified email, one notification, own access, overnight holds, version history, latest version, one accepted session, fee, unpaid amount, timezone, privacy and confirmation notification. All fixtures rolled back.' AS result;
ROLLBACK;
