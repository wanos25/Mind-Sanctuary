-- Storage bucket for user-uploaded chat attachments (images, pdf, txt, docs)
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create policy "Users can upload own chat attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Anyone can read chat attachments"
on storage.objects for select
to public
using (bucket_id = 'chat-attachments');

create policy "Users can delete own chat attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
