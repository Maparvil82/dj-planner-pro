-- One identity, with a separate safe projection for community readers.
-- Keep existing biographies, cities, visibility, follows and sharing consent.
update public.users_profile p
set artist_name = case when length(btrim(p.artist_name)) between 1 and 80 then btrim(p.artist_name) else c.artist_name end,
    avatar_url = coalesce(p.avatar_url, c.avatar_url), updated_at = now()
from public.community_profiles c where p.id = c.user_id;
update public.community_profiles c
set artist_name = p.artist_name, avatar_url = p.avatar_url
from public.users_profile p where p.id = c.user_id;

create function community_private.sync_profile_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    update public.community_profiles
    set artist_name = coalesce(nullif(btrim(new.artist_name), ''), artist_name),
        avatar_url = new.avatar_url
    where user_id = new.id;
    return new;
end;
$$;
revoke all on function community_private.sync_profile_identity() from public, anon, authenticated;
create trigger sync_community_identity
    after update of artist_name, avatar_url on public.users_profile
    for each row execute function community_private.sync_profile_identity();

-- Direct social writes cannot create an identity that differs from the account.
drop policy community_profiles_insert on public.community_profiles;
create policy community_profiles_insert on public.community_profiles for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
    select 1 from public.users_profile p where p.id = user_id
      and p.artist_name = community_profiles.artist_name
      and p.avatar_url is not distinct from community_profiles.avatar_url
));
drop policy community_profiles_update on public.community_profiles;
create policy community_profiles_update on public.community_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (
    select 1 from public.users_profile p where p.id = user_id
      and p.artist_name = community_profiles.artist_name
      and p.avatar_url is not distinct from community_profiles.avatar_url
));

create function public.save_unified_profile(input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    owner_id uuid := auth.uid();
    artist text := btrim(coalesce(input->>'artist_name', ''));
    avatar text := nullif(input->>'avatar_url', '');
    account public.users_profile;
    social public.community_profiles;
begin
    if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
    if length(artist) not between 1 and 80 then raise exception 'Invalid artist name' using errcode = '22023'; end if;
    -- Transactional save: a failed social validation also rolls back the account update.
    insert into public.users_profile (id, artist_name, avatar_url, updated_at)
    values (owner_id, artist, avatar, now())
    on conflict (id) do update set artist_name = excluded.artist_name, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at
    returning * into account;
    insert into public.community_profiles (user_id, artist_name, avatar_url, city, genres, bio, is_visible)
    values (owner_id, artist, avatar, btrim(coalesce(input->>'city','')), btrim(coalesce(input->>'genres','')),
        btrim(coalesce(input->>'bio','')), coalesce((input->>'is_visible')::boolean, false))
    on conflict (user_id) do update set artist_name = excluded.artist_name, avatar_url = excluded.avatar_url,
        city = excluded.city, genres = excluded.genres, bio = excluded.bio, is_visible = excluded.is_visible
    returning * into social;
    return jsonb_build_object('profile', to_jsonb(account), 'community', to_jsonb(social));
end;
$$;
revoke all on function public.save_unified_profile(jsonb) from public, anon;
grant execute on function public.save_unified_profile(jsonb) to authenticated;
