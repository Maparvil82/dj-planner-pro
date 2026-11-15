-- Explore is an authenticated gallery of completed artwork from every account.
-- Storage and job records remain private; only the Edge Function signs images.
create index if not exists poster_ai_jobs_gallery_created_id
  on public.poster_ai_jobs (created_at desc,id desc)
  where status='complete' and output_path is not null;
