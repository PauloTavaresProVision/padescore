-- =============================================================================
-- 0018_player_contact_category.sql
-- =============================================================================
-- Adiciona categoria (F1, F2, F3, M1-M4) + email aos contactos importados.
-- Útil para filtros no admin e para WhatsApp message templates mais ricos.
-- =============================================================================

alter table players_contacts
  add column if not exists category text,
  add column if not exists email text,
  add column if not exists gender text check (gender in ('M', 'F') or gender is null);

create index if not exists idx_players_contacts_category
  on players_contacts (tournament_id, category)
  where category is not null;

comment on column players_contacts.category is
  'Categoria onde o jogador está inscrito: F1, F2, F3, M1, M2, M3, M4. Detectada automaticamente do Excel de inscrições.';
comment on column players_contacts.email is
  'Email do jogador (opcional). Para futuras comunicações de backup quando WhatsApp falhar.';
