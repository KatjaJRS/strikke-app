-- Kør først shared-projects.sql, derefter denne fil i Supabase SQL Editor.
-- Billeder er private, men medlemmer kan se billeder i delte projekter.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('yarn-labels', 'yarn-labels', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can upload yarn photos" on storage.objects;
create policy "Owners can upload yarn photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'yarn-labels' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Owners and members can read yarn photos" on storage.objects;
create policy "Owners and members can read yarn photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'yarn-labels'
  and (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    or exists (
      select 1 from public.projects p
      where p.user_id::text = (storage.foldername(name))[1]
        and p.is_shared = true
        and p.yarns::jsonb @> jsonb_build_array(
          jsonb_build_object('photos', jsonb_build_array(storage.objects.name))
        )
    )
  )
);

drop policy if exists "Owners can delete yarn photos" on storage.objects;
create policy "Owners can delete yarn photos"
on storage.objects for delete to authenticated
using (bucket_id = 'yarn-labels' and (storage.foldername(name))[1] = (select auth.uid()::text));
