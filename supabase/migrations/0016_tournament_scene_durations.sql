-- =============================================================================
-- 0016_tournament_scene_durations.sql
-- =============================================================================
-- Adiciona controlo por torneio dos tempos de rotação entre cenas do cavalete:
--   - scene_main_duration_sec    → quanto tempo a Cena 1 (jogos) fica visível
--   - scene_sponsors_duration_sec → quanto tempo a Cena 3 (publicidade) fica
--
-- Defaults preservam o comportamento actual hardcoded: 40s / 15s.
-- =============================================================================

alter table tournaments
  add column if not exists scene_main_duration_sec int not null default 40,
  add column if not exists scene_sponsors_duration_sec int not null default 15;

-- Constraints sanity (evita 0/negativos que partiriam a UI)
alter table tournaments
  add constraint scene_main_duration_positive check (scene_main_duration_sec between 5 and 600),
  add constraint scene_sponsors_duration_positive check (scene_sponsors_duration_sec between 5 and 300);

comment on column tournaments.scene_main_duration_sec is
  'Cavalete: duração (segundos) da Cena 1 — Em Jogo Agora + Próximos + Resultados. Default 40s.';
comment on column tournaments.scene_sponsors_duration_sec is
  'Cavalete: duração (segundos) da Cena 3 — Patrocinadores Oficiais + Parceiros. Default 15s.';
