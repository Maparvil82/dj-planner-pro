-- Complimentary guest-list admissions carry no monetary amount.
-- Preserve the currency lock for ordinary issued tickets only.
create or replace function ticketing_private.guard_currency() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.currency is distinct from old.currency and exists(
   select 1 from public.event_tickets where session_id=old.id and guest_id is null
 ) then raise exception 'tickets.currencyLocked'; end if;
 return new;
end $$;
