-- Book-specific inputs captured during onboarding flow
create table if not exists public.story_book_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  genres text[] not null default '{}',
  content_rating text not null,
  language text not null,
  created_at timestamptz not null default now()
);

create index if not exists story_book_inputs_user_id_idx
  on public.story_book_inputs (user_id);

alter table public.story_book_inputs enable row level security;

create policy "Users can view own book inputs"
  on public.story_book_inputs for select
  using (auth.uid() = user_id);

create policy "Users can insert own book inputs"
  on public.story_book_inputs for insert
  with check (auth.uid() = user_id);
