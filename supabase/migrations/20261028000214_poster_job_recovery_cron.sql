-- Database-only watchdog: no HTTP credentials and no paid inference.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('poster-job-recovery','* * * * *','select poster_private.recover_stale_jobs();');
