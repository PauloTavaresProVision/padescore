-- =====================================================================
-- Nome curto (versão para OBS / espaços apertados) vs nome completo (TV).
-- Ex: full = "Paulo Tavares", short = "Paulo T".
-- =====================================================================

alter table public.players
  add column if not exists short_name text;

alter table public.matches
  add column if not exists team_a_player1_short text,
  add column if not exists team_a_player2_short text,
  add column if not exists team_b_player1_short text,
  add column if not exists team_b_player2_short text;
