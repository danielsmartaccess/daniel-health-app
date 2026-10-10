-- BASELINE: já aplicada no Supabase em 2026-06-16. Não reaplicar.
-- ATENÇÃO: esta migration abriu o acesso a todas as tabelas antigas (ver Card 6.0).

-- App sem login: dono único fixo + acesso aberto via anon key

-- 1) Remove dependência de auth.users
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
alter table profiles drop constraint if exists profiles_id_fkey;

-- 2) Cria o dono único (id fixo usado pelo app)
insert into profiles (id, email, name)
values ('00000000-0000-0000-0000-000000000001','daniel@local','Daniel')
on conflict (id) do nothing;

-- 3) Substitui políticas RLS por acesso aberto (anon + authenticated)
drop policy if exists "Usuário vê apenas seu perfil" on profiles;
drop policy if exists "Usuário vê apenas seus logs" on daily_logs;
drop policy if exists "Usuário vê apenas seus exercícios" on exercises;
drop policy if exists "Usuário vê apenas suas refeições" on meals;
drop policy if exists "Usuário vê apenas sua biometria" on biometrics;
drop policy if exists "Usuário vê apenas seus medicamentos" on medications;
drop policy if exists "Usuário vê apenas seu log de álcool" on alcohol_log;
drop policy if exists "Usuário vê apenas seus exames" on lab_results;

create policy "open_access" on profiles    for all to anon, authenticated using (true) with check (true);
create policy "open_access" on daily_logs  for all to anon, authenticated using (true) with check (true);
create policy "open_access" on exercises   for all to anon, authenticated using (true) with check (true);
create policy "open_access" on meals       for all to anon, authenticated using (true) with check (true);
create policy "open_access" on biometrics  for all to anon, authenticated using (true) with check (true);
create policy "open_access" on medications for all to anon, authenticated using (true) with check (true);
create policy "open_access" on alcohol_log for all to anon, authenticated using (true) with check (true);
create policy "open_access" on lab_results for all to anon, authenticated using (true) with check (true);
