-- Personal expenses are separate from costs already deducted in fee agreements.
alter table public.expenses add column session_id uuid references public.sessions(id) on delete set null;
alter table public.expenses add column currency text not null default 'EUR';
alter table public.expenses add column receipt_path text;
alter table public.expenses add constraint expense_positive check (amount > 0 and amount < 100000000 and amount <> 'NaN'::numeric) not valid;
alter table public.expenses add constraint expense_currency check (currency ~ '^[A-Z]{3}$');
alter table public.expenses add constraint expense_receipt_owner check (receipt_path is null or receipt_path like user_id::text || '/%');
create index expenses_session_idx on public.expenses(session_id);
drop policy "Users can update their own expenses" on public.expenses;
create policy "Users can update their own expenses" on public.expenses for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.validate_session_expense() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_currency text;
begin
 if new.session_id is not null then
  select case s.currency when '€' then 'EUR' when '$' then 'USD' when '£' then 'GBP' when '¥' then 'JPY' else upper(s.currency) end into v_currency from public.sessions s where s.id=new.session_id and s.user_id=new.user_id;
  if v_currency is null then raise exception 'tools.invalidSession'; end if;
  if new.currency <> v_currency then raise exception 'tools.currencyMismatch'; end if;
 end if;
 return new;
end $$;
create trigger validate_session_expense before insert or update on public.expenses for each row execute function public.validate_session_expense();
revoke execute on function public.validate_session_expense() from public,anon,authenticated;
-- Avoid reinterpreting old expenses when the session currency changes.
create function public.guard_expense_currency() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.currency is distinct from old.currency and exists(select 1 from public.expenses e where e.session_id=old.id) then raise exception 'tools.currencyLocked'; end if;
 return new;
end $$;
create trigger guard_expense_currency before update of currency on public.sessions for each row execute function public.guard_expense_currency();
revoke execute on function public.guard_expense_currency() from public,anon,authenticated;

create table public.session_tasks (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references public.sessions(id) on delete cascade,
 title text not null check (length(btrim(title)) between 1 and 180),
 completed boolean not null default false,
 created_at timestamptz not null default now()
);
create index session_tasks_session_idx on public.session_tasks(session_id,created_at);
create index session_tasks_user_idx on public.session_tasks(user_id);
alter table public.session_tasks enable row level security;
create policy task_read on public.session_tasks for select to authenticated using ((select auth.uid())=user_id);
create policy task_insert on public.session_tasks for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid()) and s.status <> 'cancelled' and ((s.date+s.end_time::time + case when s.end_time::time<=s.start_time::time then interval '1 day' else interval '0 day' end) at time zone coalesce(s.booking_timezone,'UTC')) > now()));
create policy task_update on public.session_tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid())));
create policy task_delete on public.session_tasks for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.session_tasks to authenticated;
revoke all on public.session_tasks from anon;

create table public.blocked_days (
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,
 created_at timestamptz not null default now(),
 primary key(user_id,date)
);
alter table public.blocked_days enable row level security;
create policy block_read on public.blocked_days for select to authenticated using ((select auth.uid())=user_id);
create policy block_insert on public.blocked_days for insert to authenticated with check ((select auth.uid())=user_id);
create policy block_delete on public.blocked_days for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,delete on public.blocked_days to authenticated;
revoke all on public.blocked_days from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('expense-receipts','expense-receipts',false,614400,array['image/jpeg']);
create policy receipt_read on storage.objects for select to authenticated using (bucket_id='expense-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipt_insert on storage.objects for insert to authenticated with check (bucket_id='expense-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipt_delete on storage.objects for delete to authenticated using (bucket_id='expense-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
