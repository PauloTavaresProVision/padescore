-- Modo Finais dos cavaletes.
-- Quando true, os cavaletes mostram APENAS a cena de finais (PRÓXIMO JOGO /
-- RESULTADO EM ANDAMENTO dos jogos em destaque), escondendo a rotação normal
-- (jogos do dia, resultados, patrocinadores, byte).
alter table tournaments
  add column if not exists cavalete_finals_mode boolean not null default false;

comment on column tournaments.cavalete_finals_mode is
  'Cavaletes: quando true, mostram só os cartazes das finais (jogos em destaque), sem a rotação normal.';
