-- One-time introduction independent from DJ profile completion or purchases.
create table poster_private.intro_completions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 completed_at timestamptz not null default now()
);
alter table poster_private.intro_completions enable row level security;
revoke all on poster_private.intro_completions from public,anon,authenticated;
grant select on poster_private.intro_completions to authenticated;
create policy own_intro_read on poster_private.intro_completions for select to authenticated
 using(user_id=(select auth.uid()));
create function public.poster_intro_seen() returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from poster_private.intro_completions where user_id=(select auth.uid()));
$$;
create function public.complete_poster_intro() returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare viewer uuid:=(select auth.uid());
begin
 if viewer is null or not account_private.active_user(viewer) then raise insufficient_privilege;end if;
 insert into poster_private.intro_completions(user_id) values(viewer) on conflict(user_id) do nothing;
 return true;
end $$;
revoke all on function public.poster_intro_seen() from public,anon;
revoke all on function public.complete_poster_intro() from public,anon;
grant execute on function public.poster_intro_seen() to authenticated;
grant execute on function public.complete_poster_intro() to authenticated;
