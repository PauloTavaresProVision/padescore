-- =============================================================================
-- 0021_tv_layout.sql
-- =============================================================================
-- Escolha do layout do scoreboard TV por torneio:
--   'classic' → layout actual (fundo PNG + fotos + overlays posicionados)
--   'strip'   → barra broadcast compacta no canto superior esquerdo
--               (estilo World Padel Tour: S1 | S2 | JG | PT)
-- =============================================================================

alter table tournaments
  add column if not exists tv_layout text not null default 'classic';

-- Idempotente: drop + add (ADD CONSTRAINT não tem IF NOT EXISTS)
alter table tournaments
  drop constraint if exists tournaments_tv_layout_check;
alter table tournaments
  add constraint tournaments_tv_layout_check
  check (tv_layout in ('classic', 'strip'));

comment on column tournaments.tv_layout is
  'Layout do scoreboard TV: classic (fundo+fotos) ou strip (barra broadcast WPT).';
