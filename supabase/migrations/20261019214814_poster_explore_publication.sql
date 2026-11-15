alter table public.poster_ai_jobs add column if not exists is_published boolean not null default false;
create index if not exists poster_ai_jobs_explore_idx on public.poster_ai_jobs (created_at desc) where is_published = true and status = 'complete';
