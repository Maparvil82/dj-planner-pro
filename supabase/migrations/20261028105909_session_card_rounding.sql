-- Preserve the existing client Math.round per-expense cent calculation.
create or replace function public.session_card_summaries(ids uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if cardinality(ids)>100 then raise exception 'too_many_sessions'; end if;
 select coalesce(jsonb_object_agg(s.id,jsonb_build_object('completed',(select count(*) from public.session_tasks t where t.session_id=s.id and t.user_id=(select auth.uid()) and t.completed),'pending',(select count(*) from public.session_tasks t where t.session_id=s.id and t.user_id=(select auth.uid()) and not t.completed),
 'expenseCount',(select count(*) from public.expenses e where e.session_id=s.id and e.user_id=(select auth.uid())),
 'expenses',(select coalesce(jsonb_object_agg(currency,total),'{}') from(select community_private.screen_currency(e.currency) as currency,sum(floor(e.amount::float8*100+0.5))/100.0 as total from public.expenses e where e.session_id=s.id and e.user_id=(select auth.uid()) group by 1)x))),'{}') into result
 from public.sessions s where s.user_id=(select auth.uid()) and s.id=any(ids);
 return result;
end $$;
