insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-patterns',
  'project-patterns',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own pattern files" on storage.objects;
create policy "Users can read their own pattern files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-patterns'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload their own pattern files" on storage.objects;
create policy "Users can upload their own pattern files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-patterns'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their own pattern files" on storage.objects;
create policy "Users can update their own pattern files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-patterns'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'project-patterns'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own pattern files" on storage.objects;
create policy "Users can delete their own pattern files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-patterns'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
