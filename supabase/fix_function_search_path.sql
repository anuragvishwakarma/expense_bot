-- Pin search_path on update_updated_at_column to close the mutable search_path warning
-- (Supabase security advisor: function_search_path_mutable)
create or replace function public.update_updated_at_column()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
