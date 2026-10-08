-- Receipts of costs already deducted from a conditional fee are recorded once.
alter table public.expenses add column included_in_agreement boolean not null default false;
