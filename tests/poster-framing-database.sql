BEGIN;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES
('00000000-0000-4000-8000-000000000990','{"artist_name":"Poster A"}'),
('00000000-0000-4000-8000-000000000991','{"artist_name":"Poster B"}');
INSERT INTO public.community_profiles(user_id,artist_name,is_visible) VALUES
('00000000-0000-4000-8000-000000000990','Poster A',true),
('00000000-0000-4000-8000-000000000991','Poster B',true);
INSERT INTO public.sessions(id,user_id,date,title,venue,start_time,end_time,status,poster_url) VALUES
('00000000-0000-4000-8000-000000000992','00000000-0000-4000-8000-000000000990','2026-10-20','Frame A','Club','22:00','04:00','confirmed','https://fixture.invalid/shared.jpg'),
('00000000-0000-4000-8000-000000000993','00000000-0000-4000-8000-000000000990','2026-10-21','Same poster','Club','22:00','04:00','confirmed','https://fixture.invalid/shared.jpg'),
('00000000-0000-4000-8000-000000000994','00000000-0000-4000-8000-000000000991','2026-10-20','Other owner','Club','22:00','04:00','confirmed','https://fixture.invalid/shared.jpg'),
('00000000-0000-4000-8000-000000000995','00000000-0000-4000-8000-000000000990','2026-10-22','Other image','Club','22:00','04:00','confirmed','https://fixture.invalid/other.jpg');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000990',true);
UPDATE public.sessions SET poster_focus_x=0.2,poster_focus_y=0.8 WHERE id='00000000-0000-4000-8000-000000000992';
DO $$ BEGIN
 IF (SELECT poster_focus_y FROM public.sessions WHERE id='00000000-0000-4000-8000-000000000993') <> 0.8 THEN RAISE EXCEPTION 'Frame not synchronized'; END IF;
 IF (SELECT poster_focus_y FROM public.sessions WHERE id='00000000-0000-4000-8000-000000000995') <> 0.5 THEN RAISE EXCEPTION 'Different poster modified'; END IF;
 BEGIN UPDATE public.sessions SET poster_focus_y=1.1 WHERE id='00000000-0000-4000-8000-000000000992'; RAISE EXCEPTION 'Invalid frame accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.sync_session_poster_frame(); RAISE EXCEPTION 'Internal trigger callable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT * FROM public.create_session_series('{"date":"2026-10-23","title":"Inherited frame","venue":"Club","start_time":"22:00","end_time":"04:00","poster_url":"https://fixture.invalid/shared.jpg"}',ARRAY['2026-10-23'::date]);
DO $$ BEGIN
 IF (SELECT poster_focus_y FROM public.sessions WHERE title='Inherited frame') <> 0.8 THEN RAISE EXCEPTION 'New occurrence lost stored frame'; END IF;
END $$;
SELECT * FROM public.create_session_series('{"date":"2026-10-24","title":"New framed series","venue":"Club","start_time":"22:00","end_time":"04:00","poster_url":"https://fixture.invalid/series.jpg","poster_focus_x":0.3,"poster_focus_y":0.9}',ARRAY['2026-10-24'::date,'2026-10-25'::date]);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.sessions WHERE title='New framed series' AND poster_focus_y=0.9 AND poster_focus_x=0.3) <> 2 THEN RAISE EXCEPTION 'Series lost initial frame'; END IF;
END $$;
INSERT INTO public.community_session_shares(session_id,user_id) VALUES('00000000-0000-4000-8000-000000000992',auth.uid());
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000991',true);
DO $$ DECLARE changed integer; card jsonb; BEGIN
 IF (SELECT poster_focus_y FROM public.sessions WHERE id='00000000-0000-4000-8000-000000000994') <> 0.5 THEN RAISE EXCEPTION 'Cross-owner frame synchronization'; END IF;
 UPDATE public.sessions SET poster_focus_y=0 WHERE id='00000000-0000-4000-8000-000000000992'; GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'Can change another owner frame'; END IF;
 SELECT to_jsonb(f) INTO card FROM public.community_feed(false,'00000000-0000-4000-8000-000000000990') f;
 IF (card->>'poster_focus_x')::numeric <> 0.2 OR (card->>'poster_focus_y')::numeric <> 0.8 THEN RAISE EXCEPTION 'Public cards lost frame'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
