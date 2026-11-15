ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS fee_agreement jsonb;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.sessions'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%earning_type%' LOOP
  EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_earning_type_check CHECK(earning_type IN ('free','hourly','fixed','agreement'));
ALTER TABLE public.sessions ADD CONSTRAINT sessions_fee_agreement_shape CHECK ((earning_type='agreement' AND jsonb_typeof(fee_agreement)='object' AND fee_agreement IS NOT NULL) OR (earning_type<>'agreement' AND fee_agreement IS NULL));

CREATE OR REPLACE FUNCTION billing_private.enforce_fee_agreement() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a jsonb; r jsonb; p jsonb; n numeric; total numeric; remaining numeric; owner_cents numeric; parts numeric:=0; sum_floor numeric:=0; cnt integer; k text;
BEGIN
 IF NEW.earning_type<>'agreement' THEN NEW.fee_agreement:=NULL; RETURN NEW; END IF;
 a:=NEW.fee_agreement;
 IF a IS NULL OR a->>'version' IS DISTINCT FROM '1' OR jsonb_typeof(a->'settled') IS DISTINCT FROM 'boolean' OR a->>'split' IS NULL OR a->>'split' NOT IN ('equal','percent','fixed') OR jsonb_typeof(a->'participants') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 IF jsonb_typeof(a->'timezone') IS DISTINCT FROM 'string' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=a->>'timezone') THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 IF TG_OP='INSERT' OR a IS DISTINCT FROM OLD.fee_agreement THEN
  IF NOT (public.get_session_usage()->>'isPro')::boolean THEN RAISE EXCEPTION 'agreement.proRequired'; END IF;
 END IF;
 IF TG_OP='INSERT' AND (a->>'settled')::boolean THEN RAISE EXCEPTION 'agreement.singleSession'; END IF;
 FOREACH k IN ARRAY ARRAY['fixed','perTicket','entryPercent','barPercent','minimum','expenses'] LOOP
  IF jsonb_typeof(a->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  n:=(a->>k)::numeric;
  IF n<0 OR n>999999999 OR round(n,2)<>n THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 END LOOP;
 IF (a->>'entryPercent')::numeric>100 OR (a->>'barPercent')::numeric>100 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 IF (a->>'fixed')::numeric+(a->>'perTicket')::numeric+(a->>'entryPercent')::numeric+(a->>'barPercent')::numeric+(a->>'minimum')::numeric=0 THEN RAISE EXCEPTION 'agreement.noTerms'; END IF;
 FOREACH k IN ARRAY ARRAY['estimate','actual'] LOOP
  r:=a->k;
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  FOR p IN SELECT value FROM jsonb_each(r) LOOP
   IF jsonb_typeof(p) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
   n:=p::text::numeric; IF n<0 OR n>999999999 OR round(n,2)<>n THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  END LOOP;
  IF NOT (r ?& ARRAY['tickets','entries','bar']) OR (r->>'tickets')::numeric<>trunc((r->>'tickets')::numeric) THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 END LOOP;
 cnt:=jsonb_array_length(a->'participants'); IF cnt NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(a->'participants') LOOP
  IF jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(p->>'name')>100 OR jsonb_typeof(p->'share') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  n:=(p->>'share')::numeric; IF n<0 OR n>999999999 OR round(n,2)<>n THEN RAISE EXCEPTION 'agreement.invalid'; END IF; parts:=parts+n;
 END LOOP;
 IF a->>'split'='percent' AND parts<>100 THEN RAISE EXCEPTION 'agreement.invalidSplit'; END IF;
 IF NOT (a->>'settled')::boolean THEN NEW.earning_amount:=0; RETURN NEW; END IF;
 -- Settlement is recorded only after the performance, including overnight sets.
 IF (NEW.date + NEW.end_time::time + CASE WHEN NEW.end_time::time<=NEW.start_time::time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE (a->>'timezone') > now() THEN RAISE EXCEPTION 'agreement.notFinished'; END IF;
 r:=a->'actual';
 total:=greatest(round((a->>'fixed')::numeric*100)+round((a->>'perTicket')::numeric*(r->>'tickets')::numeric*100)+round((a->>'entryPercent')::numeric*(r->>'entries')::numeric)+round((a->>'barPercent')::numeric*(r->>'bar')::numeric),round((a->>'minimum')::numeric*100));
 IF total>99999999900 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 remaining:=total-round((a->>'expenses')::numeric*100);
 IF remaining<0 THEN RAISE EXCEPTION 'agreement.expensesTooHigh'; END IF;
 IF a->>'split'='equal' THEN owner_cents:=floor(remaining/cnt)+CASE WHEN mod(remaining,cnt)>0 THEN 1 ELSE 0 END;
 ELSIF a->>'split'='fixed' THEN
  IF round(parts*100)<>remaining THEN RAISE EXCEPTION 'agreement.invalidSplit'; END IF;
  owner_cents:=round((a->'participants'->0->>'share')::numeric*100);
 ELSE
  FOR p IN SELECT value FROM jsonb_array_elements(a->'participants') LOOP sum_floor:=sum_floor+floor(remaining*(p->>'share')::numeric/100); END LOOP;
  owner_cents:=floor(remaining*(a->'participants'->0->>'share')::numeric/100)+CASE WHEN remaining>sum_floor THEN 1 ELSE 0 END;
 END IF;
 IF owner_cents/100>999999999 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 NEW.earning_amount:=owner_cents/100;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION billing_private.enforce_fee_agreement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sessions_fee_agreement BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION billing_private.enforce_fee_agreement();

CREATE OR REPLACE FUNCTION public.create_session_series(input jsonb, session_dates date[])
RETURNS SETOF public.sessions
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    owner_id uuid := auth.uid();
    first_session public.sessions;
BEGIN
    IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF session_dates IS NULL OR cardinality(session_dates) NOT BETWEEN 1 AND 500
       OR session_dates[1] IS DISTINCT FROM (input->>'date')::date
       OR array_position(session_dates, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid session dates';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text, 301));
    IF NOT (public.get_session_usage()->>'isPro')::boolean
       AND (public.get_session_usage()->>'count')::bigint + cardinality(session_dates)>30 THEN
        RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid,
        COALESCE(input->>'status', 'confirmed'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
        COALESCE((input->>'poster_focus_x')::double precision, 0.5), COALESCE((input->>'poster_focus_y')::double precision, 0.5), NULLIF(input->'fee_agreement','null'::jsonb)
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.poster_focus_x, first_session.poster_focus_y, first_session.fee_agreement, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session_series(jsonb, date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session_series(jsonb, date[]) TO authenticated;
