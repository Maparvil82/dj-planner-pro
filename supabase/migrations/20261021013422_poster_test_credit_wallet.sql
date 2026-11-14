-- Private simulation only. Units are half credits. No money or store receipts.
create table public.poster_test_wallets(user_id uuid primary key references auth.users(id) on delete cascade, units integer not null default 0 check(units>=0), reserved_units integer not null default 0 check(reserved_units>=0 and reserved_units<=units));
create table public.poster_test_credit_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,kind text not null check(kind in('test_purchase','reserve','consume','release')),units integer not null check(units>0),package text,created_at timestamptz not null default now(),unique(request_id,kind));
alter table public.poster_test_wallets enable row level security;
alter table public.poster_test_credit_events enable row level security;
revoke all on public.poster_test_wallets,public.poster_test_credit_events from public,anon,authenticated;
grant select,insert,update on public.poster_test_wallets to service_role;
grant select,insert on public.poster_test_credit_events to service_role;
alter table public.poster_ai_jobs add column test_credit_units integer not null default 0 check(test_credit_units in(0,1,2)), add column test_credit_state text not null default 'legacy' check(test_credit_state in('legacy','reserved','consumed','released'));
create function public.poster_test_purchase(p_user uuid,p_id uuid,p_package text) returns void language plpgsql security invoker set search_path='' as $$
declare amount integer; existing public.poster_test_credit_events;
begin
 if p_user<>'d5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid then raise exception 'poster_forbidden';end if;
 amount:=case p_package when 'starter' then 10 when 'studio' then 24 else null end;
 if amount is null then raise exception 'poster_invalid_input';end if;
 insert into public.poster_test_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.poster_test_wallets where user_id=p_user for update;
 select * into existing from public.poster_test_credit_events where request_id=p_id and kind='test_purchase';
 if found then
  if existing.user_id<>p_user or existing.package<>p_package then raise exception 'poster_id_conflict';end if;return;
 end if;
 insert into public.poster_test_credit_events(user_id,request_id,kind,units,package) values(p_user,p_id,'test_purchase',amount,p_package);
 update public.poster_test_wallets set units=units+amount where user_id=p_user;
end;$$;
revoke all on function public.poster_test_purchase(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.poster_test_purchase(uuid,uuid,text) to service_role;
create function poster_private.test_wallet_job() returns trigger language plpgsql security invoker set search_path='' as $$
declare charge integer; w public.poster_test_wallets;
begin
 if TG_OP='INSERT' then
  charge:=case when new.parent_id is null then 2 else 1 end;
  insert into public.poster_test_wallets(user_id) values(new.user_id) on conflict do nothing;
  select * into w from public.poster_test_wallets where user_id=new.user_id for update;
  if w.units-w.reserved_units<charge then raise exception 'poster_credits_empty';end if;
  update public.poster_test_wallets set reserved_units=reserved_units+charge where user_id=new.user_id;
  new.test_credit_units:=charge;new.test_credit_state:='reserved';
  insert into public.poster_test_credit_events(user_id,request_id,kind,units) values(new.user_id,new.id,'reserve',charge);
 elsif old.test_credit_state='reserved' and new.status in('complete','failed') then
  perform 1 from public.poster_test_wallets where user_id=new.user_id for update;
  if new.status='complete' then
   update public.poster_test_wallets set units=units-old.test_credit_units,reserved_units=reserved_units-old.test_credit_units where user_id=new.user_id;
   new.test_credit_state:='consumed';
   insert into public.poster_test_credit_events(user_id,request_id,kind,units) values(new.user_id,new.id,'consume',old.test_credit_units);
  else
   update public.poster_test_wallets set reserved_units=reserved_units-old.test_credit_units where user_id=new.user_id;
   new.test_credit_state:='released';
   insert into public.poster_test_credit_events(user_id,request_id,kind,units) values(new.user_id,new.id,'release',old.test_credit_units);
  end if;
 end if;
 return new;
end;$$;
revoke all on function poster_private.test_wallet_job() from public,anon,authenticated;
grant execute on function poster_private.test_wallet_job() to service_role;
create trigger poster_test_wallet_reservation before insert or update of status on public.poster_ai_jobs for each row execute function poster_private.test_wallet_job();
