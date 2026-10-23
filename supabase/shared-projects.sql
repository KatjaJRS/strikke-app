-- Delte projekter: kør denne fil én gang i Supabase → SQL Editor.
-- Hvert projekt har et flag, så ejeren selv vælger hvilke projekter andre må se.

alter table public.projects
  add column if not exists is_shared boolean not null default false;

drop policy if exists "Signed-in users can read shared projects" on public.projects;
create policy "Signed-in users can read shared projects"
  on public.projects for select
  to authenticated
  using (is_shared = true);
