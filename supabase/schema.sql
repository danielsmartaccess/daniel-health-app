-- ============================================================
-- Daniel Health App — Supabase Schema v1.0
-- ============================================================
-- Executar no Supabase SQL Editor

-- Habilitar extensões
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text not null default 'Daniel',
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
create policy "Usuário vê apenas seu perfil"
  on profiles for all using (auth.uid() = id);

-- ─── DAILY LOGS ──────────────────────────────────────────────
create table daily_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table daily_logs enable row level security;
create policy "Usuário vê apenas seus logs"
  on daily_logs for all using (auth.uid() = user_id);

-- ─── EXERCISES ───────────────────────────────────────────────
create table exercises (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null,
  type text check (type in ('swim','walk','bike','gym','other','rest')),
  done boolean default false,
  duration_min integer default 0,
  calories integer default 0,
  hr_max integer,
  hr_min integer,
  notes text,
  created_at timestamptz default now()
);

alter table exercises enable row level security;
create policy "Usuário vê apenas seus exercícios"
  on exercises for all
  using (exists (select 1 from daily_logs dl where dl.id = log_id and dl.user_id = auth.uid()));

-- ─── MEALS ───────────────────────────────────────────────────
create table meals (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null,
  breakfast boolean default false,
  lunch boolean default false,
  dinner boolean default false,
  created_at timestamptz default now()
);

alter table meals enable row level security;
create policy "Usuário vê apenas suas refeições"
  on meals for all
  using (exists (select 1 from daily_logs dl where dl.id = log_id and dl.user_id = auth.uid()));

-- ─── BIOMETRICS ──────────────────────────────────────────────
create table biometrics (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null,
  weight_kg numeric(5,2),
  resting_hr integer,
  water_glasses integer default 0,
  sleep_hours numeric(4,1),
  sleep_quality text check (sleep_quality in ('great','good','ok','bad')),
  created_at timestamptz default now()
);

alter table biometrics enable row level security;
create policy "Usuário vê apenas sua biometria"
  on biometrics for all
  using (exists (select 1 from daily_logs dl where dl.id = log_id and dl.user_id = auth.uid()));

-- ─── MEDICATIONS ─────────────────────────────────────────────
create table medications (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null,
  olmecor_taken boolean default false,
  notes text,
  created_at timestamptz default now()
);

alter table medications enable row level security;
create policy "Usuário vê apenas seus medicamentos"
  on medications for all
  using (exists (select 1 from daily_logs dl where dl.id = log_id and dl.user_id = auth.uid()));

-- ─── ALCOHOL LOG ─────────────────────────────────────────────
create table alcohol_log (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null,
  type text check (type in ('wine','beer','other','none')),
  amount_doses numeric(4,1) default 0,
  created_at timestamptz default now()
);

alter table alcohol_log enable row level security;
create policy "Usuário vê apenas seu log de álcool"
  on alcohol_log for all
  using (exists (select 1 from daily_logs dl where dl.id = log_id and dl.user_id = auth.uid()));

-- ─── LAB RESULTS ─────────────────────────────────────────────
create table lab_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  hdl numeric(5,1),
  triglycerides numeric(6,1),
  glucose numeric(6,1),
  vo2_max numeric(5,2),
  weight_kg numeric(5,2),
  notes text,
  created_at timestamptz default now()
);

alter table lab_results enable row level security;
create policy "Usuário vê apenas seus exames"
  on lab_results for all using (auth.uid() = user_id);

-- ─── TRIGGER: auto-create profile on signup ──────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name','Daniel'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── TRIGGER: updated_at ─────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on daily_logs
  for each row execute procedure update_updated_at();
