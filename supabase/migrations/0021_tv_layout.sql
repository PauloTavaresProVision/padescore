-- =============================================================================
-- 0021 — obs_layout: escolha do layout do OVERLAY OBS por torneio
-- =============================================================================
--   'classic' → overlay actual (logo + nomes + sets + relógio)
--   'strip'   → barra broadcast compacta estilo World Padel Tour
--               (PADEL LIVE · S1 | S2 | JG | PT, fundo transparente)
--
-- O scoreboard TV (/tv/...) NÃO é afectado — mantém sempre o layout único.
-- =============================================================================

-- Cleanup: uma versão anterior desta migration criava tv_layout (errado —
-- a escolha é para o overlay OBS, não para a TV).
alter table tournaments drop constraint if exists tournaments_tv_layout_check;
alter table tournaments drop column if exists tv_layout;

alter table tournaments
  add column if not exists obs_layout text not null default 'classic';

alter table tournaments
  drop constraint if exists tournaments_obs_layout_check;
alter table tournaments
  add constraint tournaments_obs_layout_check
  check (obs_layout in ('classic', 'strip'));

comment on column tournaments.obs_layout is
  'Layout do overlay OBS: classic (actual) ou strip (barra broadcast WPT).';
