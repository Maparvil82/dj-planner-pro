-- Additive versioned agreement validation; no session data is rewritten.
CREATE OR REPLACE FUNCTION billing_private.enforce_fee_agreement() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a jsonb; r jsonb; p jsonb; n numeric; total numeric; remaining numeric; owner_cents numeric; parts numeric:=0; sum_floor numeric:=0; cnt integer; k text;
BEGIN
 IF NEW.earning_type<>'agreement' THEN NEW.fee_agreement:=NULL; RETURN NEW; END IF;
 a:=NEW.fee_agreement;
 IF a->>'version'='2' THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION billing_private.enforce_conditional_agreement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a jsonb; r jsonb; p jsonb; n numeric; k text; count_paid numeric:=0; gross numeric:=0;
 ticket_base numeric; ticket_fee numeric:=0; bar_fee numeric; variable numeric; baseline numeric;
 total numeric; owner_cents numeric; sum_floor numeric:=0; cnt integer; qty numeric; price numeric;
 shares numeric[]; weights numeric[]; denominator numeric; left_cents integer; idx integer;
BEGIN
 IF NEW.earning_type<>'agreement' OR NEW.fee_agreement->>'version' IS DISTINCT FROM '2' THEN RETURN NEW; END IF;
 a:=NEW.fee_agreement;
 IF jsonb_typeof(a->'version') IS DISTINCT FROM 'number' OR jsonb_typeof(a->'settled') IS DISTINCT FROM 'boolean'
 OR coalesce(a->>'fixedMode','') NOT IN ('add','versus') OR coalesce(a->>'ticketMode','') NOT IN ('none','dj_fixed','venue_fixed','percent')
 OR coalesce(a->>'ticketBasis','') NOT IN ('gross','net') OR coalesce(a->>'barBasis','') NOT IN ('gross','net')
 OR coalesce(a->>'split','') NOT IN ('equal','percent','fixed')
 OR jsonb_typeof(a->'notes') IS DISTINCT FROM 'string' OR length(a->>'notes')>2000
 OR jsonb_typeof(a->'tickets') IS DISTINCT FROM 'array' OR jsonb_typeof(a->'participants') IS DISTINCT FROM 'array'
 OR jsonb_typeof(a->'timezone') IS DISTINCT FROM 'string'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=a->>'timezone') THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 IF TG_OP='INSERT' OR a IS DISTINCT FROM OLD.fee_agreement OR NEW.earning_type IS DISTINCT FROM OLD.earning_type THEN
  IF NOT coalesce((public.get_session_usage()->>'isPro')::boolean,false) THEN RAISE EXCEPTION 'agreement.proRequired'; END IF;
 END IF;
 IF TG_OP='INSERT' AND (a->>'settled')::boolean THEN RAISE EXCEPTION 'agreement.singleSession'; END IF;
 FOREACH k IN ARRAY ARRAY['fixed','minimum','maximum','ticketValue','barPercent','bonusThreshold','bonusAmount'] LOOP
  IF jsonb_typeof(a->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  n:=(a->>k)::numeric; IF n<0 OR n>999999999 OR round(n,2)<>n THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 END LOOP;
 IF (a->>'bonusThreshold')::numeric>1000000 OR (a->>'bonusThreshold')::numeric<>trunc((a->>'bonusThreshold')::numeric)
 OR (a->>'barPercent')::numeric>100 OR (a->>'ticketMode'='percent' AND (a->>'ticketValue')::numeric>100)
 OR ((a->>'maximum')::numeric>0 AND (a->>'maximum')::numeric<(a->>'minimum')::numeric)
 OR ((a->>'bonusAmount')::numeric>0 AND (a->>'bonusThreshold')::numeric=0) THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 IF (a->>'fixed')::numeric=0 AND (a->>'minimum')::numeric=0
 AND NOT (a->>'ticketMode'<>'none' AND (a->>'ticketValue')::numeric>0) AND a->>'ticketMode'<>'venue_fixed'
 AND (a->>'barPercent')::numeric=0 AND (a->>'bonusAmount')::numeric=0 THEN RAISE EXCEPTION 'agreement.noTerms'; END IF;
 IF jsonb_array_length(a->'tickets')>30 OR (a->>'ticketMode'<>'none' AND jsonb_array_length(a->'tickets')=0) THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(a->'tickets') LOOP
  IF jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(btrim(p->>'name'))=0 OR length(p->>'name')>80 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  FOREACH k IN ARRAY ARRAY['price','estimate','sold','refunded','invited'] LOOP
   IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
   n:=(p->>k)::numeric;
   IF n<0 OR n>999999999 OR round(n,2)<>n OR (k<>'price' AND (n>1000000 OR n<>trunc(n))) THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  END LOOP;
  IF (p->>'refunded')::numeric>(p->>'sold')::numeric OR (a->>'ticketMode'='venue_fixed' AND (p->>'price')::numeric>0 AND (a->>'ticketValue')::numeric>(p->>'price')::numeric) THEN RAISE EXCEPTION 'conditional.invalidTickets'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['estimate','actual'] LOOP
  r:=a->k;
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  FOR p IN SELECT r->key FROM unnest(ARRAY['ticketDeductions','bar','barDeductions','expenses']) AS keys(key) LOOP
   IF jsonb_typeof(p) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
   n:=p::text::numeric; IF n<0 OR n>999999999 OR round(n,2)<>n THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  END LOOP;
 END LOOP;
 cnt:=jsonb_array_length(a->'participants'); IF cnt NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 idx:=0;
 FOR p IN SELECT value FROM jsonb_array_elements(a->'participants') LOOP
  IF jsonb_typeof(p->'name') IS DISTINCT FROM 'string' OR length(p->>'name')>100 OR (idx>0 AND length(btrim(p->>'name'))=0) OR jsonb_typeof(p->'share') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  n:=(p->>'share')::numeric; IF n<0 OR n>999999999 OR round(n,2)<>n THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
  idx:=idx+1;
 END LOOP;
 IF a->>'split'='percent' AND (SELECT sum((value->>'share')::numeric) FROM jsonb_array_elements(a->'participants'))<>100 THEN RAISE EXCEPTION 'agreement.invalidSplit'; END IF;
 IF NOT (a->>'settled')::boolean THEN NEW.earning_amount:=0; RETURN NEW; END IF;
 IF NEW.status='cancelled' OR community_private.session_end_at(NEW)>now() THEN RAISE EXCEPTION 'agreement.notFinished'; END IF;
 r:=a->'actual';
 FOR p IN SELECT value FROM jsonb_array_elements(a->'tickets') LOOP
  qty:=(p->>'sold')::numeric-(p->>'refunded')::numeric; price:=round((p->>'price')::numeric*100);
  IF price>0 THEN count_paid:=count_paid+qty; END IF;
  gross:=gross+price*qty;
 END LOOP;
 IF gross>99999999900 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 IF round((r->>'ticketDeductions')::numeric*100)>gross OR (r->>'barDeductions')::numeric>(r->>'bar')::numeric THEN RAISE EXCEPTION 'conditional.deductionsTooHigh'; END IF;
 ticket_base:=gross-CASE WHEN a->>'ticketBasis'='net' THEN round((r->>'ticketDeductions')::numeric*100) ELSE 0 END;
 IF a->>'ticketMode'='dj_fixed' THEN ticket_fee:=round((a->>'ticketValue')::numeric*100)*count_paid;
 ELSIF a->>'ticketMode'='venue_fixed' THEN ticket_fee:=ticket_base-round((a->>'ticketValue')::numeric*100)*count_paid;
 ELSIF a->>'ticketMode'='percent' THEN ticket_fee:=round(ticket_base*(a->>'ticketValue')::numeric/100); END IF;
 IF ticket_fee<0 THEN RAISE EXCEPTION 'conditional.deductionsTooHigh'; END IF;
 bar_fee:=round(((r->>'bar')::numeric-CASE WHEN a->>'barBasis'='net' THEN (r->>'barDeductions')::numeric ELSE 0 END)*(a->>'barPercent')::numeric);
 variable:=ticket_fee+bar_fee+CASE WHEN (a->>'bonusThreshold')::numeric>0 AND count_paid>=(a->>'bonusThreshold')::numeric THEN round((a->>'bonusAmount')::numeric*100) ELSE 0 END;
 IF variable>99999999900 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 variable:=greatest(0,variable-round((r->>'expenses')::numeric*100));
 baseline:=CASE WHEN a->>'fixedMode'='versus' THEN greatest(round((a->>'fixed')::numeric*100),variable) ELSE round((a->>'fixed')::numeric*100)+variable END;
 IF baseline>99999999900 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 total:=greatest(baseline,round((a->>'minimum')::numeric*100));
 IF (a->>'maximum')::numeric>0 THEN total:=least(total,round((a->>'maximum')::numeric*100)); END IF;
 IF total>99999999900 THEN RAISE EXCEPTION 'agreement.invalid'; END IF;
 shares:=array_fill(0::numeric,ARRAY[cnt]); weights:=array_fill(0::numeric,ARRAY[cnt]);
 IF a->>'split'='fixed' THEN
  SELECT coalesce(sum(round((value->>'share')::numeric*100)),0) INTO sum_floor FROM jsonb_array_elements(a->'participants') WITH ORDINALITY WHERE ordinality>1;
  owner_cents:=total-sum_floor; IF owner_cents<0 THEN RAISE EXCEPTION 'agreement.invalidSplit'; END IF;
 ELSE
  denominator:=CASE WHEN a->>'split'='equal' THEN cnt ELSE 10000 END;
  FOR idx IN 1..cnt LOOP
   weights[idx]:=CASE WHEN a->>'split'='equal' THEN 1 ELSE round((a->'participants'->(idx-1)->>'share')::numeric*100) END;
   shares[idx]:=floor(total*weights[idx]/denominator); sum_floor:=sum_floor+shares[idx];
  END LOOP;
  left_cents:=(total-sum_floor)::integer;
  FOR idx IN SELECT i FROM generate_series(1,cnt) AS i ORDER BY mod(total*weights[i],denominator) DESC,i LIMIT left_cents LOOP shares[idx]:=shares[idx]+1; END LOOP;
  owner_cents:=shares[1];
 END IF;
 NEW.earning_amount:=owner_cents/100;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION billing_private.enforce_conditional_agreement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sessions_fee_agreement_v2 BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION billing_private.enforce_conditional_agreement();
