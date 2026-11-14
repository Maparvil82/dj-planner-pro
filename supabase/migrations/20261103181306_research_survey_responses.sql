create function public.valid_research_survey_answers(a jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare k text; value jsonb; option_id text; allowed text[]; n integer;
begin
 if a is null or jsonb_typeof(a)<>'object' or octet_length(a::text)>16000 then return false; end if;
 for k in select jsonb_object_keys(a) loop
  if not k=any(array['profile','frequency','recent','tools','time','priorities','first','additional','toolsOther','prioritiesOther']) then return false; end if;
 end loop;
 if jsonb_typeof(a->'profile') is distinct from 'string' or not (a->>'profile')=any(array['self_employed','mixed_work','preparing','not_self_employed','prefer_not_say']) then return false; end if;
 if jsonb_typeof(a->'frequency') is distinct from 'string' or not (a->>'frequency')=any(array['none','one_two','three_five','six_ten','eleven_plus','prefer_not_say']) then return false; end if;
 if jsonb_typeof(a->'time') is distinct from 'string' or not (a->>'time')=any(array['under_one','one_three','four_seven','eight_plus','unknown']) then return false; end if;
 foreach k in array array['tools','priorities'] loop
  value:=a->k;
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  n:=jsonb_array_length(value);
  if n<1 or n>(case when k='priorities' then 3 else 8 end) then return false; end if;
  if k='tools' then allowed:=array['dj_planner','calendar','spreadsheet','notes','invoicing_app','external_professional','other','none'];
  else allowed:=array['quotes_contracts','invoices','payments_due','expense_receipts','gig_profitability','accountant_export','client_management','cash_forecast','other','none']; end if;
  if exists(select 1 from jsonb_array_elements(value) e where jsonb_typeof(e)<>'string') then return false; end if;
  if (select count(distinct v) from jsonb_array_elements_text(value) v)<>n then return false; end if;
  for option_id in select jsonb_array_elements_text(value) loop
   if not option_id=any(allowed) then return false; end if;
  end loop;
  if value ? 'none' and n<>1 then return false; end if;
 end loop;
 if a->'priorities' ? 'none' then
  if a ? 'first' then return false; end if;
 else
  if jsonb_typeof(a->'first') is distinct from 'string' or not (a->'priorities') ? (a->>'first') then return false; end if;
 end if;
 foreach k in array array['recent','additional','toolsOther','prioritiesOther'] loop
  if a ? k and (jsonb_typeof(a->k) is distinct from 'string' or char_length(a->>k)>(case when k in('toolsOther','prioritiesOther') then 300 else 1500 end)) then return false; end if;
 end loop;
 if a ? 'toolsOther' and not (a->'tools') ? 'other' then return false; end if;
 if a ? 'prioritiesOther' and not (a->'priorities') ? 'other' then return false; end if;
 if a->>'frequency'='none' and a ? 'recent' then return false; end if;
 return true;
end $$;
revoke all on function public.valid_research_survey_answers(jsonb) from public,anon;
grant execute on function public.valid_research_survey_answers(jsonb) to authenticated,service_role;
create table public.research_survey_responses (
 user_id uuid not null references auth.users(id) on delete cascade,
 survey_version text not null check(survey_version='self-employed-djs-v1'),
 language text not null check(language in('es','en','de','fr','it','pt','ja')),
 answers jsonb not null check(public.valid_research_survey_answers(answers)),
 submitted_at timestamptz not null default now(),
 primary key(user_id,survey_version)
);
alter table public.research_survey_responses enable row level security;
revoke all on public.research_survey_responses from public,anon,authenticated;
grant select on public.research_survey_responses to authenticated;
grant insert(user_id,survey_version,language,answers) on public.research_survey_responses to authenticated;
grant all on public.research_survey_responses to service_role;
create policy research_survey_read_own on public.research_survey_responses for select to authenticated using(user_id=(select auth.uid()));
create policy research_survey_submit_own on public.research_survey_responses for insert to authenticated with check(user_id=(select auth.uid()));
