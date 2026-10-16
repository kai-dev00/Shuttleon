-- Sync replica of the app's local SQLite schema.
-- Every row belongs to one user (user_id) and is protected by Row Level Security.
-- Rows are never hard-deleted by the app: deleted_at is a tombstone so deletes can sync.

-- ---------------------------------------------------------------------------
-- Shared trigger: the server is the source of truth for updated_at (the pull cursor).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quick matches
-- ---------------------------------------------------------------------------
create table public.quick_matches (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_type text not null,
  best_of integer not null default 1,
  scoring integer not null default 11,
  rematch_number integer not null default 0,
  team_a_sets integer not null default 0,
  team_b_sets integer not null default 0,
  team_a_name text not null default 'Team 1',
  team_b_name text not null default 'Team 2',
  status text not null default 'upcoming',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.quick_match_players (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quick_match_id uuid not null references public.quick_matches (id) on delete cascade
    deferrable initially deferred,
  team text not null,
  player_order integer not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.quick_match_sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quick_match_id uuid not null references public.quick_matches (id) on delete cascade
    deferrable initially deferred,
  set_number integer not null,
  team_a_score integer not null,
  team_b_score integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (quick_match_id, set_number)
);

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  match_type text not null,
  format text not null,
  best_of integer not null default 1,
  scoring integer not null default 11,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tournament_players (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade
    deferrable initially deferred,
  name text not null,
  seed integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tournament_teams (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade
    deferrable initially deferred,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tournament_team_players (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tournament_team_id uuid not null references public.tournament_teams (id) on delete cascade
    deferrable initially deferred,
  tournament_player_id uuid not null references public.tournament_players (id) on delete cascade
    deferrable initially deferred,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tournament_team_id, tournament_player_id)
);

create table public.tournament_matches (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade
    deferrable initially deferred,
  round integer not null,
  match_order integer not null,
  side_a_team_id uuid references public.tournament_teams (id) deferrable initially deferred,
  side_b_team_id uuid references public.tournament_teams (id) deferrable initially deferred,
  team_a_sets integer not null default 0,
  team_b_sets integer not null default 0,
  status text not null default 'upcoming',
  winner_team_id uuid references public.tournament_teams (id) deferrable initially deferred,
  next_match_id uuid references public.tournament_matches (id) deferrable initially deferred,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tournament_match_sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tournament_match_id uuid not null references public.tournament_matches (id) on delete cascade
    deferrable initially deferred,
  set_number integer not null,
  team_a_score integer not null,
  team_b_score integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tournament_match_id, set_number)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled explicitly on every table (no access without a policy).
-- ---------------------------------------------------------------------------
alter table public.quick_matches enable row level security;
alter table public.quick_match_players enable row level security;
alter table public.quick_match_sets enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_team_players enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_match_sets enable row level security;

-- ---------------------------------------------------------------------------
-- Per-table setup: owner-only policy, updated_at trigger, pull-cursor index.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'quick_matches',
    'quick_match_players',
    'quick_match_sets',
    'tournaments',
    'tournament_players',
    'tournament_teams',
    'tournament_team_players',
    'tournament_matches',
    'tournament_match_sets'
  ]
  loop
    execute format(
      'create policy "owner full access" on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );

    execute format(
      'create trigger set_updated_at before insert or update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );

    execute format('create index %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
  end loop;
end;
$$;

-- Foreign-key lookup indexes.
create index quick_match_players_match_idx on public.quick_match_players (quick_match_id);
create index tournament_players_tournament_idx on public.tournament_players (tournament_id);
create index tournament_teams_tournament_idx on public.tournament_teams (tournament_id);
create index tournament_team_players_team_idx on public.tournament_team_players (tournament_team_id);
create index tournament_team_players_player_idx on public.tournament_team_players (tournament_player_id);
create index tournament_matches_tournament_idx on public.tournament_matches (tournament_id);
create index tournament_matches_side_a_idx on public.tournament_matches (side_a_team_id);
create index tournament_matches_side_b_idx on public.tournament_matches (side_b_team_id);
create index tournament_matches_winner_idx on public.tournament_matches (winner_team_id);
create index tournament_matches_next_idx on public.tournament_matches (next_match_id);
create index tournament_match_sets_match_idx on public.tournament_match_sets (tournament_match_id);
