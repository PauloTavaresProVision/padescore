-- =====================================================================
-- Fix: trigger create_match_state precisa de SECURITY DEFINER
-- para conseguir inserir em match_state (que só tem policy de SELECT).
--
-- Os endpoints que mexem em match_state usam o service_role (admin client),
-- por isso a tabela não precisa de policies de INSERT/UPDATE para clientes
-- autenticados — o trigger é o único caso de escrita "do lado do utilizador".
-- =====================================================================

create or replace function public.create_match_state()
returns trigger
language plpgsql
security definer  -- corre como dono da função (postgres), ignora RLS
set search_path = public
as $$
begin
  insert into public.match_state (match_id) values (NEW.id);
  return NEW;
end $$;
