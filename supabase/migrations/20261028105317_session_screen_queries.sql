-- Read-only screen queries. Existing endpoints remain compatible with installed apps.
create function community_private.screen_fee(s public.sessions,guest boolean default false) returns double precision
language plpgsql immutable security invoker set search_path='' as $$
begin
 return case when guest then 0 when s.earning_type in('fixed','agreement') then coalesce(s.earning_amount,0)::float8
 when s.earning_type='hourly' then coalesce(s.earning_amount,0)::float8 *
 ((case when (extract(hour from coalesce(nullif(s.end_time,''),'00:00')::time)*60+extract(minute from coalesce(nullif(s.end_time,''),'00:00')::time)) <= (extract(hour from coalesce(nullif(s.start_time,''),'00:00')::time)*60+extract(minute from coalesce(nullif(s.start_time,''),'00:00')::time)) then 1440 else 0 end
 +extract(hour from coalesce(nullif(s.end_time,''),'00:00')::time)*60+extract(minute from coalesce(nullif(s.end_time,''),'00:00')::time)
 -extract(hour from coalesce(nullif(s.start_time,''),'00:00')::time)*60-extract(minute from coalesce(nullif(s.start_time,''),'00:00')::time))::float8/60.0) else 0 end;
end $$;
create function community_private.screen_end(s public.sessions,zone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
begin
 return (s.date+coalesce(nullif(s.end_time,''),'00:00')::time+
 case when coalesce(nullif(s.end_time,''),'00:00')::time<=coalesce(nullif(s.start_time,''),'00:00')::time then interval '1 day' else interval '0' end)
 at time zone coalesce(nullif(s.booking_timezone,''),zone);
end $$;
create function community_private.screen_balance(s public.sessions) returns double precision
language plpgsql immutable security invoker set search_path='' as $$
begin
 return greatest(0,floor((community_private.screen_fee(s)-coalesce(s.amount_paid,0)::float8)*100+0.5)/100.0);
end $$;
create function community_private.screen_currency(code text) returns text
language plpgsql immutable security invoker set search_path='' as $$
begin
 return case coalesce(code,'EUR') when '€' then 'EUR' when '$' then 'USD' when '£' then 'GBP' when '¥' then 'JPY' else upper(coalesce(code,'EUR')) end;
end $$;
create function community_private.screen_name(s public.sessions,at_venue text,untitled text) returns text
language plpgsql immutable security invoker set search_path='' as $$
begin
 return coalesce(nullif(trim(s.title),''),case when nullif(trim(s.venue),'') is not null then replace(at_venue,'{venue}',trim(s.venue)) else untitled end);
end $$;
create function community_private.screen_match(s public.sessions,guest boolean,f jsonb,at_venue text,untitled text,instant timestamptz,zone text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
begin
 return (coalesce(f->>'search','')='' or position(lower(f->>'search') in lower(community_private.screen_name(s,at_venue,untitled)))>0 or position(lower(f->>'search') in lower(coalesce(s.venue,'')))>0)
 and (coalesce(jsonb_array_length(f->'venues'),0)=0 or coalesce(s.venue,'') in(select jsonb_array_elements_text(f->'venues')))
 and (coalesce(jsonb_array_length(f->'titles'),0)=0 or community_private.screen_name(s,at_venue,untitled) in(select jsonb_array_elements_text(f->'titles')))
 and (coalesce(jsonb_array_length(f->'earningTypes'),0)=0 or (case when guest then 'free' else s.earning_type end) in(select jsonb_array_elements_text(f->'earningTypes')))
 and (f->>'min' is null or (case when s.status='cancelled' then 0 else community_private.screen_fee(s,guest) end)>=(f->>'min')::float8)
 and (f->>'max' is null or (case when s.status='cancelled' then 0 else community_private.screen_fee(s,guest) end)<=(f->>'max')::float8)
 and (f->>'blockedDay' is null or (coalesce(s.status,'')<>'cancelled' and (s.date=(f->>'blockedDay')::date or (s.date=(f->>'blockedDay')::date-1 and coalesce(nullif(s.end_time,''),'00:00')::time<=coalesce(nullif(s.start_time,''),'00:00')::time and coalesce(nullif(s.end_time,''),'00:00')::time<>'00:00'::time))))
 and (coalesce((f->>'upcoming')::boolean,false)=false or (coalesce(s.status,'')<>'cancelled' and community_private.screen_end(s,zone)>instant))
 and (f->>'aging' is null or (not guest and coalesce(s.status,'') not in('pending','cancelled') and (s.earning_type<>'agreement' or s.fee_agreement->>'settled'='true')
  and community_private.screen_currency(s.currency)=f->>'currency' and community_private.screen_balance(s)>0 and community_private.screen_end(s,zone)<=instant
  and (case when floor(extract(epoch from(instant-community_private.screen_end(s,zone)))/86400)<=30 then 'days30' when floor(extract(epoch from(instant-community_private.screen_end(s,zone)))/86400)<=60 then 'days60' when floor(extract(epoch from(instant-community_private.screen_end(s,zone)))/86400)<=90 then 'days90' else 'daysOver90' end)=f->>'aging'));
end $$;
create function community_private.screen_guest(s public.sessions,owner_name text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
begin
 return jsonb_build_object('id',s.id,'user_id',s.user_id,'date',s.date,'title',s.title,'venue',s.venue,'venue_city',s.venue_city,'venue_city_location',s.venue_city_location,'venue_address',s.venue_address,'booking_timezone',s.booking_timezone,'start_time',s.start_time,'end_time',s.end_time,'color',s.color,'status',s.status,'poster_url',s.poster_url,'poster_focus_x',s.poster_focus_x,'poster_focus_y',s.poster_focus_y,'is_collective',true,'djs','[]'::jsonb,'earning_type','free','earning_amount',0,'currency',s.currency,'created_at',s.created_at,'updated_at',s.updated_at,'is_guest',true,'owner_name',coalesce(owner_name,'DJ'));
end $$;

-- Definer is required only for the accepted invitation projection, exactly as in
-- agenda_range. Identity is checked here; no owner or viewer can be supplied.
create function community_private.screen_page(f jsonb,cursor jsonb,ascending_order boolean,at_venue text,untitled text,instant timestamptz,zone text,page_size integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=(select auth.uid()); rows jsonb; size integer:=least(greatest(coalesce(page_size,50),1),100); direction text; comparison text; last_row jsonb;
begin
 if viewer is null or not account_private.active_user(viewer) then raise insufficient_privilege; end if;
 direction:=case when ascending_order then 'asc' else 'desc' end;comparison:=case when ascending_order then '>' else '<' end;
 execute format($read$
 with own as (
  select s as item,false as guest,null::text as owner_name from public.sessions s
  where s.user_id=$1 and ($2::date is null or s.date>=$2) and ($3::date is null or s.date<$3)
   and ($4::date is null or (s.date,s.id) %2$s ($4,$5)) and community_private.screen_match(s,false,$6,$7,$8,$9,$10)
  order by s.date %1$s,s.id %1$s limit ($11+1)
 ), invited as (
  select s as item,true as guest,p.artist_name as owner_name from public.session_collaborators i
  join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id left join public.users_profile p on p.id=s.user_id
  where i.dj_id=$1 and i.status='accepted' and s.user_id<>$1 and ($2::date is null or s.date>=$2) and ($3::date is null or s.date<$3)
   and ($4::date is null or (s.date,s.id) %2$s ($4,$5)) and community_private.screen_match(s,true,$6,$7,$8,$9,$10)
  order by s.date %1$s,s.id %1$s limit ($11+1)
 ), page as(select * from (select * from own union all select * from invited) all_rows order by (item).date %1$s,(item).id %1$s limit ($11+1))
 select coalesce(jsonb_agg(case when guest then community_private.screen_guest(item,owner_name) else to_jsonb(item) end order by (item).date %1$s,(item).id %1$s),'[]') from page
 $read$,direction,comparison) into rows
 using viewer,(f->>'from')::date,(f->>'to')::date,(cursor->>'date')::date,(cursor->>'id')::uuid,f,at_venue,untitled,instant,zone,size;
 if jsonb_array_length(rows)>size then last_row:=rows->(size-1); end if;
 return jsonb_build_object('sessions',(select coalesce(jsonb_agg(value order by n),'[]') from jsonb_array_elements(rows) with ordinality r(value,n) where n<=size),
 'nextCursor',case when last_row is not null then jsonb_build_object('date',last_row->'date','id',last_row->'id') else null end);
end $$;
revoke all on function community_private.screen_page(jsonb,jsonb,boolean,text,text,timestamptz,text,integer) from public,anon;
grant execute on function community_private.screen_page(jsonb,jsonb,boolean,text,text,timestamptz,text,integer) to authenticated;
create function public.session_screen_page(filters jsonb default '{}',cursor jsonb default null,ascending_order boolean default false,at_venue text default 'Session at {venue}',untitled text default 'Untitled session',instant timestamptz default now(),zone text default 'UTC',page_size integer default 50)
returns jsonb language sql stable security invoker set search_path='' as $$
 select community_private.screen_page(filters,cursor,ascending_order,at_venue,untitled,instant,zone,page_size);
$$;
revoke all on function public.session_screen_page(jsonb,jsonb,boolean,text,text,timestamptz,text,integer) from public,anon;
grant execute on function public.session_screen_page(jsonb,jsonb,boolean,text,text,timestamptz,text,integer) to authenticated;

create function community_private.screen_context(instant timestamptz,zone text,statistics boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=(select auth.uid()); result jsonb; first_visits jsonb; aging jsonb; currencies jsonb;
begin
 if viewer is null or not account_private.active_user(viewer) then raise insufficient_privilege; end if;
 select jsonb_build_object('reviewCount',count(distinct coalesce(parent_session_id,id))) into result from public.sessions where user_id=viewer and coalesce(status,'')<>'cancelled';
 if not statistics then return result; end if;
 with completed as materialized (
  select coalesce(s.venue_id::text,lower(regexp_replace(regexp_replace(normalize(trim(coalesce(s.venue,'')),NFD),'[̀-ͯ]','','g'),'\s+',' ','g'))) as key,community_private.screen_end(s,zone) as ended from public.sessions s where s.user_id=viewer and coalesce(s.status,'') not in('pending','cancelled')
  union all
  select lower(regexp_replace(regexp_replace(normalize(trim(coalesce(s.venue,'')),NFD),'[̀-ͯ]','','g'),'\s+',' ','g')),community_private.screen_end(s,zone) from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id where i.dj_id=viewer and i.status='accepted' and s.user_id<>viewer and coalesce(s.status,'') not in('pending','cancelled')
 ) select coalesce(jsonb_object_agg(key,ended),'{}') into first_visits from (select key,extract(epoch from min(ended))*1000 as ended from completed where ended<=instant and key<>'' group by key) t;
 with due as materialized (
  select community_private.screen_currency(s.currency) as currency,community_private.screen_balance(s) as amount,community_private.screen_end(s,zone) as ended
  from public.sessions s where s.user_id=viewer and coalesce(s.status,'') not in('pending','cancelled') and (s.earning_type<>'agreement' or s.fee_agreement->>'settled'='true')
 ), aged as(select currency,amount,floor(extract(epoch from(instant-ended))/86400) as days from due where ended<=instant and amount>0),
 buckets as(select currency,case when days<=30 then 'days30' when days<=60 then 'days60' when days<=90 then 'days90' else 'daysOver90' end as key,amount from aged)
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into aging from (select currency,key,count(*) as count,sum(round(amount::numeric*100))/100 as amount from buckets group by currency,key)t;
 with codes as materialized (
  select currency from public.sessions where user_id=viewer and coalesce(status,'')<>'cancelled' and earning_type<>'free'
  union select coalesce(currency,'EUR') from public.expenses where user_id=viewer
 ) select coalesce(jsonb_agg(currency order by currency),'[]') into currencies from(select distinct community_private.screen_currency(currency) as currency from codes)t;
 return result||jsonb_build_object('firstCompleted',first_visits,'aging',aging,'currencies',currencies);
end $$;
revoke all on function community_private.screen_context(timestamptz,text,boolean) from public,anon;
grant execute on function community_private.screen_context(timestamptz,text,boolean) to authenticated;
create function public.session_screen_context(instant timestamptz default now(),zone text default 'UTC',statistics boolean default false) returns jsonb
language sql stable security invoker set search_path='' as $$select community_private.screen_context(instant,zone,statistics);$$;
revoke all on function public.session_screen_context(timestamptz,text,boolean) from public,anon;
grant execute on function public.session_screen_context(timestamptz,text,boolean) to authenticated;

create function community_private.screen_options(at_venue text,untitled text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=(select auth.uid()); result jsonb;
begin
 if viewer is null or not account_private.active_user(viewer) then raise insufficient_privilege; end if;
 with visible as (
  select s.venue,community_private.screen_name(s,at_venue,untitled) as title from public.sessions s where s.user_id=viewer
  union all select s.venue,community_private.screen_name(s,at_venue,untitled) from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id where i.dj_id=viewer and i.status='accepted' and s.user_id<>viewer
 ) select jsonb_build_object('venues',(select coalesce(jsonb_agg(venue order by venue),'[]') from(select distinct venue from visible where venue is not null and venue<>'')v),
 'titles',(select coalesce(jsonb_agg(title order by title),'[]') from(select distinct title from visible)v)) into result;
 return result;
end $$;
revoke all on function community_private.screen_options(text,text) from public,anon;
grant execute on function community_private.screen_options(text,text) to authenticated;
create function public.session_screen_options(at_venue text,untitled text) returns jsonb language sql stable security invoker set search_path='' as $$select community_private.screen_options(at_venue,untitled);$$;
revoke all on function public.session_screen_options(text,text) from public,anon;
grant execute on function public.session_screen_options(text,text) to authenticated;

create function public.dashboard_expenses(from_date date,to_date date,page_offset integer default 0) returns setof public.expenses
language sql stable security invoker set search_path='' as $$
 select e.* from public.expenses e where e.user_id=(select auth.uid()) and
 ((e.date>=from_date and e.date<to_date) or exists(select 1 from public.sessions s where s.id=e.session_id and s.user_id=(select auth.uid()) and s.date>=from_date and s.date<to_date))
 order by e.date desc,e.id limit 500 offset greatest(page_offset,0);
$$;
revoke all on function public.dashboard_expenses(date,date,integer) from public,anon;
grant execute on function public.dashboard_expenses(date,date,integer) to authenticated;

create function public.session_card_summaries(ids uuid[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if cardinality(ids)>100 then raise exception 'too_many_sessions'; end if;
 select coalesce(jsonb_object_agg(s.id,jsonb_build_object('completed',(select count(*) from public.session_tasks t where t.session_id=s.id and t.user_id=(select auth.uid()) and t.completed),'pending',(select count(*) from public.session_tasks t where t.session_id=s.id and t.user_id=(select auth.uid()) and not t.completed),
 'expenseCount',(select count(*) from public.expenses e where e.session_id=s.id and e.user_id=(select auth.uid())),
 'expenses',(select coalesce(jsonb_object_agg(currency,total),'{}') from(select community_private.screen_currency(e.currency) as currency,sum(round(e.amount*100))/100 as total from public.expenses e where e.session_id=s.id and e.user_id=(select auth.uid()) group by 1)x))),'{}') into result
 from public.sessions s where s.user_id=(select auth.uid()) and s.id=any(ids);
 return result;
end $$;
revoke all on function public.session_card_summaries(uuid[]) from public,anon;
grant execute on function public.session_card_summaries(uuid[]) to authenticated;
-- Helpers have no public API surface. The two invoker endpoints that use currency
-- normalization need only this immutable helper; no data access is granted here.
do $$declare p regprocedure;begin
 for p in select oid::regprocedure from pg_proc where pronamespace='community_private'::regnamespace and proname in('screen_fee','screen_end','screen_balance','screen_name','screen_match','screen_guest') loop execute format('revoke all on function %s from public,anon,authenticated',p);end loop;
end$$;
revoke all on function community_private.screen_currency(text) from public,anon;
grant execute on function community_private.screen_currency(text) to authenticated;

create function community_private.screen_marks(f jsonb,at_venue text,untitled text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=(select auth.uid()); result jsonb;begin
 if viewer is null or not account_private.active_user(viewer) then raise insufficient_privilege; end if;
 if f->>'from' is null or f->>'to' is null or (f->>'to')::date-(f->>'from')::date>62 then raise exception 'calendar_range_required';end if;
 with visible as (
  select s.date,s.id,s.color from public.sessions s where s.user_id=viewer and s.date>=(f->>'from')::date and s.date<(f->>'to')::date and community_private.screen_match(s,false,f,at_venue,untitled,now(),'UTC')
  union all select s.date,s.id,s.color from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id where i.dj_id=viewer and i.status='accepted' and s.user_id<>viewer and s.date>=(f->>'from')::date and s.date<(f->>'to')::date and community_private.screen_match(s,true,f,at_venue,untitled,now(),'UTC')
 ) select coalesce(jsonb_agg(to_jsonb(t) order by date),'[]') into result from(select date,(array_agg(color order by id))[1] as color from visible group by date)t;
 return result;
end $$;
revoke all on function community_private.screen_marks(jsonb,text,text) from public,anon;
grant execute on function community_private.screen_marks(jsonb,text,text) to authenticated;
create function public.session_calendar_marks(filters jsonb,at_venue text,untitled text) returns jsonb language sql stable security invoker set search_path='' as $$select community_private.screen_marks(filters,at_venue,untitled);$$;
revoke all on function public.session_calendar_marks(jsonb,text,text) from public,anon;
grant execute on function public.session_calendar_marks(jsonb,text,text) to authenticated;
