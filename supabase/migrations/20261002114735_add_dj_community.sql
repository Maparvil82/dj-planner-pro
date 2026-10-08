-- Explicit opt-in. Existing private profile/session policies remain unchanged.
create table public.community_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    artist_name text not null check (length(btrim(artist_name)) between 1 and 80),
    city text not null default '' check (length(city) <= 100),
    bio text not null default '' check (length(bio) <= 500),
    genres text not null default '' check (length(genres) <= 120),
    avatar_url text check (avatar_url is null or length(avatar_url) <= 2048),
    is_visible boolean not null default false,
    created_at timestamptz not null default now()
);
alter table public.community_profiles enable row level security;
revoke all on public.community_profiles from anon, authenticated;
grant select, insert, update on public.community_profiles to authenticated;
create policy community_profiles_read on public.community_profiles for select to authenticated
    using (user_id = (select auth.uid()) or is_visible);
create policy community_profiles_insert on public.community_profiles for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy community_profiles_update on public.community_profiles for update to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index community_profiles_visible_created_idx on public.community_profiles (created_at desc, user_id) where is_visible;

create table public.community_follows (
    follower_id uuid not null references auth.users(id) on delete cascade,
    following_id uuid not null references public.community_profiles(user_id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (follower_id, following_id),
    check (follower_id <> following_id)
);
alter table public.community_follows enable row level security;
revoke all on public.community_follows from anon, authenticated;
grant select, insert, delete on public.community_follows to authenticated;
create policy community_follows_read on public.community_follows for select to authenticated
    using (follower_id = (select auth.uid()));
create policy community_follows_insert on public.community_follows for insert to authenticated
    with check (follower_id = (select auth.uid())
      and exists (select 1 from public.community_profiles p where p.user_id = following_id and p.is_visible)
      and exists (select 1 from public.community_profiles p where p.user_id = (select auth.uid()) and p.is_visible));
create policy community_follows_delete on public.community_follows for delete to authenticated
    using (follower_id = (select auth.uid()));
create index community_follows_following_idx on public.community_follows (following_id);

create table public.community_session_shares (
    session_id uuid primary key references public.sessions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.community_session_shares enable row level security;
revoke all on public.community_session_shares from anon, authenticated;
grant select, insert, delete on public.community_session_shares to authenticated;
create policy community_shares_read on public.community_session_shares for select to authenticated
    using (user_id = (select auth.uid()));
create policy community_shares_insert on public.community_session_shares for insert to authenticated
    with check (user_id = (select auth.uid())
      and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()) and s.status = 'confirmed')
      and exists (select 1 from public.community_profiles p where p.user_id = (select auth.uid()) and p.is_visible));
create policy community_shares_delete on public.community_session_shares for delete to authenticated
    using (user_id = (select auth.uid()));
create index community_shares_user_created_idx on public.community_session_shares (user_id, created_at desc, session_id);
create index community_shares_created_idx on public.community_session_shares (created_at desc, session_id);

create type public.community_session_card as (
    session_id uuid, author_id uuid, artist_name text, avatar_url text,
    title text, venue text, city text, date date, start_time text, end_time text,
    poster_url text, shared_at timestamptz
);
-- Only this narrowly scoped projection may read another DJ's private sessions.
-- Internal implementation is outside the exposed schema; no client can request extra fields.
create schema if not exists community_private;
revoke all on schema community_private from public, anon;
grant usage on schema community_private to authenticated;
create function community_private.session_feed(only_following boolean, author uuid, page_offset integer, page_size integer)
returns setof public.community_session_card
language sql stable security definer set search_path = ''
as $$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at
    from public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and s.status = 'confirmed'
      and (author is null or s.user_id = author)
      and (not coalesce(only_following, false) or exists (
        select 1 from public.community_follows f where f.follower_id = (select auth.uid()) and f.following_id = s.user_id
      ))
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$$;
revoke all on function community_private.session_feed(boolean, uuid, integer, integer) from public, anon;
grant execute on function community_private.session_feed(boolean, uuid, integer, integer) to authenticated;
create function public.community_feed(only_following boolean default false, author uuid default null, page_offset integer default 0, page_size integer default 30)
returns setof public.community_session_card
language sql stable security invoker set search_path = ''
as $$ select * from community_private.session_feed(only_following, author, page_offset, page_size); $$;
revoke all on function public.community_feed(boolean, uuid, integer, integer) from public, anon;
grant execute on function public.community_feed(boolean, uuid, integer, integer) to authenticated;
