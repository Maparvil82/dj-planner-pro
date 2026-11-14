-- Keep confirmation and completion durable, even when the client closes.
alter table public.poster_ai_jobs
 add column expected_poster_url text,
 add column session_poster_url text,
 add column session_poster_applied boolean not null default false;

create function public.reserve_session_poster_job(p_id uuid,p_user uuid,p_session uuid,p_parent uuid,p_hash text,p_form jsonb,p_instruction text,p_expected_poster text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; current_poster text;
begin
 -- Same lock order as the existing reservation, including its idempotent retry.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 if exists(select 1 from public.poster_ai_jobs where id=p_id) then
  return public.reserve_poster_ai_job(p_id,p_user,p_session,p_parent,p_hash,p_form,p_instruction);
 end if;
 select poster_url into current_poster from public.sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'poster_session_unavailable'; end if;
 if current_poster is distinct from p_expected_poster then raise exception 'poster_session_poster_changed'; end if;
 result := public.reserve_poster_ai_job(p_id,p_user,p_session,p_parent,p_hash,p_form,p_instruction);
 update public.poster_ai_jobs set expected_poster_url=current_poster where id=p_id and user_id=p_user;
 return result;
end;
$$;
revoke all on function public.reserve_session_poster_job(uuid,uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reserve_session_poster_job(uuid,uuid,uuid,uuid,text,jsonb,text,text) to service_role;

create function poster_private.apply_session_poster() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='complete' and old.status is distinct from 'complete' and new.session_poster_url is not null and new.output_path is not null then
  -- A manual replacement made while generation runs always wins.
  update public.sessions set poster_url=new.session_poster_url,poster_focus_x=0.5,poster_focus_y=0.5
   where id=new.session_id and user_id=new.user_id and poster_url is not distinct from new.expected_poster_url;
  new.session_poster_applied := found;
 end if;
 return new;
end;
$$;
revoke all on function poster_private.apply_session_poster() from public,anon,authenticated;
grant execute on function poster_private.apply_session_poster() to service_role;
create trigger apply_generated_session_poster before update of status on public.poster_ai_jobs
 for each row execute function poster_private.apply_session_poster();
