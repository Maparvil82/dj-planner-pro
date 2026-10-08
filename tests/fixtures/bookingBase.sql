-- Reduced existing schema for an isolated PostgreSQL test instance. No credentials.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
grant usage on schema auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.sessions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
 date date not null, title text not null, venue text not null, start_time text, end_time text,
 color text, is_collective boolean default false,djs text[] default '{}',earning_type text default 'free',earning_amount numeric default 0,currency text default '€',recurrence_type text default 'none',status text default 'confirmed',
 recurrence_end_date date,venue_id uuid,poster_url text,dj_profile_ids uuid[] default '{}',poster_focus_x float8 default .5,poster_focus_y float8 default .5,parent_session_id uuid references public.sessions
);
alter table public.sessions enable row level security;
grant all on public.sessions to authenticated,service_role;
create policy own_sessions on public.sessions to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table public.session_collaborators(session_id uuid references public.sessions,dj_id uuid references auth.users,status text,primary key(session_id,dj_id));
create table public.community_profiles(user_id uuid primary key references auth.users,artist_name text,is_visible boolean default false);
create table public.community_session_shares(session_id uuid references public.sessions,user_id uuid references auth.users,primary key(session_id,user_id));
create table public.social_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid references auth.users,actor_id uuid not null references auth.users,kind text constraint social_notifications_kind_check check(kind in ('follow','shared_session','session_invitation','invitation_response','session_update')),actor_name text,session_title text,session_id uuid references public.sessions on delete cascade);
grant all on public.session_collaborators,public.community_profiles,public.community_session_shares,public.social_notifications to service_role;
