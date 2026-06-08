-- =============================================================================
-- 0020_reschedule_acceptances.sql
-- =============================================================================
-- Aceitação dos outros 3 jogadores envolvidos no match (parceira + 2
-- adversários). O requester é considerado auto-aceite — não precisa de
-- linha aqui.
--
-- Fluxo:
--   1. Jogador submete pedido em /api/reschedule-request
--   2. Backend identifica os 4 nomes do match (do snapshot PadelTeams)
--   3. Match com players_contacts (por nome fuzzy) para obter phones
--   4. Cria 3 rows aqui — uma por cada jogador OUTRO (parceira + adv1 + adv2)
--   5. Cada um recebe URL com token e clica para aceitar/rejeitar
--   6. Admin do clube vê os votos e decide
--
-- Nota sobre não-strictness: não há regra "todos têm que aceitar". O clube
-- aprova/rejeita independentemente — os votos são informação.
-- =============================================================================

create table if not exists reschedule_acceptances (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references match_reschedule_requests(id) on delete cascade,

  -- Identidade do jogador (do snapshot do match)
  player_name text not null,
  /** Role no match — para o admin ver "parceira aceitou + 1 adversário": */
  player_role text not null check (player_role in ('partner', 'opponent')),

  -- Telemóvel (do match com players_contacts). Pode ser null se o jogador
  -- não está nos contactos importados — nesse caso o requester tem que
  -- contactar manualmente e o vote fica sempre como 'pending'.
  player_phone text,
  player_email text,

  -- Token único usado na URL pública /confirmar/{token}
  acceptance_token text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),

  -- Voto do jogador
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  decided_at timestamptz,
  decided_via text, -- 'whatsapp_link' (default) ou outras formas no futuro

  created_at timestamptz not null default now()
);

-- Lookup rápido por token (para a página /confirmar)
create unique index if not exists idx_acceptances_token
  on reschedule_acceptances (acceptance_token);

-- Lookup por request (para admin mostrar votos)
create index if not exists idx_acceptances_by_request
  on reschedule_acceptances (request_id);

comment on table reschedule_acceptances is
  'Votos dos outros 3 jogadores do match (parceira + 2 adversários). O requester é auto-aceite. Clube decide independentemente.';

-- RLS: owner do torneio vê via JOIN com match_reschedule_requests.
-- Para acceptances precisamos de policy diferente — sem auth (público).
-- Acesso público é via service-role API route (sem RLS bypass), mas para o
-- admin ler precisa de policy.
alter table reschedule_acceptances enable row level security;

drop policy if exists "Tournament owner reads acceptances" on reschedule_acceptances;
create policy "Tournament owner reads acceptances"
  on reschedule_acceptances for select
  using (
    exists (
      select 1 from match_reschedule_requests r
      join tournaments t on t.id = r.tournament_id
      where r.id = reschedule_acceptances.request_id
        and t.owner_id = auth.uid()
    )
  );
