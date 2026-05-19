-- =====================================================================
-- Catálogo de jogadores. A foto é processada (background removido) uma
-- única vez no upload e fica disponível para reutilizar em todos os jogos
-- que esse jogador disputa.
-- =====================================================================

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  -- Se a foto está virada para o lado "errado" (ex: jogador da Dupla B
  -- fotografado a olhar para a direita, mas a Dupla B fica à direita do
  -- ecrã e tem que olhar para a esquerda) o operador marca isto a true.
  mirror boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_owner_id_idx on public.players(owner_id);
create index if not exists players_owner_name_idx on public.players(owner_id, name);

-- updated_at automático
create or replace function public.touch_players_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at
  before update on public.players
  for each row execute function public.touch_players_updated_at();

alter table public.players enable row level security;

do $$ begin
  create policy players_select_own on public.players
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy players_insert_own on public.players
    for insert with check (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy players_update_own on public.players
    for update using (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy players_delete_own on public.players
    for delete using (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

-- Liga matches → players (opcional; matches continuam a guardar o nome
-- em texto para snapshot histórico mesmo que o player seja apagado).
alter table public.matches
  add column if not exists team_a_player1_id uuid references public.players(id) on delete set null,
  add column if not exists team_a_player2_id uuid references public.players(id) on delete set null,
  add column if not exists team_b_player1_id uuid references public.players(id) on delete set null,
  add column if not exists team_b_player2_id uuid references public.players(id) on delete set null;
