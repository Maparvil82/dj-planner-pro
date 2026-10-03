-- Isolated fixtures: every deletion and insert below rolls back.
BEGIN;
INSERT INTO auth.users (id,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000961','{}'),('00000000-0000-4000-8000-000000000962','{}');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000961',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE root public.sessions; replacement public.sessions; second_root public.sessions; independent public.sessions; selected_child uuid; deleted integer;
BEGIN
 SELECT * INTO root FROM public.create_session_series('{"date":"2026-10-02","title":"Same title","venue":"Test venue","start_time":"22:00","end_time":"04:00","earning_type":"fixed","earning_amount":300,"recurrence_type":"weekly","recurrence_end_date":"2026-10-30"}'::jsonb,ARRAY['2026-10-02','2026-10-09','2026-10-16','2026-10-23']::date[]);
 SELECT * INTO second_root FROM public.create_session_series('{"date":"2026-10-02","title":"Same title","venue":"Test venue","start_time":"22:00","end_time":"04:00","earning_type":"fixed","earning_amount":300,"recurrence_type":"weekly"}'::jsonb,ARRAY['2026-10-02','2026-10-09']::date[]);
 SELECT * INTO independent FROM public.create_session_series('{"date":"2026-10-02","title":"Same title","venue":"Test venue","start_time":"22:00","end_time":"04:00","earning_type":"fixed","earning_amount":300}'::jsonb,ARRAY['2026-10-02']::date[]);
 -- Legacy direct deletion must fail safely, without cascading.
 BEGIN
  DELETE FROM public.sessions WHERE id=root.id;
  RAISE EXCEPTION 'Direct root delete silently erased a series';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.sessions WHERE id=root.id OR parent_session_id=root.id)<>4 THEN RAISE EXCEPTION 'Direct delete damaged series'; END IF;
 SELECT id INTO selected_child FROM public.sessions WHERE parent_session_id=root.id AND date='2026-10-16';
 deleted := public.delete_session_safely(selected_child,'single');
 IF deleted<>1 OR (SELECT count(*) FROM public.sessions WHERE id=root.id OR parent_session_id=root.id)<>3 THEN RAISE EXCEPTION 'Single child delete affected siblings'; END IF;
 UPDATE public.sessions SET amount_paid=100 WHERE parent_session_id=root.id AND date='2026-10-09';
 deleted := public.delete_session_safely(root.id); -- safe default
 IF deleted<>1 OR EXISTS(SELECT 1 FROM public.sessions WHERE id=root.id) THEN RAISE EXCEPTION 'Single root deletion failed'; END IF;
 SELECT * INTO replacement FROM public.sessions WHERE user_id=auth.uid() AND date='2026-10-09' AND amount_paid=100;
 IF replacement.parent_session_id IS NOT NULL OR replacement.recurrence_type<>'weekly' OR replacement.recurrence_end_date<>'2026-10-30' THEN RAISE EXCEPTION 'Remaining series lost identity or receipts'; END IF;
 IF (SELECT count(*) FROM public.sessions WHERE parent_session_id=replacement.id)<>1 THEN RAISE EXCEPTION 'Siblings lost their series'; END IF;
 SELECT id INTO selected_child FROM public.sessions WHERE parent_session_id=replacement.id;
 deleted := public.delete_session_safely(selected_child,'series');
 IF deleted<>2 OR EXISTS(SELECT 1 FROM public.sessions WHERE id=replacement.id OR parent_session_id=replacement.id) THEN RAISE EXCEPTION 'Whole series deletion failed from child'; END IF;
 IF (SELECT count(*) FROM public.sessions WHERE id=second_root.id OR parent_session_id=second_root.id)<>2 OR NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=independent.id) THEN RAISE EXCEPTION 'Unrelated sessions deleted'; END IF;
 -- The same RPC cannot delete someone else's data or accept an unknown scope.
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000962',true);
 BEGIN PERFORM public.delete_session_safely(second_root.id,'series'); RAISE EXCEPTION 'Other owner deletion accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Session not found' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000961',true);
 BEGIN PERFORM public.delete_session_safely(second_root.id,'anything'); RAISE EXCEPTION 'Unknown scope accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invalid deletion request' THEN RAISE; END IF; END;
 deleted := public.delete_session_safely(second_root.id,'series');
 IF deleted<>2 THEN RAISE EXCEPTION 'Whole series deletion failed from root'; END IF;
 deleted := public.delete_session_safely(independent.id,'single');
 IF deleted<>1 THEN RAISE EXCEPTION 'Independent deletion failed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: cascade prevention, single root and child deletion, retained series and receipts, whole series from either date, unrelated data and owner isolation' AS result;
ROLLBACK;
