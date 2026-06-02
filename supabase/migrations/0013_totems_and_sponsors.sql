-- =====================================================================
-- Totens digitais (1 por campo) + sponsors do torneio.
--
-- O totem é um totem LED 192×640 ao pé de cada campo, alimentado por uma
-- app Windows que vai polling ao endpoint /api/totem/[api_token]. Cada
-- totem vê o jogo a decorrer no seu campo + o próximo jogo + rotação de
-- sponsors. Sem ligação à net continua a usar a cache local.
--
-- Sponsors: 2 tipos
--   • footer     → logos pequenos sempre visíveis no rodapé do totem
--   • fullscreen → imagens grandes que entram em rotação (cada N seg)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Gerador de tokens longos (40 chars) — opaco, hard-to-guess.
-- ---------------------------------------------------------------------
create or replace function public.generate_totem_token()
returns text
language plpgsql
as $$
declare
  alphabet text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  token text;
  attempts int := 0;
begin
  loop
    token := '';
    for i in 1..40 loop
      token := token || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.totems where api_token = token) then
      return token;
    end if;
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Não foi possível gerar api_token único após 20 tentativas';
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) Tabela `totems`
--    Um totem por campo. Indexado por api_token (lookup do endpoint).
-- ---------------------------------------------------------------------
create table if not exists public.totems (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  court_id      uuid not null references public.courts(id) on delete cascade,
  api_token     text not null default public.generate_totem_token(),
  name          text not null default 'Totem',
  last_seen_at  timestamptz, -- heartbeat do totem (null = nunca contactou)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$ begin
  alter table public.totems
    add constraint totems_api_token_key unique (api_token);
exception when duplicate_object then null;
end $$;

-- Um totem por (tournament, court) — não faz sentido ter 2.
do $$ begin
  alter table public.totems
    add constraint totems_tournament_court_key unique (tournament_id, court_id);
exception when duplicate_object then null;
end $$;

create index if not exists totems_tournament_idx
  on public.totems(tournament_id);
create index if not exists totems_api_token_idx
  on public.totems(api_token);

-- updated_at automático
create or replace function public.touch_totems_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists totems_touch_updated_at on public.totems;
create trigger totems_touch_updated_at
  before update on public.totems
  for each row execute function public.touch_totems_updated_at();

-- ---------------------------------------------------------------------
-- 3) Tabela `tournament_sponsors`
-- ---------------------------------------------------------------------
do $$ begin
  create type sponsor_kind as enum ('footer', 'fullscreen');
exception when duplicate_object then null;
end $$;

create table if not exists public.tournament_sponsors (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  image_url     text not null,
  kind          sponsor_kind not null default 'footer',
  -- Duração (segundos) — usado só para `fullscreen` (quanto tempo fica
  -- no ar antes de rodar para o próximo). Default 8s.
  duration_sec  int not null default 8 check (duration_sec between 2 and 60),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tournament_sponsors_tournament_idx
  on public.tournament_sponsors(tournament_id);
create index if not exists tournament_sponsors_tournament_kind_sort_idx
  on public.tournament_sponsors(tournament_id, kind, sort_order);

create or replace function public.touch_tournament_sponsors_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tournament_sponsors_touch_updated_at on public.tournament_sponsors;
create trigger tournament_sponsors_touch_updated_at
  before update on public.tournament_sponsors
  for each row execute function public.touch_tournament_sponsors_updated_at();

-- ---------------------------------------------------------------------
-- 4) RLS
--    O endpoint /api/totem/[token] usa o service role (admin client) →
--    bypassa RLS. Por isso NÃO precisamos de policies "public select"
--    nestas tabelas — só o dono do torneio precisa de ler/escrever via
--    auth de utilizador (admin UI).
-- ---------------------------------------------------------------------
alter table public.totems enable row level security;
alter table public.tournament_sponsors enable row level security;

do $$ begin
  create policy totems_owner_all on public.totems
    for all using (
      exists (
        select 1 from public.tournaments t
        where t.id = totems.tournament_id and t.owner_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.tournaments t
        where t.id = totems.tournament_id and t.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy tournament_sponsors_owner_all on public.tournament_sponsors
    for all using (
      exists (
        select 1 from public.tournaments t
        where t.id = tournament_sponsors.tournament_id and t.owner_id = auth.uid()
      )
    ) with check (
      exists (
        select 1 from public.tournaments t
        where t.id = tournament_sponsors.tournament_id and t.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 5) Bucket de Storage para imagens de sponsors
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tournament-sponsors', 'tournament-sponsors', true)
on conflict (id) do nothing;

do $$ begin
  create policy "tournament_sponsors_public_read" on storage.objects
    for select using (bucket_id = 'tournament-sponsors');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "tournament_sponsors_authenticated_write" on storage.objects
    for insert with check (
      bucket_id = 'tournament-sponsors' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "tournament_sponsors_owner_delete" on storage.objects
    for delete using (
      bucket_id = 'tournament-sponsors' and auth.uid() = owner
    );
exception when duplicate_object then null;
end $$;
