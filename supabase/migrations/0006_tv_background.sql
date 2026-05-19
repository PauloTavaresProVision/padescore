-- =====================================================================
-- Imagem de fundo para o scoreboard TV (por torneio).
-- O scoreboard /tv usa esta imagem como background; os dados dinâmicos
-- (score, sets, tempo, categoria, fotos das duplas) são sobrepostos
-- nas posições correctas.
-- =====================================================================

alter table public.tournaments
  add column if not exists tv_background_url text;
