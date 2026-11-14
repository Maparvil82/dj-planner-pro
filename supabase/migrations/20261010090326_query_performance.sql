-- Same ownership rules, with auth evaluated once per statement.
-- Remove only the known duplicate profile policies.
drop policy if exists "Users can insert their own profile" on public.users_profile;
drop policy if exists "Users can update their own profile" on public.users_profile;
drop policy if exists "Users can view their own profile" on public.users_profile;
alter policy "Users can view own profile" on public.users_profile to authenticated using ((select auth.uid())=id);
alter policy "Users can insert own profile" on public.users_profile to authenticated with check ((select auth.uid())=id);
alter policy "Users can update own profile" on public.users_profile to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
alter policy "Users can view own sessions" on public.sessions to authenticated using ((select auth.uid())=user_id);
alter policy "Users can insert own sessions" on public.sessions to authenticated with check ((select auth.uid())=user_id);
alter policy "Users can update own sessions" on public.sessions to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter policy "Users can delete own sessions" on public.sessions to authenticated using ((select auth.uid())=user_id);
alter policy "Users can view their own tags." on public.user_tags to authenticated using ((select auth.uid())=user_id);
alter policy "Users can insert their own tags." on public.user_tags to authenticated with check ((select auth.uid())=user_id);
alter policy "Users can update their own tags." on public.user_tags to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter policy "Users can delete their own tags." on public.user_tags to authenticated using ((select auth.uid())=user_id);
alter policy "Users can manage their own venues" on public.venues to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter policy "Users can manage their own files" on public.vault_files to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter policy "Users can manage their own folders" on public.vault_folders to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index if not exists sessions_owner_date_idx on public.sessions (user_id,date,id);
create index if not exists sessions_parent_idx on public.sessions (parent_session_id);
create index if not exists vault_files_folder_idx on public.vault_files (folder_id);
create index if not exists vault_files_owner_idx on public.vault_files (user_id);
create index if not exists vault_folders_owner_idx on public.vault_folders (user_id);
create index if not exists reports_author_idx on community_private.reports (author_id);
create index if not exists reports_reviewer_idx on community_private.reports (reviewed_by);
create index if not exists removed_content_report_idx on community_private.removed_content (report_id);
create index if not exists review_log_report_idx on community_private.review_log (report_id);
create index if not exists review_log_moderator_idx on community_private.review_log (moderator_id);
create index if not exists booking_outbox_request_idx on booking_private.email_outbox (request_id);

-- Fetch just the accepted guest agenda for the displayed date range, omitting finances.
create function community_private.agenda_range(from_date date,to_date date,page_offset integer)
returns setof jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',s.id,'user_id',s.user_id,'date',s.date,'title',s.title,'venue',s.venue,
 'venue_city',s.venue_city,'venue_city_location',s.venue_city_location,'venue_address',s.venue_address,
 'booking_timezone',s.booking_timezone,'start_time',s.start_time,'end_time',s.end_time,'color',s.color,
 'status',s.status,'poster_url',s.poster_url,'poster_focus_x',s.poster_focus_x,'poster_focus_y',s.poster_focus_y,
 'is_collective',true,'djs','[]'::jsonb,'earning_type','free','earning_amount',0,'currency',s.currency,
 'created_at',s.created_at,'updated_at',s.updated_at,'is_guest',true,'owner_name',coalesce(p.artist_name,'DJ'))
from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id
left join public.users_profile p on p.id=s.user_id
where (select auth.uid()) is not null and i.dj_id=(select auth.uid()) and i.status='accepted'
 and (from_date is null or s.date>=from_date) and (to_date is null or s.date<to_date)
order by s.date,s.id limit 1000 offset greatest(coalesce(page_offset,0),0);
$$;
revoke all on function community_private.agenda_range(date,date,integer) from public,anon,authenticated;
grant execute on function community_private.agenda_range(date,date,integer) to authenticated;
create function public.session_agenda_range(from_date date,to_date date default null,page_offset integer default 0)
returns setof jsonb language sql stable security invoker set search_path='' as $$
 select * from community_private.agenda_range(from_date,to_date,page_offset);
$$;
revoke all on function public.session_agenda_range(date,date,integer) from public,anon,authenticated;
grant execute on function public.session_agenda_range(date,date,integer) to authenticated;
