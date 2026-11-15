-- Keep the narrowly scoped privileged navigation check outside the exposed API schema.
alter function public.poster_feature_access() set schema poster_private;
grant usage on schema poster_private to authenticated;
create function public.poster_feature_access() returns boolean language sql stable security invoker set search_path='' as $$
 select poster_private.poster_feature_access();
$$;
revoke all on function public.poster_feature_access() from public,anon;
grant execute on function public.poster_feature_access() to authenticated;

-- Cover poster account/session deletion and parent lookups as usage grows.
create index poster_ai_jobs_session on public.poster_ai_jobs(session_id);
create index poster_ai_jobs_parent on public.poster_ai_jobs(parent_id) where parent_id is not null;
create index poster_sandbox_receipts_user on public.poster_sandbox_receipts(user_id);
create index poster_test_credit_events_user on public.poster_test_credit_events(user_id);
