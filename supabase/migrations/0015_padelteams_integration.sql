-- =====================================================================
-- Integração com PadelTeams (https://protected.padelteams.pt)
--
-- O PadelTeams é o sistema usado pelos organizadores para gerir o draw,
-- horários e resultados. Nós passamos a buscar os jogos lá em vez de
-- termos uma UI nossa de criação de jogos. Esta migration adiciona apenas
-- os "ganchos" necessários para fazer essa associação:
--
--   tournaments.padelteams_competition_code
--     Identifica a competição (1 por torneio nosso). Ex: 'ywihky'.
--
--   courts.padelteams_field_id
--     Liga o NOSSO campo (ex: ALPROME) ao field do PadelTeams
--     (ex: { id: 57460, name: "CIN", description: "Campo 6" }).
--     Setup é one-time por torneio via /admin/.../padelteams.
--
--   players.padelteams_player_id
--     Liga o NOSSO jogador (com foto manual) ao player do PadelTeams.
--     Permite mostrar a foto certa quando o cavalete exibe um jogo
--     vindo do PadelTeams (cujo photo é sempre placeholder genérico).
--     Auto-matched por nome normalizado + UI manual para casos ambíguos.
--
--   padelteams_game_overrides
--     Por jogo do PadelTeams, permite marcar `is_featured` (entra com
--     prioridade no carrossel "EM FOCO" do cavalete) + notas.
--
--   totems.court_id_2
--     Cavaletes mostram 2 campos lado-a-lado. Quando NULL, é o totem
--     antigo de 1 campo (192×640). Quando preenchido, é cavalete v2
--     (1080×1920) e os 2 campos são (court_id, court_id_2).
--
-- O bearer token da API PadelTeams não vive na DB — vive em env var
-- (PADELTEAMS_BEARER_TOKEN) porque é o mesmo para todos os torneios da
-- mesma conta operadora. Mantê-lo fora da DB reduz a exposição.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) tournaments.padelteams_competition_code
-- ---------------------------------------------------------------------
alter table public.tournaments
  add column if not exists padelteams_competition_code text;

-- ---------------------------------------------------------------------
-- 2) courts.padelteams_field_id
--    Único por torneio: dois campos nossos não podem apontar para o
--    mesmo field do PadelTeams.
-- ---------------------------------------------------------------------
alter table public.courts
  add column if not exists padelteams_field_id integer;

create unique index if not exists courts_tournament_padelteams_field_unique
  on public.courts(tournament_id, padelteams_field_id)
  where padelteams_field_id is not null;

-- Lookup pelo padelteams_field_id (usado no proxy /api/cavalete)
create index if not exists courts_padelteams_field_id_idx
  on public.courts(padelteams_field_id)
  where padelteams_field_id is not null;

-- ---------------------------------------------------------------------
-- 3) players.padelteams_player_id
--    Único globalmente (cada jogador no PadelTeams é uma pessoa).
-- ---------------------------------------------------------------------
alter table public.players
  add column if not exists padelteams_player_id integer;

create unique index if not exists players_padelteams_player_id_unique
  on public.players(padelteams_player_id)
  where padelteams_player_id is not null;

-- ---------------------------------------------------------------------
-- 4) totems.court_id_2 (cavalete = 2 campos por dispositivo)
-- ---------------------------------------------------------------------
alter table public.totems
  add column if not exists court_id_2 uuid
    references public.courts(id) on delete set null;

-- Não permitir court_id_2 == court_id (seria absurdo, ambos os campos
-- iguais).
do $$ begin
  alter table public.totems
    add constraint totems_court_ids_distinct
    check (court_id_2 is null or court_id_2 <> court_id);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 5) padelteams_game_overrides
--    Por jogo (identificado pelo padelteams_game_id), permite ao admin
--    marcar destaque/featured + notas. is_featured → entra com
--    prioridade no carrossel "EM FOCO" do cavalete.
--
--    Não armazenamos os jogos em si (vivem na API PadelTeams) — só
--    overrides.
-- ---------------------------------------------------------------------
create table if not exists public.padelteams_game_overrides (
  tournament_id        uuid not null
                       references public.tournaments(id) on delete cascade,
  padelteams_game_id   integer not null,
  is_featured          boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (tournament_id, padelteams_game_id)
);

create index if not exists pgo_tournament_featured_idx
  on public.padelteams_game_overrides(tournament_id)
  where is_featured = true;

create or replace function public.touch_pgo_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pgo_touch_updated_at
  on public.padelteams_game_overrides;
create trigger pgo_touch_updated_at
  before update on public.padelteams_game_overrides
  for each row execute function public.touch_pgo_updated_at();

-- ---------------------------------------------------------------------
-- 6) RLS — só owner do torneio pode ler/escrever overrides
--    (igual aos sponsors / totems)
-- ---------------------------------------------------------------------
alter table public.padelteams_game_overrides enable row level security;

do $$ begin
  create policy pgo_owner_all on public.padelteams_game_overrides
    for all using (
      exists (
        select 1 from public.tournaments t
        where t.id = padelteams_game_overrides.tournament_id
          and t.owner_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.tournaments t
        where t.id = padelteams_game_overrides.tournament_id
          and t.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;
