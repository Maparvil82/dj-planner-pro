create table public.social_notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references auth.users(id) on delete cascade,
    actor_id uuid not null references auth.users(id) on delete cascade,
    kind text not null check(kind in ('follow','shared_session','session_invitation','invitation_response','session_update')),
    session_id uuid references public.sessions(id) on delete cascade,
    actor_name text not null,
    session_title text,
    response text check(response is null or response in ('accepted','declined')),
    created_at timestamptz not null default now(),
    read_at timestamptz
);
alter table public.social_notifications enable row level security;
revoke all on public.social_notifications from public,anon,authenticated;
grant select on public.social_notifications to authenticated;
grant update(read_at) on public.social_notifications to authenticated;
create policy social_notifications_read on public.social_notifications for select to authenticated
using(recipient_id=(select auth.uid()));
create policy social_notifications_mark_read on public.social_notifications for update to authenticated
using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create index social_notifications_recipient_created_idx on public.social_notifications(recipient_id,created_at desc,id);
create index social_notifications_unread_idx on public.social_notifications(recipient_id) where read_at is null;
create index social_notifications_actor_idx on public.social_notifications(actor_id);
create index social_notifications_session_idx on public.social_notifications(session_id) where session_id is not null;

create function community_private.notify_social_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; actor_name text; title text;
begin
    if TG_TABLE_NAME='community_follows' then
        select p.artist_name into actor_name from public.community_profiles p where p.user_id=new.follower_id and p.is_visible;
        if actor_name is not null then
            insert into public.social_notifications(recipient_id,actor_id,kind,actor_name)
            values(new.following_id,new.follower_id,'follow',actor_name);
        end if;
    elsif TG_TABLE_NAME='community_session_shares' then
        select s.title,p.artist_name into title,actor_name from public.sessions s
          join public.community_profiles p on p.user_id=s.user_id and p.is_visible
          where s.id=new.session_id and s.user_id=new.user_id and s.status='confirmed';
        if actor_name is not null then
            insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title)
            select f.follower_id,new.user_id,'shared_session',new.session_id,actor_name,title
            from public.community_follows f where f.following_id=new.user_id;
        end if;
    elsif TG_TABLE_NAME='session_collaborators' then
        select s.title into title from public.sessions s where s.id=new.session_id;
        if TG_OP='INSERT' then
            select p.artist_name into actor_name from public.users_profile p where p.id=new.inviter_id;
            insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title)
            values(new.dj_id,new.inviter_id,'session_invitation',new.session_id,coalesce(actor_name,'DJ'),title);
        elsif new.status is distinct from old.status then
            select p.artist_name into actor_name from public.users_profile p where p.id=new.dj_id;
            insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title,response)
            values(new.inviter_id,new.dj_id,'invitation_response',new.session_id,coalesce(actor_name,new.artist_name),title,new.status);
        end if;
    elsif TG_TABLE_NAME='sessions' and (new.title,new.venue,new.date,new.start_time,new.end_time,new.status) is distinct from (old.title,old.venue,old.date,old.start_time,old.end_time,old.status) then
        select p.artist_name into actor_name from public.users_profile p where p.id=new.user_id;
        insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title)
        select i.dj_id,new.user_id,'session_update',new.id,coalesce(actor_name,'DJ'),new.title
        from public.session_collaborators i where i.session_id=new.id and i.status in ('invited','accepted');
    end if;
    return new;
end;
$$;
revoke all on function community_private.notify_social_activity() from public,anon,authenticated;
create trigger notify_new_follow after insert on public.community_follows for each row execute function community_private.notify_social_activity();
create trigger notify_shared_session after insert on public.community_session_shares for each row execute function community_private.notify_social_activity();
create trigger notify_session_invitation after insert or update of status on public.session_collaborators for each row execute function community_private.notify_social_activity();
create trigger notify_session_updates after update of title,venue,date,start_time,end_time,status on public.sessions for each row execute function community_private.notify_social_activity();
