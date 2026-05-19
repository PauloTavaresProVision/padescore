-- =====================================================================
-- "Canal" de TV por torneio. A TV abre UM link fixo (/tv/live/<tv_code>)
-- e o operador escolhe à distância qual o jogo que aparece — sem ter de
-- ir mexer no browser da TV.
--   tv_active_match_id → jogo actualmente no ar (null = ecrã de espera)
--   tv_code            → código curto estável do canal de TV do torneio
-- =====================================================================

alter table public.tournaments
  add column if not exists tv_active_match_id uuid
    references public.matches(id) on delete set null;

create or replace function public.generate_tournament_tv_code()
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
    if not exists (select 1 from public.tournaments where tv_code = code) then
      return code;
    end if;
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Não foi possível gerar tv_code único após 20 tentativas';
    end if;
  end loop;
end $$;

alter table public.tournaments
  add column if not exists tv_code text;

update public.tournaments
   set tv_code = public.generate_tournament_tv_code()
 where tv_code is null;

alter table public.tournaments
  alter column tv_code set not null,
  alter column tv_code set default public.generate_tournament_tv_code();

do $$ begin
  alter table public.tournaments
    add constraint tournaments_tv_code_key unique (tv_code);
exception when duplicate_object then null;
end $$;

create index if not exists tournaments_tv_code_idx
  on public.tournaments(tv_code);
