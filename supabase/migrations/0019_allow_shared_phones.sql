-- =============================================================================
-- 0019_allow_shared_phones.sql
-- =============================================================================
-- Permite que dois jogadores partilhem o mesmo telemóvel (caso real
-- observado no Excel do Standard Bank: casais inscrevem-se com o mesmo
-- número, ou erros de digitação no Excel original). Sem esta mudança,
-- o upsert falha com "ON CONFLICT DO UPDATE command cannot affect row
-- a second time".
--
-- Nova unicidade: (tournament_id, phone, name) — pelo menos um dos três
-- tem que diferir. Para SMS OTP em F2, o jogador vai escolher qual
-- identidade está a usar quando há mais de uma.
-- =============================================================================

drop index if exists idx_players_contacts_unique;

create unique index if not exists idx_players_contacts_unique
  on players_contacts (tournament_id, phone, name);

comment on index idx_players_contacts_unique is
  'Permite 2 jogadores partilharem o mesmo telemóvel (ex: casais). Para SMS OTP em F2, UI mostra dropdown de identidades quando há mais de uma para o mesmo número.';
