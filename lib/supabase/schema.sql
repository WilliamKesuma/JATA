-- ============================================================
-- JATA (Job Application Tailoring Assistant) Supabase Schema
-- ============================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  tier text default 'free' check (tier in ('free', 'pro')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. SAVED CVs TABLE
create table if not exists public.saved_cvs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'Default CV',
  bullets jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.saved_cvs enable row level security;

create policy "Users can view own saved CVs"
  on public.saved_cvs for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved CVs"
  on public.saved_cvs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saved CVs"
  on public.saved_cvs for update
  using (auth.uid() = user_id);

create policy "Users can delete own saved CVs"
  on public.saved_cvs for delete
  using (auth.uid() = user_id);

-- 3. TAILORED HISTORY TABLE
create table if not exists public.tailored_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  job_title text,
  company text,
  job_description text not null,
  summary text not null,
  cover_email text not null,
  selected_bullet_ids jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tailored_history enable row level security;

create policy "Users can view own tailored history"
  on public.tailored_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own tailored history"
  on public.tailored_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own tailored history"
  on public.tailored_history for delete
  using (auth.uid() = user_id);

-- 4. USER USAGE / RATE LIMIT TABLE
create table if not exists public.user_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  day date default current_date not null,
  count integer default 1 not null,
  unique (user_id, day)
);

alter table public.user_usage enable row level security;

create policy "Users can view own usage"
  on public.user_usage for select
  using (auth.uid() = user_id);
