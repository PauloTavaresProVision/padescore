# Deploy — Padescore

App **Next.js 16** + **Supabase**. A imagem Docker é auto-contida (output
standalone). Não há base de dados no container — usa o Supabase.

## Variáveis de ambiente

| Variável | Onde | Quando |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | **build** e runtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente | **build** e runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | só servidor | **só runtime** (nunca no build) |

> As `NEXT_PUBLIC_*` são embebidas no bundle do browser **no momento do
> build** — por isso vão como `--build-arg`. A service role é só de runtime.

## Opção A — Coolify / Dokploy no teu Contabo (recomendado, "só o link")

1. Cria um repo no GitHub e faz push (ver fundo).
2. No Coolify/Dokploy: **New Resource → Application → from GitHub** → escolhe o repo.
3. Build pack: **Dockerfile** (detecta o `Dockerfile`).
4. Em **Environment Variables** mete as 3 variáveis. Marca
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` também como
   **Build Variable / Build Time** (importante!).
5. Domínio + HTTPS automático (Let's Encrypt no painel).
6. Deploy. Cada `git push` → redeploy automático.

## Opção B — docker compose (manual no Contabo)

```bash
git clone <repo> padescore && cd padescore
cp .env.example .env        # preenche as 3 chaves reais
docker compose up -d --build
```
Depois um reverse-proxy (Nginx/Caddy/Traefik) → `127.0.0.1:3000` com HTTPS.

## Opção C — Render / Railway

- New → Web Service → repo do GitHub → runtime **Docker**.
- Env vars: as 3. As `NEXT_PUBLIC_*` também como build-time.

## Migrations Supabase

Antes do primeiro uso, corre no SQL Editor do Supabase, por ordem, os
ficheiros em `supabase/migrations/0001 … 0011`. (Já aplicadas no projecto
actual — só necessário num projecto Supabase novo.)

## Notas

- Supabase Storage: garante que os buckets `tournament-logos` e
  `player-photos` são públicos (já criados pelas migrations).
- Região do Supabase próxima do Contabo (latência realtime).
- TV em quiosque: `chrome --kiosk --app=https://DOMINIO/tv/live/<tv_code>`.
- Nunca `next dev` em produção — a imagem já corre `next start` (standalone).
