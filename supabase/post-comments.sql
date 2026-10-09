insert into public.groups (id, name, invited_people)
values ('group-community', 'Knitting community', '[]'::jsonb)
on conflict (id) do update
set name = excluded.name;

alter table public.messages
  add column if not exists author_id uuid references auth.users(id) on delete set null;

update public.messages as message
set author_id = (
  select min(profile.id::text)::uuid
  from public.profiles as profile
  where lower(trim(profile.name)) = lower(trim(message.sender_name))
)
where message.group_id = 'group-community'
  and message.author_id is null
  and (
    select count(*)
    from public.profiles as profile
    where lower(trim(profile.name)) = lower(trim(message.sender_name))
  ) = 1;

drop policy if exists "Signed-in users can read community posts" on public.messages;
create policy "Signed-in users can read community posts"
  on public.messages for select
  to authenticated
  using (group_id = 'group-community');

drop policy if exists "Users can add their own community posts" on public.messages;
create policy "Users can add their own community posts"
  on public.messages for insert
  to authenticated
  with check (group_id = 'group-community' and author_id = auth.uid());

drop policy if exists "Users can edit their own community posts" on public.messages;
create policy "Users can edit their own community posts"
  on public.messages for update
  to authenticated
  using (group_id = 'group-community' and author_id = auth.uid())
  with check (group_id = 'group-community' and author_id = auth.uid());

drop policy if exists "Users can delete their own community posts" on public.messages;
create policy "Users can delete their own community posts"
  on public.messages for delete
  to authenticated
  using (group_id = 'group-community' and author_id = auth.uid());

grant select, insert, update, delete on public.messages to authenticated;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "Signed-in users can read post comments" on public.post_comments;
create policy "Signed-in users can read post comments"
  on public.post_comments for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages
      where messages.id = post_comments.post_id
        and messages.group_id = 'group-community'
    )
  );

drop policy if exists "Users can add their own post comments" on public.post_comments;
create policy "Users can add their own post comments"
  on public.post_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages
      where messages.id = post_comments.post_id
        and messages.group_id = 'group-community'
    )
  );

drop policy if exists "Users can edit their own post comments" on public.post_comments;
create policy "Users can edit their own post comments"
  on public.post_comments for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages
      where messages.id = post_comments.post_id
        and messages.group_id = 'group-community'
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages
      where messages.id = post_comments.post_id
        and messages.group_id = 'group-community'
    )
  );

drop policy if exists "Users can delete their own post comments" on public.post_comments;
create policy "Users can delete their own post comments"
  on public.post_comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages
      where messages.id = post_comments.post_id
        and messages.group_id = 'group-community'
    )
  );

grant select, insert, update, delete on public.post_comments to authenticated;

create table if not exists public.post_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  post_id text not null references public.messages(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  notification_type text not null check (notification_type in ('new_post', 'new_comment', 'mention')),
  actor_name text not null,
  message_preview text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists post_notifications_recipient_created_idx
  on public.post_notifications (recipient_id, created_at desc);

alter table public.post_notifications enable row level security;

drop policy if exists "Users can read their own post notifications" on public.post_notifications;
create policy "Users can read their own post notifications"
  on public.post_notifications for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Users can mark their own post notifications read" on public.post_notifications;
create policy "Users can mark their own post notifications read"
  on public.post_notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select, update on public.post_notifications to authenticated;

alter table public.post_notifications
  drop constraint if exists post_notifications_notification_type_check;
alter table public.post_notifications
  add constraint post_notifications_notification_type_check
  check (notification_type in ('new_post', 'new_comment', 'mention'));

create or replace function public.notify_community_post()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  post_author_id uuid := coalesce(new.author_id, auth.uid());
begin
  if new.group_id <> 'group-community' then
    return new;
  end if;

  insert into public.post_notifications (
    recipient_id, actor_id, post_id, notification_type, actor_name, message_preview
  )
  select
    users.id,
    post_author_id,
    new.id,
    'new_post',
    coalesce(new.sender_name, 'Member'),
    left(coalesce(new.text, ''), 160)
  from auth.users as users
  where users.id <> post_author_id
    and not exists (
      select 1
      from public.profiles as profile
      cross join lateral (
        select position(lower('@' || profile.name) in lower(coalesce(new.text, ''))) as mention_position
      ) as mention
      where profile.id = users.id
        and mention.mention_position > 0
        and (
          char_length(coalesce(new.text, '')) = mention.mention_position + char_length(profile.name)
          or substring(
            coalesce(new.text, '')
            from mention.mention_position + char_length(profile.name) + 1
            for 1
          ) !~ '[[:alnum:]_]'
        )
    );

  insert into public.post_notifications (
    recipient_id, actor_id, post_id, notification_type, actor_name, message_preview
  )
  select distinct
    profile.id,
    post_author_id,
    new.id,
    'mention',
    coalesce(new.sender_name, 'Member'),
    left(coalesce(new.text, ''), 160)
  from public.profiles as profile
  cross join lateral (
    select position(lower('@' || profile.name) in lower(coalesce(new.text, ''))) as mention_position
  ) as mention
  where profile.id <> post_author_id
    and mention.mention_position > 0
    and (
      char_length(coalesce(new.text, '')) = mention.mention_position + char_length(profile.name)
      or substring(
        coalesce(new.text, '')
        from mention.mention_position + char_length(profile.name) + 1
        for 1
      ) !~ '[[:alnum:]_]'
    );

  return new;
end;
$$;

drop trigger if exists community_post_notification on public.messages;
create trigger community_post_notification
  after insert on public.messages
  for each row execute function public.notify_community_post();

create or replace function public.notify_community_comment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  post_author_id uuid;
begin
  select coalesce(
    message.author_id,
    (
      select min(profile.id::text)::uuid
      from public.profiles as profile
      where lower(trim(profile.name)) = lower(trim(message.sender_name))
      having count(*) = 1
    )
  )
  into post_author_id
  from public.messages as message
  where message.id = new.post_id
    and message.group_id = 'group-community';

  if post_author_id is not null and post_author_id <> new.user_id
     and not exists (
       select 1
       from public.profiles as profile
       cross join lateral (
         select position(lower('@' || profile.name) in lower(new.text)) as mention_position
       ) as mention
       where profile.id = post_author_id
         and mention.mention_position > 0
         and (
           char_length(new.text) = mention.mention_position + char_length(profile.name)
           or substring(
             new.text
             from mention.mention_position + char_length(profile.name) + 1
             for 1
           ) !~ '[[:alnum:]_]'
         )
     ) then
    insert into public.post_notifications (
      recipient_id, actor_id, post_id, comment_id,
      notification_type, actor_name, message_preview
    )
    values (
      post_author_id, new.user_id, new.post_id, new.id,
      'new_comment', new.sender_name, left(new.text, 160)
    );
  end if;

  insert into public.post_notifications (
    recipient_id, actor_id, post_id, comment_id,
    notification_type, actor_name, message_preview
  )
  select distinct
    profile.id, new.user_id, new.post_id, new.id,
    'mention', new.sender_name, left(new.text, 160)
  from public.profiles as profile
  cross join lateral (
    select position(lower('@' || profile.name) in lower(new.text)) as mention_position
  ) as mention
  where profile.id <> new.user_id
    and mention.mention_position > 0
    and (
      char_length(new.text) = mention.mention_position + char_length(profile.name)
      or substring(
        new.text
        from mention.mention_position + char_length(profile.name) + 1
        for 1
      ) !~ '[[:alnum:]_]'
    );

  return new;
end;
$$;

drop trigger if exists community_comment_notification on public.post_comments;
create trigger community_comment_notification
  after insert on public.post_comments
  for each row execute function public.notify_community_comment();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'post_comments'
     ) then
    alter publication supabase_realtime add table public.post_comments;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'post_notifications'
     ) then
    alter publication supabase_realtime add table public.post_notifications;
  end if;
end
$$;
