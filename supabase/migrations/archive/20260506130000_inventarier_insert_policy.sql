-- Allow authenticated app users to create new inventory items
create policy "authenticated_insert_inventarier"
  on inventarier for insert
  to authenticated
  with check (true);
