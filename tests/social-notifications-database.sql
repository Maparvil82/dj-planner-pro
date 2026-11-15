BEGIN;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
('00000000-0000-4000-8000-000000000971','{"artist_name":"DJ One"}'),
('00000000-0000-4000-8000-000000000972','{"artist_name":"DJ Two"}'),
('00000000-0000-4000-8000-000000000973','{"artist_name":"DJ Three"}');
INSERT INTO public.community_profiles(user_id,artist_name,is_visible) VALUES
('00000000-0000-4000-8000-000000000971','DJ One',true),
('00000000-0000-4000-8000-000000000972','DJ Two',true),
('00000000-0000-4000-8000-000000000973','DJ Three',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000972',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.community_follows(follower_id,following_id) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000971');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000971',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.social_notifications WHERE kind='follow' and recipient_id=auth.uid() and actor_name='DJ Two') THEN RAISE EXCEPTION 'Follow notification absent'; END IF;
END $$;
INSERT INTO public.sessions(id,user_id,date,title,venue,start_time,end_time,status,is_collective,djs,dj_profile_ids,earning_amount,amount_paid)
VALUES('00000000-0000-4000-8000-000000000981',auth.uid(),'2026-11-15','Notification set','Venue','22:00','04:00','confirmed',true,ARRAY['DJ Two'],ARRAY['00000000-0000-4000-8000-000000000972'::uuid],991237,551237);
INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000981',auth.uid());
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000972',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE record jsonb; BEGIN
 IF (SELECT count(*) FROM public.social_notifications WHERE recipient_id=auth.uid()) <> 2 THEN RAISE EXCEPTION 'Invitation/publication notifications absent'; END IF;
 SELECT to_jsonb(n) INTO record FROM public.social_notifications n WHERE kind='session_invitation' LIMIT 1;
 IF record::text like '%991237%' OR record::text like '%551237%' THEN RAISE EXCEPTION 'Private finances in notification'; END IF;
 UPDATE public.social_notifications SET read_at=now() WHERE recipient_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.social_notifications WHERE recipient_id=auth.uid() AND read_at IS NULL) THEN RAISE EXCEPTION 'Read state not saved'; END IF;
 BEGIN UPDATE public.social_notifications SET actor_name='Forged'; RAISE EXCEPTION 'Client forges notification'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.social_notifications(recipient_id,actor_id,kind,actor_name) VALUES(auth.uid(),auth.uid(),'follow','Forged'); RAISE EXCEPTION 'Client creates notification'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.session_collaborators SET status='accepted' WHERE session_id='00000000-0000-4000-8000-000000000981';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000971',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.social_notifications WHERE kind='invitation_response' AND response='accepted') THEN RAISE EXCEPTION 'Response notification absent'; END IF;
END $$;
UPDATE public.sessions SET date='2026-11-16',status='cancelled' WHERE id='00000000-0000-4000-8000-000000000981';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000972',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.social_notifications WHERE kind='session_update' AND read_at IS NULL) THEN RAISE EXCEPTION 'Session update notification absent'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000973',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.social_notifications) THEN RAISE EXCEPTION 'Other user reads notifications'; END IF;
 UPDATE public.social_notifications SET read_at=now(); IF FOUND THEN RAISE EXCEPTION 'Other user marks notification'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.social_notifications; RAISE EXCEPTION 'Anonymous reads notifications'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: social event notifications, private data projection, read state, consent replies and recipient-only permissions' AS result;
ROLLBACK;
