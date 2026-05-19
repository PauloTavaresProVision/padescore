-- =====================================================================
-- Categoria e fotos dos jogadores (para o scoreboard TV)
-- =====================================================================

-- Categoria do jogo (M1-M4 masculino, F1-F4 feminino)
alter table public.matches
  add column if not exists category text;

do $$ begin
  alter table public.matches add constraint matches_category_check
    check (category is null or category in ('M1','M2','M3','M4','F1','F2','F3','F4'));
exception when duplicate_object then null;
end $$;

-- URLs de fotos dos 4 jogadores (opcional)
alter table public.matches
  add column if not exists team_a_player1_photo_url text,
  add column if not exists team_a_player2_photo_url text,
  add column if not exists team_b_player1_photo_url text,
  add column if not exists team_b_player2_photo_url text;

-- Bucket Storage para fotos dos jogadores
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- Leitura pública (necessária para o overlay e TV mostrarem)
do $$ begin
  create policy "player_photos_public_read" on storage.objects
    for select using (bucket_id = 'player-photos');
exception when duplicate_object then null;
end $$;

-- Escrita só por utilizadores autenticados (admins)
do $$ begin
  create policy "player_photos_authenticated_write" on storage.objects
    for insert with check (
      bucket_id = 'player-photos' and auth.role() = 'authenticated'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "player_photos_owner_delete" on storage.objects
    for delete using (
      bucket_id = 'player-photos' and auth.uid() = owner
    );
exception when duplicate_object then null;
end $$;
