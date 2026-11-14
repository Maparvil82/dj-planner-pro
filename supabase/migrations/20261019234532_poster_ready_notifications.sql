alter table public.social_notifications add column poster_job_id uuid references public.poster_ai_jobs(id) on delete cascade;
alter table public.social_notifications drop constraint social_notifications_kind_check;
alter table public.social_notifications add constraint social_notifications_kind_check check(kind in ('follow','shared_session','session_invitation','invitation_response','session_update','booking_request','booking_message','booking_confirmed','poster_ready'));
create unique index social_notifications_poster_once on public.social_notifications(poster_job_id) where poster_job_id is not null;
grant insert on public.social_notifications to service_role;
create or replace function poster_private.notify_ready() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.status='complete' and old.status is distinct from 'complete' and new.output_path is not null then
  insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title,poster_job_id)
  values(new.user_id,new.user_id,'poster_ready',new.session_id,'DJ Planner',new.form->>'title',new.id)
  on conflict (poster_job_id) where poster_job_id is not null do nothing;
 end if;
 return new;
end;
$$;
revoke all on function poster_private.notify_ready() from public,anon,authenticated;
grant execute on function poster_private.notify_ready() to service_role;
create trigger poster_ready_notification after update of status on public.poster_ai_jobs for each row execute function poster_private.notify_ready();
