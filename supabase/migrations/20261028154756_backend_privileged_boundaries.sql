-- Owner-only read, no email addresses or user mutations.
CREATE OR REPLACE FUNCTION account_private.admin_dashboard_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF (SELECT auth.uid()) IS DISTINCT FROM 'd5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid OR NOT account_private.active_user((SELECT auth.uid())) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
 END IF;
 RETURN jsonb_build_object(
  'registered', (SELECT count(*) FROM auth.users),
  'userIds', (SELECT coalesce(jsonb_agg(id), '[]'::jsonb) FROM auth.users),
  'trialUserIds', (SELECT coalesce(jsonb_agg(t.user_id), '[]'::jsonb) FROM billing_private.pro_trials t WHERE t.started_at <= now() AND t.expires_at > now()),
  'asOf', now()
 );
END;
$$;
REVOKE ALL ON FUNCTION account_private.admin_dashboard_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION account_private.admin_dashboard_snapshot() TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT account_private.admin_dashboard_snapshot();
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot() TO authenticated;

-- Account-scoped operation: no caller-supplied identity and no direct table writes.
CREATE OR REPLACE FUNCTION poster_private.complete_intro() RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE viewer uuid:=(SELECT auth.uid());
BEGIN
 IF viewer IS NULL OR NOT account_private.active_user(viewer) THEN RAISE insufficient_privilege; END IF;
 INSERT INTO poster_private.intro_completions(user_id) VALUES(viewer) ON CONFLICT(user_id) DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION poster_private.complete_intro() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION poster_private.complete_intro() TO authenticated;
CREATE OR REPLACE FUNCTION public.complete_poster_intro() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT poster_private.complete_intro();
$$;
REVOKE ALL ON FUNCTION public.complete_poster_intro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_poster_intro() TO authenticated;
