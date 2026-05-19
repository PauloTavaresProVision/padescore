-- =====================================================================
-- Padescore — schema inicial
--
-- Tabelas:
--   tournaments    Torneios (logo, cores, nome)
--   matches        Jogos: jogadores, court, config (golden point, sets...)
--   match_events   Log append-only de eventos (cada ponto/anulação)
--   match_state    Estado actual denormalizado, para leitura rápida + realtime
--
-- O estado é sempre derivável a partir do log de eventos. `match_state`
-- existe para Realtime e leitura O(1) — actualizado pela API após cada
-- evento.
-- =====================================================================

-- Extensões
create extension if not exists "pgcrypto";

-- =====================================================================
-- tournaments
-- =====================================================================
create table public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_url     text,
  primary_color text default '#0033A0',
  owner_id     uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tournaments_owner_idx on public.tournaments(owner_id);

-- =====================================================================
-- matches
-- =====================================================================
create type match_status as enum ('scheduled', 'live', 'finished');

create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  court_name      text not null default 'Court 1',

  -- Equipas. Singulares ou pares (player2 / player4 nullable para singulares).
  team_a_player1  text not null,
  team_a_player2  text,
  team_b_player1  text not null,
  team_b_player2  text,

  -- Configuração de scoring
  golden_point    boolean not null default true,
  sets_to_win     int not null default 2 check (sets_to_win between 1 and 3),
  games_per_set   int not null default 6,
  tiebreak_at     int not null default 6,
  tiebreak_points int not null default 7,
  final_set_super_tiebreak boolean not null default false,

  -- Token secreto para o operador (URL /score/[token])
  operator_token  text not null unique default encode(gen_random_bytes(16), 'hex'),

  status          match_status not null default 'scheduled',
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index matches_tournament_idx on public.matches(tournament_id);
create index matches_operator_token_idx on public.matches(operator_token);
create index matches_status_idx on public.matches(status);

-- =====================================================================
-- match_events  (append-only)
-- Tipos:
--   point       Ponto ganho (team: A|B)
--   undo        Anula o último evento não-anulado
--   manual      Ajuste manual do estado (payload com o novo estado)
-- =====================================================================
create type match_event_type as enum ('point', 'undo', 'manual');
create type team_side as enum ('A', 'B');

create table public.match_events (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  seq         int not null,                  -- 1, 2, 3, ... ordem no jogo
  type        match_event_type not null,
  team        team_side,                     -- preenchido para type='point'
  payload     jsonb,                         -- para type='manual'
  voided      boolean not null default false,-- marcado true por um 'undo'
  voided_by   bigint,                        -- id do evento undo que o anulou
  created_at  timestamptz not null default now(),
  unique (match_id, seq)
);

create index match_events_match_idx on public.match_events(match_id, seq);

-- =====================================================================
-- match_state  (1 linha por jogo, denormalizado)
-- =====================================================================
create table public.match_state (
  match_id           uuid primary key references public.matches(id) on delete cascade,

  -- Pontos no game actual (formato textual: '0','15','30','40','AD' ou número se tiebreak)
  points_a           text not null default '0',
  points_b           text not null default '0',

  -- Games no set actual
  games_a            int not null default 0,
  games_b            int not null default 0,

  -- Sets ganhos
  sets_a             int not null default 0,
  sets_b             int not null default 0,

  -- Histórico de sets já completos: [{a:6, b:4}, {a:3, b:6}, ...]
  sets_history       jsonb not null default '[]'::jsonb,

  -- Quem serve actualmente (A ou B) — informativo no overlay
  server             team_side not null default 'A',

  -- Estado do game actual
  in_tiebreak        boolean not null default false,
  in_super_tiebreak  boolean not null default false,
  is_finished        boolean not null default false,
  winner             team_side,

  -- Último seq aplicado (para reconciliar com match_events)
  last_event_seq     int not null default 0,

  updated_at         timestamptz not null default now()
);

-- =====================================================================
-- Trigger: criar match_state automaticamente ao criar um match
-- =====================================================================
create or replace function public.create_match_state()
returns trigger
language plpgsql
security definer  -- corre como dono da função, ignora RLS (necessário porque
                  -- match_state não tem policy de INSERT para utilizadores)
set search_path = public
as $$
begin
  insert into public.match_state (match_id) values (NEW.id);
  return NEW;
end $$;

create trigger matches_create_state
  after insert on public.matches
  for each row execute function public.create_match_state();

-- =====================================================================
-- Realtime: publicar mudanças destas tabelas
-- =====================================================================
alter publication supabase_realtime add table public.match_state;
alter publication supabase_realtime add table public.matches;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.tournaments  enable row level security;
alter table public.matches      enable row level security;
alter table public.match_events enable row level security;
alter table public.match_state  enable row level security;

-- Tournaments: dono pode tudo; leitura pública também (para overlay/scoreboard).
create policy "tournaments_select_public" on public.tournaments
  for select using (true);
create policy "tournaments_owner_all" on public.tournaments
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Matches: leitura pública (scoreboard/overlay); escrita pelo dono do torneio.
create policy "matches_select_public" on public.matches
  for select using (true);
create policy "matches_owner_all" on public.matches
  for all using (
    exists (
      select 1 from public.tournaments t
      where t.id = matches.tournament_id and t.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.tournaments t
      where t.id = matches.tournament_id and t.owner_id = auth.uid()
    )
  );

-- Match events: leitura pública; escrita só via service role (route handler).
create policy "match_events_select_public" on public.match_events
  for select using (true);

-- Match state: leitura pública; escrita só via service role.
create policy "match_state_select_public" on public.match_state
  for select using (true);

-- =====================================================================
-- Storage bucket para logos de torneios
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('tournament-logos', 'tournament-logos', true)
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'tournament-logos');

create policy "logos_authenticated_write" on storage.objects
  for insert with check (
    bucket_id = 'tournament-logos' and auth.role() = 'authenticated'
  );

create policy "logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'tournament-logos' and auth.uid() = owner
  );
