-- Sandbox receipts only. Production payments remain disabled.
create table public.poster_sandbox_receipts(receipt_id text primary key,user_id uuid not null references auth.users(id) on delete cascade,product_id text not null,units integer not null check(units in(10,24)),created_at timestamptz not null default now());
alter table public.poster_sandbox_receipts enable row level security;
revoke all on public.poster_sandbox_receipts from public,anon,authenticated;
grant select,insert on public.poster_sandbox_receipts to service_role;
create function public.poster_grant_sandbox_receipt(p_user uuid,p_receipt text,p_product text) returns void language plpgsql security invoker set search_path='' as $$
declare amount integer; existing public.poster_sandbox_receipts;
begin
 if p_user<>'d5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid then raise exception 'poster_forbidden';end if;
 amount:=case p_product when 'com.djplannerpro.app.postercredits5' then 10 when 'com.djplannerpro.app.postercredits12' then 24 else null end;
 if amount is null or length(p_receipt)<1 or length(p_receipt)>200 then raise exception 'poster_invalid_input';end if;
 insert into public.poster_test_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.poster_test_wallets where user_id=p_user for update;
 select * into existing from public.poster_sandbox_receipts where receipt_id=p_receipt;
 if found then
  if existing.user_id<>p_user or existing.product_id<>p_product then raise exception 'poster_id_conflict';end if;
  return;
 end if;
 insert into public.poster_sandbox_receipts(receipt_id,user_id,product_id,units) values(p_receipt,p_user,p_product,amount);
 update public.poster_test_wallets set units=units+amount where user_id=p_user;
end;$$;
revoke all on function public.poster_grant_sandbox_receipt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.poster_grant_sandbox_receipt(uuid,text,text) to service_role;
