-- BASELINE: já aplicada no Supabase em 2026-06-16. Não reaplicar.

-- Fixa search_path (evita hijack via search_path mutável) e mantém schema-qualified
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name','Daniel'));
  return new;
end;
$$;

create or replace function public.update_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Função de trigger não precisa ser chamável via RPC: remove EXECUTE do público
revoke execute on function public.handle_new_user() from public, anon, authenticated;
