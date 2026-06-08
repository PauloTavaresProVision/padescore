-- =====================================================================
-- Reduzir comprimento do token do totem de 40 → 16 caracteres.
--
-- Motivação: 40 chars é demasiado longo para o operador copiar/colar no
-- ecrã de setup da app Windows. 16 chars dá ~80 bits de entropia, mais
-- que suficiente para um token público de leitura (não autentica admin,
-- só desbloqueia o conteúdo do totem do campo correspondente).
--
-- Alfabeto: 32 caracteres seguros (lowercase + digits, removendo pares
-- confusos: 0/o, 1/l/i, u — comuns em fontes monospace e setups manuais).
--   abcdefghjkmnpqrstvwxyz + 23456789  →  32 chars
--   16 chars de 32 = 32^16 = 1.21e24 combinações ≈ 80 bits.
--
-- Compatibilidade: tokens antigos de 40 chars continuam válidos (a tabela
-- não muda, só a default-generator). Cada totem que precisar de regerar
-- token recebe um novo de 16 chars.
-- =====================================================================

create or replace function public.generate_totem_token()
returns text
language plpgsql
as $$
declare
  -- Sem: 0 (zero), o, 1 (um), l, i, u
  alphabet text := 'abcdefghjkmnpqrstvwxyz23456789';
  token text;
  attempts int := 0;
begin
  loop
    token := '';
    for i in 1..16 loop
      token := token ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.totems where api_token = token) then
      return token;
    end if;
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception
        'Não foi possível gerar api_token único após 20 tentativas';
    end if;
  end loop;
end $$;
