-- Provider-aware metering. Keep the existing owner, balance, reservations and grants.
-- Google global standard Flash Image: $0.50/M input, $60/M image output.
-- Conservatively charge ALL output (including thoughts/text) at $60/M.
-- Same safety provision of 125 EUR cents/USD; neither an invoice nor free-credit balance.
create or replace function poster_private.usage_eur_cents(u jsonb) returns integer
language plpgsql immutable security invoker set search_path='' as $$
declare t numeric; i numeric; o numeric; total numeric; candidates numeric; thoughts numeric;
begin
 if jsonb_typeof(u)<>'object' or u is null then return null; end if;
 if u->>'_provider'='vertex' then
   if u->>'_model' is distinct from 'gemini-3.1-flash-image' then return null; end if;
   if coalesce(u#>>'{usageMetadata,promptTokenCount}','')!~'^[0-9]{1,7}$'
     or coalesce(u#>>'{usageMetadata,totalTokenCount}','')!~'^[0-9]{1,7}$'
     or coalesce(u#>>'{usageMetadata,candidatesTokenCount}','0')!~'^[0-9]{1,7}$'
     or coalesce(u#>>'{usageMetadata,thoughtsTokenCount}','0')!~'^[0-9]{1,7}$' then return null; end if;
   i:=(u#>>'{usageMetadata,promptTokenCount}')::numeric;
   total:=(u#>>'{usageMetadata,totalTokenCount}')::numeric;
   candidates:=coalesce(u#>>'{usageMetadata,candidatesTokenCount}','0')::numeric;
   thoughts:=coalesce(u#>>'{usageMetadata,thoughtsTokenCount}','0')::numeric;
   if total<i or total=0 then return null; end if;
   o:=greatest(total-i,candidates+thoughts);
   return ceil((i*0.5+o*60)*125/1000000)::integer;
 end if;
 if u ? '_provider' and u->>'_provider' is distinct from 'openai' then return null; end if;
 if coalesce(u#>>'{input_tokens_details,text_tokens}','')!~'^[0-9]{1,7}$'
   or coalesce(u#>>'{input_tokens_details,image_tokens}','')!~'^[0-9]{1,7}$'
   or coalesce(u->>'output_tokens','')!~'^[0-9]{1,7}$' then return null; end if;
 t:=(u#>>'{input_tokens_details,text_tokens}')::numeric;
 i:=(u#>>'{input_tokens_details,image_tokens}')::numeric;
 o:=(u->>'output_tokens')::numeric;
 if t+i+o=0 then return null; end if;
 return ceil((t*5+i*8+o*30)*125/1000000)::integer;
end $$;
