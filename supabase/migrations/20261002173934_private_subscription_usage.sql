-- Client queries use their own RLS permissions. Only the private boolean lookup
-- needs elevated access, and it always derives the account from auth.uid().
GRANT USAGE ON SCHEMA billing_private TO authenticated;
CREATE POLICY server_subscription_cache ON billing_private.subscription_access
 TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION billing_private.has_pro_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM billing_private.subscription_access
  WHERE user_id=auth.uid() AND pro_until>now()
 );
$$;
REVOKE ALL ON FUNCTION billing_private.has_pro_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION billing_private.has_pro_access() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_session_usage()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner_id uuid := auth.uid(); used bigint;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT count(*) INTO used FROM public.sessions WHERE user_id=owner_id;
 RETURN jsonb_build_object('count',used,'limit',30,'isPro',billing_private.has_pro_access(),'remaining',greatest(30-used,0));
END; $$;
