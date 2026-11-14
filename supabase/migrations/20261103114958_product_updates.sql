create table public.product_updates (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('release','roadmap')),
 version text,
 status text not null check(status in ('published','in_development','under_consideration')),
 content jsonb not null check(jsonb_typeof(content)='object'),
 published_on date,
 sort_order integer not null default 0,
 visible boolean not null default false,
 created_at timestamptz not null default now(),
 check((kind='release' and status='published' and version is not null) or (kind='roadmap' and status in ('in_development','under_consideration')))
);
alter table public.product_updates enable row level security;
revoke all on public.product_updates from public,anon,authenticated;
grant select on public.product_updates to authenticated;
grant all on public.product_updates to service_role;
create policy product_updates_read on public.product_updates for select to authenticated using(visible);
create index product_updates_visible on public.product_updates(kind,sort_order,published_on desc) where visible;
