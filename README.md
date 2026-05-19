# Padescore

Sistema de scoring para padel: backoffice com login, marcador mobile via link
secreto, overlay para OBS e scoreboard público — tudo em tempo real através do
Supabase Realtime.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Supabase** — Postgres, Auth, Realtime, Storage
- **Tailwind CSS 4**
- **Zod** — validação
- **Vitest** — testes do motor de scoring

## Setup inicial

### 1. Aplicar o schema da BD

As credenciais Supabase já estão em `.env.local`. Falta aplicar a migration:

1. Abre o projecto Supabase: <https://supabase.com/dashboard>
2. Vai a **SQL Editor → New query**
3. Cola o conteúdo de [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
4. Clica **Run**

Isto cria:

- Tabelas `tournaments`, `matches`, `match_events`, `match_state`
- Trigger para criar `match_state` automaticamente em cada novo jogo
- Publicação no Realtime (`supabase_realtime`)
- RLS policies (leitura pública para overlay/scoreboard; escrita só pelo dono)
- Bucket público `tournament-logos` para upload de logos

### 2. Activar Realtime (se necessário)

A migration já faz `alter publication supabase_realtime add table ...`. Se o
overlay não actualizar em tempo real, confirma em **Database → Replication →
supabase_realtime** que `match_state` e `matches` estão activas.

### 3. Criar a conta admin

```bash
pnpm dev
```

Abre <http://localhost:3000/login?mode=signup> e cria a tua conta. Depois, em
**Authentication → Providers** no Supabase, podes desactivar o signup público.

> Se tiveres confirmação de email activa no Supabase, vai à inbox confirmar antes de fazer login.

## Como usar

### Backoffice (`/admin`)

- Login → cria torneio (com logo e cor) → cria jogo
- Cada jogo recebe um **código curto** de 5 chars (ex.: `k3xqp`) que gera URLs fáceis de partilhar:
  - **Operador (mobile)** — `/score/[token]` (token longo e secreto, sem login, para o telemóvel)
  - **Overlay OBS** — `/obs/[code]` (canto superior esquerdo, fundo transparente)
  - **Scoreboard público (TV)** — `/tv/[code]` (ecrã grande)

### Operador (`/score/[token]`)

- Botões enormes "+ Ponto A" / "+ Ponto B" / "↶ Desfazer"
- Estado actualiza em tempo real via Supabase Realtime
- Se perder ligação, o botão fica disponível para retry — eventos são append-only no servidor

### Admin do jogo

Na página do jogo no backoffice tens:
- Marcador ao vivo (igual ao do overlay)
- Os mesmos botões "+ Ponto / Desfazer" (caso queiras controlar do PC)
- **Reset** total do jogo
- **Regenerar token** (invalida o link antigo do operador)
- **Apagar jogo**

### OBS

1. **Sources → + → Browser**
2. URL: `https://<domínio>/obs/<code>`
3. Width: 1920, Height: 1080 (ou o que preferires)
4. O scoreboard aparece no canto superior esquerdo, fundo transparente

## Comandos

```bash
pnpm dev      # dev server (localhost:3000)
pnpm build    # build de produção
pnpm start    # serve o build de produção
pnpm test     # corre os testes do motor de scoring (vitest)
pnpm lint     # ESLint
```

## Deploy (Vercel)

1. Push para um repo GitHub
2. **vercel.com → New Project → Import**
3. Adiciona variáveis de ambiente (mesmas do `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (apenas server-side)
4. Deploy

## Arquitectura — eventos vs estado

Cada ponto é guardado como linha em `match_events` (append-only, `seq`
monotónico por jogo). O estado actual em `match_state` é uma view denormalizada
recalculada a partir do log de eventos em cada update.

Vantagens:
- **Undo fiável**: não apaga o evento, marca `voided=true` e regrava o estado.
- **Auditoria**: histórico completo de cada ponto/anulação.
- **Reconciliação**: se o estado em BD ficar incoerente, recalcula-se a partir
  dos eventos.

## Testes

O motor de scoring está em `src/lib/scoring/engine.ts` e é uma função pura
(sem I/O). Testes em `src/lib/scoring/engine.test.ts` cobrem:

- Game normal (0→15→30→40→game)
- Vantagens vs golden point
- 6-0, 6-4, 7-5, tiebreak a 6-6, tiebreak extendido (9-7)
- Match (best of 3)
- Super tiebreak (10 pontos)
- Alternância de servidor (game e tiebreak)
- Manual override
- Undo via re-redução de eventos

Correr com `pnpm test`.

## Segurança

- A `service_role_key` está em `.env.local` (ignorada pelo git) e só é usada
  do lado servidor (route handlers e server actions). Nunca é exposta ao
  cliente.
- O link do operador (`/score/[token]`) usa um token UUID-hex de 32 chars
  (16 bytes aleatórios). Regenerável a qualquer momento sem perder o estado.
- RLS no Supabase impede um cliente autenticado de aceder a torneios de
  outros utilizadores.
