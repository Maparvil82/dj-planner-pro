BEGIN;
INSERT INTO auth.users (id,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000924','{"artist_name":"Account A"}'),
 ('00000000-0000-4000-8000-000000000925','{"artist_name":"Account B"}');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000925',true);
SET LOCAL ROLE authenticated;
SELECT public.save_unified_profile('{"artist_name":"DJ B","city":"Madrid","genres":"House","bio":"Other account","is_visible":true}');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000924',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; affected integer;
BEGIN
 result := public.save_unified_profile('{"artist_name":"  DJ Unified  ","city":" Valencia ","genres":"Techno","bio":"DJ biography"}');
 IF result->'profile'->>'id' <> auth.uid()::text THEN RAISE EXCEPTION 'Wrong owner returned'; END IF;
 IF (SELECT artist_name FROM public.users_profile WHERE id=auth.uid()) <> 'DJ Unified' OR
    (SELECT artist_name FROM public.community_profiles WHERE user_id=auth.uid()) <> 'DJ Unified' THEN RAISE EXCEPTION 'Identity not unified'; END IF;
 IF (SELECT city FROM public.community_profiles WHERE user_id=auth.uid()) <> 'Valencia' THEN RAISE EXCEPTION 'City not preserved'; END IF;
 IF (SELECT is_visible FROM public.community_profiles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Implicit publication'; END IF;
 BEGIN
  UPDATE public.community_profiles SET artist_name='Second identity' WHERE user_id=auth.uid();
  RAISE EXCEPTION 'Independent identity accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.community_profiles SET avatar_url='https://example.invalid/other.jpg' WHERE user_id=auth.uid();
  RAISE EXCEPTION 'Independent avatar accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.users_profile SET avatar_url='https://example.invalid/account.jpg' WHERE id=auth.uid();
 IF (SELECT avatar_url FROM public.community_profiles WHERE user_id=auth.uid()) <> 'https://example.invalid/account.jpg' THEN RAISE EXCEPTION 'Avatar not synchronized'; END IF;
 IF (SELECT bio FROM public.community_profiles WHERE user_id=auth.uid()) <> 'DJ biography' THEN RAISE EXCEPTION 'Avatar edit lost biography'; END IF;
 BEGIN
  PERFORM public.save_unified_profile(jsonb_build_object('artist_name','Must roll back','bio',repeat('X',501)));
  RAISE EXCEPTION 'Invalid biography accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT artist_name FROM public.users_profile WHERE id=auth.uid()) <> 'DJ Unified' OR
    (SELECT artist_name FROM public.community_profiles WHERE user_id=auth.uid()) <> 'DJ Unified' THEN RAISE EXCEPTION 'Partial save after validation failure'; END IF;
 BEGIN
  PERFORM public.save_unified_profile('{"artist_name":"  "}');
  RAISE EXCEPTION 'Blank name accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM public.save_unified_profile('{"user_id":"00000000-0000-4000-8000-000000000925","artist_name":"DJ Unified","city":"Valencia","bio":"DJ biography","genres":"Techno","is_visible":true,"avatar_url":"https://example.invalid/account.jpg"}');
 IF (SELECT artist_name FROM public.community_profiles WHERE user_id='00000000-0000-4000-8000-000000000925') <> 'DJ B' THEN RAISE EXCEPTION 'RPC impersonation accepted'; END IF;
 INSERT INTO public.community_follows(follower_id,following_id) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000925');
 INSERT INTO public.sessions(id,user_id,date,title,venue,start_time,end_time,status) VALUES('00000000-0000-4000-8000-000000000934',auth.uid(),'2026-10-30','Shared fixture','Test venue','22:00','04:00','confirmed');
 INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000934',auth.uid());
 PERFORM public.save_unified_profile('{"artist_name":"Updated DJ","city":"Valencia","bio":"DJ biography","genres":"Techno","is_visible":true,"avatar_url":"https://example.invalid/account.jpg"}');
 IF NOT EXISTS(SELECT 1 FROM public.community_feed() WHERE session_id='00000000-0000-4000-8000-000000000934' AND artist_name='Updated DJ') THEN RAISE EXCEPTION 'Shared identity stale or share lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.community_follows WHERE follower_id=auth.uid()) THEN RAISE EXCEPTION 'Following lost'; END IF;
 BEGIN PERFORM community_private.sync_profile_identity(); RAISE EXCEPTION 'Internal trigger callable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.save_unified_profile('{"artist_name":"Anonymous"}'); RAISE EXCEPTION 'Anonymous save permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'PASS: single identity, avatar synchronization, atomic save, opt-in, privacy, ownership and preserved follows/shares' as result;
ROLLBACK;
