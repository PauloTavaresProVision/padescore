-- =====================================================================
-- Foto única por equipa (em vez de uma por jogador).
--
-- As colunas antigas team_X_playerN_photo_url ficam mas deixam de ser
-- usadas — podem ser apagadas mais tarde se nunca tiveram dados.
-- =====================================================================

alter table public.matches
  add column if not exists team_a_photo_url text,
  add column if not exists team_b_photo_url text;
