create index expenses_owner_date_idx on public.expenses(user_id,date desc,id);
alter policy "Users can view their own expenses" on public.expenses to authenticated using ((select auth.uid())=user_id);
alter policy "Users can insert their own expenses" on public.expenses to authenticated with check ((select auth.uid())=user_id);
alter policy "Users can delete their own expenses" on public.expenses to authenticated using ((select auth.uid())=user_id);
