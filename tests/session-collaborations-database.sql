BEGIN;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
('00000000-0000-4000-8000-000000000951','{"artist_name":"Inviter"}'),
('00000000-0000-4000-8000-000000000952','{"artist_name":"Guest DJ"}'),
('00000000-0000-4000-8000-000000000953','{"artist_name":"Other DJ"}');
INSERT INTO public.community_profiles(user_id,artist_name,is_visible) VALUES
('00000000-0000-4000-8000-000000000951','Inviter',true),
('00000000-0000-4000-8000-000000000952','Guest DJ',true),
('00000000-0000-4000-8000-000000000953','Other DJ',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
SET LOCAL ROLE authenticated;
SELECT public.save_unified_profile('{"artist_name":"Inviter","genres":"house · HOUSE · HAuse · dnb","is_visible":true}');
DO $$ BEGIN
 IF (SELECT genres FROM public.community_profiles WHERE user_id=auth.uid()) <> 'House · Drum & Bass' THEN RAISE EXCEPTION 'Genres not canonical'; END IF;
 BEGIN
  PERFORM public.save_unified_profile('{"artist_name":"Partial","genres":"Invented style"}');
  RAISE EXCEPTION 'Unknown style permitted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT artist_name FROM public.users_profile WHERE id=auth.uid()) <> 'Inviter' THEN RAISE EXCEPTION 'Genre validation partial save'; END IF;
END $$;
INSERT INTO public.sessions(id,user_id,date,title,venue,start_time,end_time,status,earning_type,earning_amount,amount_paid,is_collective,djs,dj_profile_ids)
VALUES('00000000-0000-4000-8000-000000000961',auth.uid(),'2026-11-03','Joint set','Fixture venue','22:00','04:00','confirmed','fixed',991234,551234,true,ARRAY['Guest DJ','Private manual guest'],ARRAY['00000000-0000-4000-8000-000000000952'::uuid]);
INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000961',auth.uid());
DO $$ BEGIN
 IF (SELECT status FROM public.session_collaborators WHERE session_id='00000000-0000-4000-8000-000000000961') <> 'invited' THEN RAISE EXCEPTION 'No invitation created'; END IF;
 BEGIN
  UPDATE public.sessions SET dj_profile_ids=ARRAY['00000000-0000-4000-8000-000000000953'::uuid] WHERE id='00000000-0000-4000-8000-000000000961';
  RAISE EXCEPTION 'Hidden DJ invited';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.community_feed(false,'00000000-0000-4000-8000-000000000952')) THEN RAISE EXCEPTION 'Published before acceptance'; END IF;
 BEGIN
  UPDATE public.session_collaborators SET status='accepted' WHERE session_id='00000000-0000-4000-8000-000000000961';
  IF FOUND THEN RAISE EXCEPTION 'Owner answered for guest'; END IF;
 END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE item jsonb; BEGIN
 SELECT value INTO item FROM public.session_collaboration_inbox() AS value LIMIT 1;
 IF item->>'status' <> 'invited' THEN RAISE EXCEPTION 'Invitation invisible'; END IF;
 IF item::text like '%991234%' OR item::text like '%551234%' OR item::text like '%Private manual guest%' THEN RAISE EXCEPTION 'Private information leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.sessions WHERE id='00000000-0000-4000-8000-000000000961') THEN RAISE EXCEPTION 'Guest private session access'; END IF;
 UPDATE public.session_collaborators SET status='accepted' WHERE session_id='00000000-0000-4000-8000-000000000961';
 IF NOT EXISTS(SELECT 1 FROM public.community_feed(false,auth.uid())) THEN RAISE EXCEPTION 'Accepted session absent from public DJ page'; END IF;
 SELECT to_jsonb(card) INTO item FROM public.community_feed(false,auth.uid()) card LIMIT 1;
 IF item->'collaborators'->0->>'artist_name' <> 'Guest DJ' THEN RAISE EXCEPTION 'Public collaborator absent'; END IF;
 IF item::text like '%Private manual guest%' THEN RAISE EXCEPTION 'Private manual guest exposed'; END IF;
 BEGIN
  UPDATE public.session_collaborators SET inviter_id=auth.uid(); RAISE EXCEPTION 'Guest reassigns invitation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.community_profiles SET is_visible=false WHERE user_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.community_feed(false,auth.uid())) THEN RAISE EXCEPTION 'Hidden profile collaboration public'; END IF;
 IF (SELECT jsonb_array_length(collaborators) FROM public.community_feed() LIMIT 1) <> 0 THEN RAISE EXCEPTION 'Hidden public collaborator exposed'; END IF;
 UPDATE public.community_profiles SET is_visible=true WHERE user_id=auth.uid();
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
SET LOCAL ROLE authenticated;
UPDATE public.sessions SET title='Edited set' WHERE id='00000000-0000-4000-8000-000000000961';
DO $$ BEGIN
 IF (SELECT status FROM public.session_collaborators WHERE session_id='00000000-0000-4000-8000-000000000961') <> 'accepted' THEN RAISE EXCEPTION 'Edit reset consent'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000953',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.session_collaboration_inbox()) OR EXISTS(SELECT 1 FROM public.session_collaborators) THEN RAISE EXCEPTION 'Third party sees invitations'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000952',true);
SET LOCAL ROLE authenticated;
UPDATE public.session_collaborators SET status='declined' WHERE session_id='00000000-0000-4000-8000-000000000961';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.community_feed(false,auth.uid())) THEN RAISE EXCEPTION 'Declined session still public'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000951',true);
SET LOCAL ROLE authenticated;
UPDATE public.sessions SET dj_profile_ids='{}',djs='{}',is_collective=false WHERE id='00000000-0000-4000-8000-000000000961';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.session_collaborators WHERE session_id='00000000-0000-4000-8000-000000000961') THEN RAISE EXCEPTION 'Removed DJ keeps access'; END IF;
END $$;
SELECT public.create_session_series('{"date":"2026-11-10","title":"Series","venue":"Venue","start_time":"22:00","end_time":"04:00","is_collective":true,"djs":["Guest DJ"],"dj_profile_ids":["00000000-0000-4000-8000-000000000952"],"recurrence_type":"weekly","recurrence_end_date":"2026-11-17"}',ARRAY['2026-11-10'::date,'2026-11-17'::date]);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.session_collaborators) <> 2 THEN RAISE EXCEPTION 'Series invitations incomplete'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.session_collaboration_inbox(); RAISE EXCEPTION 'Anonymous inbox access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: canonical genres; invitations, consent, agenda projection, public opt-in, ownership, series and revocation' AS result;
ROLLBACK;
