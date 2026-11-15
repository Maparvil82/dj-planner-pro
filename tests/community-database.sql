-- Owner-only test harness. Temporary users and all writes are rolled back.
BEGIN;
INSERT INTO auth.users (id, raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000904', '{"artist_name":"Community A"}'),
 ('00000000-0000-4000-8000-000000000905', '{"artist_name":"Community B"}'),
 ('00000000-0000-4000-8000-000000000906', '{"artist_name":"Hidden C"}');
INSERT INTO public.community_profiles (user_id, artist_name, is_visible) VALUES
 ('00000000-0000-4000-8000-000000000904','Community A',true),
 ('00000000-0000-4000-8000-000000000905','Community B',true),
 ('00000000-0000-4000-8000-000000000906','Hidden C',false);
INSERT INTO public.sessions (id, user_id, date, title, venue, start_time, end_time, status, earning_amount, amount_paid, djs) VALUES
 ('00000000-0000-4000-8000-000000000914','00000000-0000-4000-8000-000000000904','2026-10-20','A shared','Venue','22:00','04:00','confirmed',991237,551234,ARRAY['Private guest']),
 ('00000000-0000-4000-8000-000000000915','00000000-0000-4000-8000-000000000905','2026-10-21','B shared','Venue','22:00','04:00','confirmed',991237,551234,ARRAY['Private guest']),
 ('00000000-0000-4000-8000-000000000916','00000000-0000-4000-8000-000000000905','2026-10-22','B private','Venue','22:00','04:00','confirmed',0,0,ARRAY[]::text[]),
 ('00000000-0000-4000-8000-000000000917','00000000-0000-4000-8000-000000000905','2026-10-23','B pending','Venue','22:00','04:00','pending',0,0,ARRAY[]::text[]),
 ('00000000-0000-4000-8000-000000000918','00000000-0000-4000-8000-000000000906','2026-10-24','C hidden','Venue','22:00','04:00','confirmed',0,0,ARRAY[]::text[]);
-- Fixture for consent retained when a profile is subsequently hidden.
INSERT INTO public.community_session_shares (session_id,user_id) VALUES ('00000000-0000-4000-8000-000000000918','00000000-0000-4000-8000-000000000906');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000905',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.community_session_shares (session_id,user_id) VALUES ('00000000-0000-4000-8000-000000000915',auth.uid());
DO $$ BEGIN
 BEGIN
  INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000917',auth.uid());
  RAISE EXCEPTION 'Pending session published';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000904',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000914',auth.uid());
DO $$
DECLARE count_rows integer; card jsonb;
BEGIN
 IF (SELECT count(*) FROM public.community_feed(false,'00000000-0000-4000-8000-000000000904')) <> 1 OR (SELECT count(*) FROM public.community_feed(false,'00000000-0000-4000-8000-000000000905')) <> 1 OR EXISTS(SELECT 1 FROM public.community_feed(false,'00000000-0000-4000-8000-000000000906')) THEN RAISE EXCEPTION 'Feed consent filtering incorrect'; END IF;
 IF EXISTS(SELECT 1 FROM public.sessions WHERE user_id <> auth.uid()) THEN RAISE EXCEPTION 'Private sessions exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.users_profile WHERE id <> auth.uid()) THEN RAISE EXCEPTION 'Private account profile exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.community_profiles WHERE artist_name='Hidden C') THEN RAISE EXCEPTION 'Hidden profile exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.community_session_shares WHERE user_id <> auth.uid()) THEN RAISE EXCEPTION 'Private sharing ledger exposed'; END IF;
 SELECT to_jsonb(f) INTO card FROM public.community_feed(false,'00000000-0000-4000-8000-000000000904') f LIMIT 1;
 IF card ?| ARRAY['earning_amount','amount_paid','currency','djs','notes','contact_info','email','venue_id','recurrence_type'] THEN RAISE EXCEPTION 'Sensitive field exposed'; END IF;
 IF (select count(*) from jsonb_object_keys(card)) <> 15 THEN RAISE EXCEPTION 'Unexpected feed projection'; END IF;
 BEGIN
  INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000916',auth.uid());
  RAISE EXCEPTION 'Another owner session published';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.community_follows(follower_id,following_id) VALUES('00000000-0000-4000-8000-000000000905',auth.uid());
  RAISE EXCEPTION 'Follow impersonation accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.community_follows(follower_id,following_id) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000906');
  RAISE EXCEPTION 'Hidden profile followed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.community_profiles SET user_id='00000000-0000-4000-8000-000000000907' WHERE user_id=auth.uid();
  RAISE EXCEPTION 'Profile ownership transfer accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.community_profiles SET bio='hacked' WHERE user_id='00000000-0000-4000-8000-000000000905';
 GET DIAGNOSTICS count_rows=ROW_COUNT;
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Other profile edited'; END IF;
 DELETE FROM public.community_session_shares WHERE user_id='00000000-0000-4000-8000-000000000905';
 GET DIAGNOSTICS count_rows=ROW_COUNT;
 IF count_rows <> 0 THEN RAISE EXCEPTION 'Other share deleted'; END IF;
 IF EXISTS(SELECT 1 FROM public.community_feed(true)) THEN RAISE EXCEPTION 'Unfollowed feed not empty'; END IF;
 INSERT INTO public.community_follows(follower_id,following_id) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000905');
 IF (SELECT count(*) FROM public.community_feed(true)) <> 1 THEN RAISE EXCEPTION 'Following feed incorrect'; END IF;
 IF (SELECT count(*) FROM public.community_feed(false,'00000000-0000-4000-8000-000000000905')) <> 1 THEN RAISE EXCEPTION 'Profile feed incorrect'; END IF;
 DELETE FROM public.community_follows WHERE follower_id=auth.uid();
 IF EXISTS(SELECT 1 FROM public.community_feed(true)) THEN RAISE EXCEPTION 'Unfollow failed'; END IF;
 DELETE FROM public.community_session_shares WHERE session_id='00000000-0000-4000-8000-000000000914';
 IF EXISTS(SELECT 1 FROM public.community_feed(false,'00000000-0000-4000-8000-000000000904')) OR (SELECT count(*) FROM public.community_feed(false,'00000000-0000-4000-8000-000000000905')) <> 1 THEN RAISE EXCEPTION 'Unpublish failed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000905',true);
SET LOCAL ROLE authenticated;
UPDATE public.sessions SET title='Updated title' WHERE id='00000000-0000-4000-8000-000000000915';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.community_feed(false,auth.uid()) WHERE title='Updated title') THEN RAISE EXCEPTION 'Published session stale'; END IF;
END $$;
UPDATE public.sessions SET status='cancelled' WHERE id='00000000-0000-4000-8000-000000000915';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.community_feed(false,auth.uid())) THEN RAISE EXCEPTION 'Cancelled session still visible'; END IF; END $$;
UPDATE public.sessions SET status='confirmed' WHERE id='00000000-0000-4000-8000-000000000915';
UPDATE public.community_profiles SET is_visible=false WHERE user_id=auth.uid();
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.community_feed(false,auth.uid())) THEN RAISE EXCEPTION 'Hidden profile sessions still visible'; END IF; END $$;
DELETE FROM public.sessions WHERE id='00000000-0000-4000-8000-000000000915';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.community_session_shares) THEN RAISE EXCEPTION 'Share not cascaded'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.community_feed()) THEN RAISE EXCEPTION 'Missing auth accepted by feed'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM public.community_feed(); RAISE EXCEPTION 'Anonymous feed exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.community_profiles; RAISE EXCEPTION 'Anonymous profiles exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: opt-in, safe projection, sharing ownership, following, update/cancel/hide/delete and anonymous denial' AS result;
ROLLBACK;
