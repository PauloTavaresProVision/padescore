-- =====================================================================
-- Campos como entidades + horário marcado nos jogos.
--
-- Antes:
--   matches.court_name (text livre, ex: "Court 1")
--   → não dá para listar todos os campos do torneio, não há ordem entre
--     jogos no mesmo campo, não há horário marcado, etc.
--
-- Agora:
--   courts (id, tournament_id, name, sort_order)
--     → user define os campos uma vez por torneio
--   matches.court_id → FK para courts (nullable mantida para compat)
--   matches.scheduled_at → timestamptz nullable (hora marcada do jogo)
--     → permite "qual o próximo jogo no Campo 1?", "horário do jogo: 18:00",
--       e alimenta o totem.
--   matches.court_name fica como fallback histórico (snapshot do nome
--     mesmo que o court seja apagado).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela courts
-- ---------------------------------------------------------------------
create table if not exists public.courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$ begin
  alter table public.courts
    add constraint courts_tournament_name_key unique (tournament_id, name);
exception when duplicate_object then null;
end $$;

create index if not exists courts_tournament_idx
  on public.courts(tournament_id);
create index if not exists courts_tournament_sort_idx
  on public.courts(tournament_id, sort_order);

-- updated_at automático
create or replace function public.touch_courts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists courts_touch_updated_at on public.courts;
create trigger courts_touch_updated_at
  before update on public.courts
  for each row execute function public.touch_courts_updated_at();

-- ---------------------------------------------------------------------
-- 2) Novas colunas em matches
-- ---------------------------------------------------------------------
alter table public.matches
  add column if not exists court_id uuid
    references public.courts(id) on delete set null,
  add column if not exists scheduled_at timestamptz;

create index if not exists matches_court_id_idx
  on public.matches(court_id);
create index if not exists matches_tournament_scheduled_idx
  on public.matches(tournament_id, scheduled_at);
create index if not exists matches_court_scheduled_idx
  on public.matches(court_id, scheduled_at);

-- ---------------------------------------------------------------------
-- 3) Backfill — converter court_name em entidades courts
--    Para cada combinação distinta (tournament_id, court_name) em
--    matches: cria um court (se não existir) e popula matches.court_id.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  new_court_id uuid;
  i int := 0;
begin
  for r in
    select distinct tournament_id, court_name
      from public.matches
     where court_name is not null
       and court_name <> ''
       and court_id is null
     order by tournament_id, court_name
  loop
    -- Tenta encontrar; senão cria.
    select id into new_court_id
      from public.courts
     where tournament_id = r.tournament_id and name = r.court_name;

    if new_court_id is null then
      insert into public.courts (tournament_id, name, sort_order)
        values (r.tournament_id, r.court_name, i)
        returning id into new_court_id;
      i := i + 1;
    end if;

    update public.matches
       set court_id = new_court_id
     where tournament_id = r.tournament_id
       and court_name = r.court_name
       and court_id is null;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4) RLS — courts (mesmo padrão de matches)
--    Leitura pública (totem precisa de ler o nome do campo sem auth de
--    user, só com o token do totem que será validado server-side).
--    Escrita só pelo dono do torneio.
-- ---------------------------------------------------------------------
alter table public.courts enable row level security;

do $$ begin
  create policy courts_select_public on public.courts
    for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy courts_owner_all on public.courts
    for all using (
      exists (
        select 1 from public.tournaments t
        where t.id = courts.tournament_id and t.owner_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.tournaments t
        where t.id = courts.tournament_id and t.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;
