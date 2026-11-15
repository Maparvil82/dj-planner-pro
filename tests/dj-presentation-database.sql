BEGIN;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
('00000000-0000-4000-8000-000000000941','{"artist_name":"Presentation A"}'),
('00000000-0000-4000-8000-000000000942','{"artist_name":"Presentation B"}');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000941',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE saved jsonb; affected integer;
BEGIN
 saved := public.save_unified_profile('{"artist_name":"Presentation A","cover_url":"https://example.invalid/cover.jpg","mixcloud_url":"https://www.mixcloud.com/demo/","soundcloud_url":"https://soundcloud.com/demo","instagram_url":"https://instagram.com/demo","is_visible":true}');
 IF saved->'community'->>'cover_url' <> 'https://example.invalid/cover.jpg' THEN RAISE EXCEPTION 'Cover not saved'; END IF;
 PERFORM public.save_unified_profile('{"artist_name":"Presentation A","is_visible":true}');
 IF (SELECT mixcloud_url FROM public.community_profiles WHERE user_id=auth.uid()) <> 'https://www.mixcloud.com/demo/' THEN RAISE EXCEPTION 'Old client erased presentation'; END IF;
 BEGIN
  PERFORM public.save_unified_profile('{"artist_name":"Partial edit","instagram_url":"https://instagram.com.evil.test/demo","is_visible":true}');
  RAISE EXCEPTION 'Misleading host accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT artist_name FROM public.users_profile WHERE id=auth.uid()) <> 'Presentation A' THEN RAISE EXCEPTION 'Failed validation saved partial identity'; END IF;
 BEGIN
  UPDATE public.community_profiles SET mixcloud_url='javascript:alert(1)' WHERE user_id=auth.uid();
  RAISE EXCEPTION 'Unsafe direct write accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000942',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE affected integer;
BEGIN
 IF (SELECT cover_url FROM public.community_profiles WHERE user_id='00000000-0000-4000-8000-000000000941') <> 'https://example.invalid/cover.jpg' THEN RAISE EXCEPTION 'Visible presentation unreadable'; END IF;
 UPDATE public.community_profiles SET cover_url=null WHERE user_id='00000000-0000-4000-8000-000000000941';
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Other viewer edited cover'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000941',true);
SET LOCAL ROLE authenticated;
SELECT public.save_unified_profile('{"artist_name":"Presentation A","cover_url":null,"instagram_url":"","is_visible":false}');
DO $$ BEGIN
 IF (SELECT cover_url FROM public.community_profiles WHERE user_id=auth.uid()) IS NOT NULL OR
    (SELECT instagram_url FROM public.community_profiles WHERE user_id=auth.uid()) <> '' THEN RAISE EXCEPTION 'Clearing fields failed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000942',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.community_profiles WHERE user_id='00000000-0000-4000-8000-000000000941') THEN RAISE EXCEPTION 'Hidden presentation leaked'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: presentation save, atomic URL validation, old clients, public consent, clearing and ownership' as result;
ROLLBACK;
