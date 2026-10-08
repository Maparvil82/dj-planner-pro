-- Optional presentation fields; existing opt-in and owner-only write policies apply.
alter table public.community_profiles
    add column cover_url text,
    add column mixcloud_url text not null default '',
    add column soundcloud_url text not null default '',
    add column instagram_url text not null default '',
    add constraint community_cover_url_valid check (cover_url is null or (length(cover_url) <= 2048 and cover_url ~ '^https://[^[:space:]<>]+$'));
alter table public.community_profiles add constraint community_mixcloud_url_valid check (mixcloud_url = '' or (length(mixcloud_url) <= 500 and mixcloud_url ~ '^https://(www[.])?mixcloud[.]com(/[^[:space:]<>]*)?$'));
alter table public.community_profiles add constraint community_soundcloud_url_valid check (soundcloud_url = '' or (length(soundcloud_url) <= 500 and soundcloud_url ~ '^https://(www[.])?soundcloud[.]com(/[^[:space:]<>]*)?$'));
alter table public.community_profiles add constraint community_instagram_url_valid check (instagram_url = '' or (length(instagram_url) <= 500 and instagram_url ~ '^https://(www[.])?instagram[.]com(/[^[:space:]<>]*)?$'));

create or replace function public.save_unified_profile(input jsonb)
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
    insert into public.community_profiles (user_id, artist_name, avatar_url, city, genres, bio, is_visible, cover_url, mixcloud_url, soundcloud_url, instagram_url)
    values (owner_id, artist, avatar, btrim(coalesce(input->>'city','')), btrim(coalesce(input->>'genres','')),
        btrim(coalesce(input->>'bio','')), coalesce((input->>'is_visible')::boolean, false), nullif(btrim(input->>'cover_url'), ''), btrim(coalesce(input->>'mixcloud_url','')), btrim(coalesce(input->>'soundcloud_url','')), btrim(coalesce(input->>'instagram_url','')))
    on conflict (user_id) do update set artist_name = excluded.artist_name, avatar_url = excluded.avatar_url,
        city = excluded.city, genres = excluded.genres, bio = excluded.bio, is_visible = excluded.is_visible,
        cover_url = case when input ? 'cover_url' then excluded.cover_url else community_profiles.cover_url end,
        mixcloud_url = case when input ? 'mixcloud_url' then excluded.mixcloud_url else community_profiles.mixcloud_url end,
        soundcloud_url = case when input ? 'soundcloud_url' then excluded.soundcloud_url else community_profiles.soundcloud_url end,
        instagram_url = case when input ? 'instagram_url' then excluded.instagram_url else community_profiles.instagram_url end
    returning * into social;
    return jsonb_build_object('profile', to_jsonb(account), 'community', to_jsonb(social));
end;
$$;
revoke all on function public.save_unified_profile(jsonb) from public, anon;
grant execute on function public.save_unified_profile(jsonb) to authenticated;
