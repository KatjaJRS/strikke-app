create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (length(trim(sender_name)) between 1 and 200),
  message text not null check (length(trim(message)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.feedback enable row level security;

drop policy if exists "Members can send feedback" on public.feedback;
create policy "Members can send feedback" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid() and read_at is null);

drop policy if exists "Admins can read feedback" on public.feedback;
create policy "Admins can read feedback" on public.feedback
  for select to authenticated
  using (lower(auth.jwt() ->> 'email') in ('roldsgaardkatja@gmail.com', 'roldsgaard@gmail.com'));

drop policy if exists "Admins can mark feedback read" on public.feedback;
create policy "Admins can mark feedback read" on public.feedback
  for update to authenticated
  using (lower(auth.jwt() ->> 'email') in ('roldsgaardkatja@gmail.com', 'roldsgaard@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') in ('roldsgaardkatja@gmail.com', 'roldsgaard@gmail.com'));

revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (user_id, sender_name, message) on public.feedback to authenticated;
grant update (read_at) on public.feedback to authenticated;
