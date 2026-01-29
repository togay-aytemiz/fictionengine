-- Core tables for interactive fiction engine
-- Note: writes to stories/episodes/story_profiles/continuity_notes should be server-side (service role).

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  is_anonymous boolean not null default true,
  app_lang text not null default 'tr',
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  logline text not null,
  genre text not null,
  content_rating text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint stories_content_rating_check check (content_rating in ('PG', 'PG-13', 'ADULT')),
  constraint stories_status_check check (status in ('active', 'archived', 'deleted'))
);

create table if not exists public.story_profiles (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  version int not null default 1,
  jsonb_profile jsonb not null,
  created_at timestamptz not null default now(),
  unique (story_id, version)
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  episode_number int not null,
  title text not null,
  text text not null,
  choices jsonb not null,
  recap jsonb,
  state_snapshot jsonb,
  created_at timestamptz not null default now(),
  unique (story_id, episode_number),
  constraint episodes_episode_number_check check (episode_number > 0)
);

create table if not exists public.continuity_notes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  key text not null,
  value text not null,
  status text not null default 'active',
  introduced_in_episode int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint continuity_notes_introduced_in_episode_check check (introduced_in_episode > 0),
  constraint continuity_notes_status_check check (status in ('active', 'inactive', 'deprecated'))
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  current_episode_number int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, story_id),
  constraint sessions_current_episode_number_check check (current_episode_number > 0)
);

create index if not exists episodes_story_id_episode_number_idx
  on public.episodes (story_id, episode_number);

create index if not exists continuity_notes_story_id_key_idx
  on public.continuity_notes (story_id, key);

create unique index if not exists continuity_notes_story_key_active_uq
  on public.continuity_notes (story_id, key)
  where status = 'active';


create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table public.users enable row level security;
alter table public.stories enable row level security;
alter table public.story_profiles enable row level security;
alter table public.episodes enable row level security;
alter table public.continuity_notes enable row level security;
alter table public.sessions enable row level security;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists continuity_notes_set_updated_at on public.continuity_notes;
create trigger continuity_notes_set_updated_at
before update on public.continuity_notes
for each row execute function public.set_updated_at();

create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view stories with sessions"
  on public.stories for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.story_id = id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can view story profiles with sessions"
  on public.story_profiles for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.story_id = story_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can view episodes with sessions"
  on public.episodes for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.story_id = story_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can view continuity notes with sessions"
  on public.continuity_notes for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.story_id = story_id
        and s.user_id = auth.uid()
    )
  );
