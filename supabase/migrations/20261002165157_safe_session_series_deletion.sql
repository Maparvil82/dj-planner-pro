-- A single DELETE must never implicitly erase the other dates in a series.
ALTER TABLE public.sessions DROP CONSTRAINT sessions_parent_session_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_parent_session_id_fkey
    FOREIGN KEY (parent_session_id) REFERENCES public.sessions(id) ON DELETE NO ACTION;

CREATE OR REPLACE FUNCTION public.delete_session_safely(session_id uuid, delete_scope text DEFAULT 'single')
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    owner_id uuid := auth.uid();
    current_session public.sessions;
    series_root public.sessions;
    replacement_id uuid;
    root_id uuid;
    deleted_count integer;
BEGIN
    IF owner_id IS NULL OR delete_scope IS NULL OR delete_scope NOT IN ('single','series') THEN
        RAISE EXCEPTION 'Invalid deletion request';
    END IF;
    SELECT * INTO current_session FROM public.sessions s WHERE s.id=session_id AND s.user_id=owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    root_id := coalesce(current_session.parent_session_id,current_session.id);
    -- Serialise series operations and block concurrent child inserts through the FK.
    SELECT * INTO series_root FROM public.sessions s WHERE s.id=root_id AND s.user_id=owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
    PERFORM s.id FROM public.sessions s WHERE s.user_id=owner_id AND (s.id=root_id OR s.parent_session_id=root_id) ORDER BY s.id FOR UPDATE;
    -- A concurrent deletion may have removed the selected date while we waited.
    SELECT * INTO current_session FROM public.sessions s WHERE s.id=session_id AND s.user_id=owner_id;
    IF NOT FOUND OR coalesce(current_session.parent_session_id,current_session.id) <> root_id THEN
        RAISE EXCEPTION 'Session changed; reload and try again';
    END IF;
    IF delete_scope='series' THEN
        DELETE FROM public.sessions s WHERE s.user_id=owner_id AND (s.id=root_id OR s.parent_session_id=root_id);
    ELSE
        IF current_session.id=root_id THEN
            SELECT s.id INTO replacement_id FROM public.sessions s
            WHERE s.user_id=owner_id AND s.parent_session_id=root_id ORDER BY s.date,s.id LIMIT 1;
            IF replacement_id IS NOT NULL THEN
                -- Preserve the series and all remaining dates, amounts and social links.
                UPDATE public.sessions s SET parent_session_id=NULL,
                    recurrence_type=series_root.recurrence_type,recurrence_end_date=series_root.recurrence_end_date
                WHERE s.id=replacement_id AND s.user_id=owner_id;
                UPDATE public.sessions s SET parent_session_id=replacement_id
                WHERE s.parent_session_id=root_id AND s.user_id=owner_id;
            END IF;
        END IF;
        DELETE FROM public.sessions s WHERE s.id=session_id AND s.user_id=owner_id;
    END IF;
    GET DIAGNOSTICS deleted_count=ROW_COUNT;
    IF deleted_count=0 THEN RAISE EXCEPTION 'Session not found'; END IF;
    RETURN deleted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_session_safely(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_session_safely(uuid,text) TO authenticated;
