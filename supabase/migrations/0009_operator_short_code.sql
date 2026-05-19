-- =====================================================================
-- Código curto para o link do operador (telemóvel).
--
-- 8 chars de [a-z2-9] (mesmo alfabeto sem ambíguos do short_code TV/OBS).
-- 31^8 ≈ 850 mil milhões de combinações — não-bruteforçável e ainda assim
-- curto o suficiente para QR/teclar (`/score/abc23xyz`).
--
-- Mais longo que `short_code` (5 chars) porque dá acesso de escrita.
-- =====================================================================

create or replace function public.generate_operator_short_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  code text;
  attempts int := 0;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.matches where operator_short_code = code) then
      return code;
    end if;
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Não foi possível gerar operator_short_code único após 20 tentativas';
    end if;
  end loop;
end $$;

-- Coluna nullable para backfill
alter table public.matches
  add column if not exists operator_short_code text;

-- Backfill jogos existentes
update public.matches
   set operator_short_code = public.generate_operator_short_code()
 where operator_short_code is null;

-- NOT NULL + default para inserts futuros
alter table public.matches
  alter column operator_short_code set not null,
  alter column operator_short_code set default public.generate_operator_short_code();

-- Unicidade + index
do $$ begin
  alter table public.matches
    add constraint matches_operator_short_code_key unique (operator_short_code);
exception when duplicate_object then null;
end $$;

create index if not exists matches_operator_short_code_idx
  on public.matches(operator_short_code);
