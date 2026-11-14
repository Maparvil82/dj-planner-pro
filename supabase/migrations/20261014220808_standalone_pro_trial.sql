-- Standalone gift: one calendar month, once per account, no store subscription.
CREATE TABLE billing_private.pro_trials (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CHECK (expires_at > started_at)
);
ALTER TABLE billing_private.pro_trials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON billing_private.pro_trials FROM PUBLIC, anon, authenticated;
GRANT ALL ON billing_private.pro_trials TO service_role;
CREATE POLICY server_trial_access ON billing_private.pro_trials TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION billing_private.pro_access_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE account uuid:=auth.uid(); paid boolean; trial billing_private.pro_trials; active boolean;
BEGIN
 IF account IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=account AND pro_until>now()) INTO paid;
 SELECT * INTO trial FROM billing_private.pro_trials WHERE user_id=account;
 active:=coalesce(trial.expires_at>now(),false);
 RETURN jsonb_build_object('isPro',paid OR active,'paidPro',paid,
  'trial',jsonb_build_object('eligible',trial.user_id IS NULL AND NOT paid,
   'status',CASE WHEN trial.user_id IS NULL THEN 'available' WHEN active THEN 'active' ELSE 'expired' END,
   'startedAt',trial.started_at,'expiresAt',trial.expires_at),'serverNow',now());
END; $$;
REVOKE ALL ON FUNCTION billing_private.pro_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION billing_private.pro_access_status() TO authenticated;

CREATE OR REPLACE FUNCTION billing_private.has_pro_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
  EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=auth.uid() AND pro_until>now())
  OR EXISTS(SELECT 1 FROM billing_private.pro_trials WHERE user_id=auth.uid() AND expires_at>now())
 );
$$;

CREATE OR REPLACE FUNCTION public.get_session_usage()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE account uuid:=auth.uid(); used bigint;
BEGIN
 IF account IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT count(*) INTO used FROM public.sessions WHERE user_id=account;
 RETURN jsonb_build_object('count',used,'limit',30,'remaining',greatest(30-used,0)) || billing_private.pro_access_status();
END; $$;

CREATE FUNCTION billing_private.activate_pro_trial()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE account uuid:=auth.uid();
BEGIN
 IF account IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF NOT account_private.active_user(account) THEN RAISE EXCEPTION 'trial.accountUnavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(account::text,301));
 -- Retries are idempotent; an expired trial is never restarted.
 IF EXISTS(SELECT 1 FROM billing_private.pro_trials WHERE user_id=account) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=account AND pro_until>now()) THEN
  RAISE EXCEPTION 'trial.alreadyPro';
 END IF;
 INSERT INTO billing_private.pro_trials(user_id,started_at,expires_at)
 VALUES(account,now(),((now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC');
END; $$;
REVOKE ALL ON FUNCTION billing_private.activate_pro_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION billing_private.activate_pro_trial() TO authenticated;
CREATE FUNCTION public.start_pro_trial()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM billing_private.activate_pro_trial();
 RETURN public.get_session_usage();
END; $$;
REVOKE ALL ON FUNCTION public.start_pro_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_pro_trial() TO authenticated;

-- Cover direct inserts as well as the series RPC during the trial.
CREATE OR REPLACE FUNCTION billing_private.enforce_session_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,301));
 IF EXISTS(SELECT 1 FROM billing_private.subscription_access WHERE user_id=NEW.user_id AND pro_until>now())
  OR EXISTS(SELECT 1 FROM billing_private.pro_trials WHERE user_id=NEW.user_id AND expires_at>now()) THEN RETURN NEW; END IF;
 IF (SELECT count(*) FROM public.sessions WHERE user_id=NEW.user_id)>=30 THEN
  RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END; $$;
