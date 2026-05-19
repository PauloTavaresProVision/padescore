-- =====================================================================
-- Códigos curtos para URLs públicos de TV e OBS.
--
-- 5 chars de [a-z2-9] (sem 0/1/i/l/o — caracteres ambíguos).
-- 31^5 ≈ 28 milhões de códigos, colisão virtualmente impossível.
-- =====================================================================

-- 1) Função geradora com check de colisão
create or replace function public.generate_match_short_code()
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
    for i in 1..5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.matches where short_code = code) then
      return code;
    end if;
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Não foi possível gerar código curto único após 20 tentativas';
    end if;
  end loop;
end $$;

-- 2) Coluna (nullable inicialmente para permitir backfill)
alter table public.matches
  add column if not exists short_code text;

-- 3) Backfill: gera código para jogos existentes
update public.matches
   set short_code = public.generate_match_short_code()
 where short_code is null;

-- 4) Constraints + default para inserts futuros
alter table public.matches
  alter column short_code set not null,
  alter column short_code set default public.generate_match_short_code();

-- 5) Unicidade
do $$ begin
  alter table public.matches add constraint matches_short_code_key unique (short_code);
exception when duplicate_object then null;
end $$;

create index if not exists matches_short_code_idx on public.matches(short_code);
