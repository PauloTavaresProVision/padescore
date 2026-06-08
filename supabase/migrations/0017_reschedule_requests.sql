-- =============================================================================
-- 0017_reschedule_requests.sql
-- =============================================================================
-- Sistema de pedidos de alteração de horário pelos jogadores.
--
-- Fluxo:
--   1. Clube importa contactos (nome + telemóvel) → players_contacts
--   2. Jogador abre /pedidos/{competition_code}, vê os jogos do PadelTeams
--   3. Escolhe um jogo, preenche form, submete → match_reschedule_requests
--   4. Clube vê no admin, aprova/rejeita com nova hora ou motivo
--   5. (F2) SMS OTP no submit + WhatsApp notify após aprovação
-- =============================================================================

-- -----------------------------------------------------------------------------
-- players_contacts: lookup de telemóvel ↔ nome (importado do Excel do clube)
-- -----------------------------------------------------------------------------
-- Por torneio porque o mesmo número pode estar inscrito em torneios diferentes
-- com nomes ligeiramente diferentes (ex: "Maria João" vs "M. João S.").
-- O padelteams_player_id permite ligar ao registo do PadelTeams quando há
-- match exacto de nome (auto-match), ou manualmente via admin.
create table if not exists players_contacts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,

  -- Nome como aparece no Excel (pode ser parcial ou alcunha)
  name text not null,
  -- Telemóvel em formato E.164 (+244...) — usado para SMS OTP + WhatsApp
  phone text not null,
  -- Match opcional com o player registado no PadelTeams
  padelteams_player_id int,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um telemóvel é único por torneio (evita duplicados na import)
create unique index if not exists idx_players_contacts_unique
  on players_contacts (tournament_id, phone);
-- Lookup rápido por padelteams_player_id (durante render dos jogos)
create index if not exists idx_players_contacts_pteams
  on players_contacts (padelteams_player_id)
  where padelteams_player_id is not null;

comment on table players_contacts is
  'Contactos importados do Excel do clube. Usados para SMS OTP no submit de pedidos e WhatsApp notify após aprovação.';

-- -----------------------------------------------------------------------------
-- match_reschedule_requests: pedidos dos jogadores
-- -----------------------------------------------------------------------------
-- Não temos copy local dos jogos do PadelTeams (são fetched live + cached
-- 30s). Por isso guardamos snapshot mínimo do jogo (teams + horário original)
-- para histórico estável mesmo se o jogo for removido no PadelTeams.
create table if not exists match_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,

  -- Snapshot do jogo no momento do pedido (não muda quando PadelTeams muda)
  padelteams_game_id int not null,
  game_snapshot jsonb not null, -- { teamA, teamB, scheduledAt, field, category }

  -- Quem fez o pedido (validado via SMS OTP em F2; em F1 trust-based)
  requester_name text not null,
  requester_phone text not null,
  requester_phone_verified boolean not null default false,

  -- O pedido
  reason text not null,
  preferred_slot text, -- texto livre tipo "Sábado 15h ou Domingo manhã"

  -- Resposta do clube
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_response text, -- nota do clube (nova hora confirmada, ou motivo recusa)
  admin_new_scheduled_at timestamptz, -- nova hora se approved
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,

  -- Notificação aos outros jogadores (F2)
  notified_at timestamptz,
  notification_log jsonb, -- { sent_to: [...], errors: [...] }

  created_at timestamptz not null default now()
);

-- Lista pendentes rápido no admin
create index if not exists idx_reschedule_pending
  on match_reschedule_requests (tournament_id, created_at desc)
  where status = 'pending';
-- Histórico por jogo (mostrar pedidos anteriores)
create index if not exists idx_reschedule_by_game
  on match_reschedule_requests (tournament_id, padelteams_game_id);
-- Rate-limit: máx N pedidos por telemóvel/dia (verificado em código)
create index if not exists idx_reschedule_by_phone
  on match_reschedule_requests (requester_phone, created_at desc);

comment on table match_reschedule_requests is
  'Pedidos dos jogadores para alterar horário de jogos. Submetidos pela página pública /pedidos/{code} e geridos no admin /reschedule-requests.';

-- -----------------------------------------------------------------------------
-- RLS: pedidos são geridos via service-role (admin) ou public (submit form)
-- -----------------------------------------------------------------------------
-- Idempotente: drop antes de create. CREATE POLICY do Postgres não tem
-- IF NOT EXISTS, então tem que ser drop + create.
alter table players_contacts enable row level security;
alter table match_reschedule_requests enable row level security;

drop policy if exists "Tournament owner reads contacts" on players_contacts;
create policy "Tournament owner reads contacts"
  on players_contacts for select
  using (
    exists (
      select 1 from tournaments t
      where t.id = players_contacts.tournament_id
        and t.owner_id = auth.uid()
    )
  );

drop policy if exists "Tournament owner writes contacts" on players_contacts;
create policy "Tournament owner writes contacts"
  on players_contacts for all
  using (
    exists (
      select 1 from tournaments t
      where t.id = players_contacts.tournament_id
        and t.owner_id = auth.uid()
    )
  );

drop policy if exists "Tournament owner reads requests" on match_reschedule_requests;
create policy "Tournament owner reads requests"
  on match_reschedule_requests for select
  using (
    exists (
      select 1 from tournaments t
      where t.id = match_reschedule_requests.tournament_id
        and t.owner_id = auth.uid()
    )
  );

drop policy if exists "Tournament owner updates requests" on match_reschedule_requests;
create policy "Tournament owner updates requests"
  on match_reschedule_requests for update
  using (
    exists (
      select 1 from tournaments t
      where t.id = match_reschedule_requests.tournament_id
        and t.owner_id = auth.uid()
    )
  );

-- Insert público vai pela service-role API route (sem RLS bypass)
-- — a rota /api/reschedule-request faz validação + insert via admin client
