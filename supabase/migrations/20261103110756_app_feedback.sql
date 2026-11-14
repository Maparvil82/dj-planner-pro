create table public.app_feedback (
 id uuid primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 category text not null check(category in ('bug','idea','account','language','other')),
 message text not null check(char_length(btrim(message)) between 10 and 3000),
 language text not null check(char_length(language) between 2 and 20),
 status text not null default 'new' check(status in ('new','reviewed','resolved')),
 created_at timestamptz not null default now()
);
create index app_feedback_inbox on public.app_feedback(status,created_at desc);
create index app_feedback_user on public.app_feedback(user_id);
alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from public,anon,authenticated;
grant insert(id,category,message,language) on public.app_feedback to authenticated;
grant all on public.app_feedback to service_role;
create policy feedback_submit on public.app_feedback for insert to authenticated
 with check(user_id=(select auth.uid()));
