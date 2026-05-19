-- =====================================================================
-- Imagem dedicada do ecrã de espera ("AGUARDE O PRÓXIMO JOGO").
-- É uma imagem própria, JÁ COM o texto/branding desenhados, separada do
-- fundo do scoreboard (esse tem as caixas de resultado e não serve aqui).
-- A TV mostra-a tal e qual, só com animação ambiente por cima.
-- =====================================================================

alter table public.tournaments
  add column if not exists tv_standby_url text;
