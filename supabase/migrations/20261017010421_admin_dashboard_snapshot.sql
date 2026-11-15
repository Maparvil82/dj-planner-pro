-- Owner-only read, no email addresses or user mutations.
CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF (SELECT auth.uid()) IS DISTINCT FROM 'd5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid THEN
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
REVOKE ALL ON FUNCTION public.admin_dashboard_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot() TO authenticated;
