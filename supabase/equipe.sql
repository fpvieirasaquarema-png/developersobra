-- ============================================================
-- CONSTRUTRACK — Lista da equipe para o login por botão
-- Rodar UMA VEZ no SQL Editor.
--
-- Esta tabela alimenta os botões de nome na tela de login
-- (a pessoa toca no nome e digita só a senha).
-- Qualquer um com o app consegue LER os nomes (necessário antes
-- do login); só o painel do Supabase consegue alterar a lista.
-- ============================================================

create table if not exists public.construtrack_equipe (
  usuario text primary key,   -- ex: 'rafael' (vira rafael@fpvieira.app no login)
  nome    text not null       -- ex: 'Rafael' (o que aparece no botão)
);

alter table public.construtrack_equipe enable row level security;

drop policy if exists equipe_ler on public.construtrack_equipe;
create policy equipe_ler on public.construtrack_equipe
  for select to anon, authenticated using (true);

insert into public.construtrack_equipe (usuario, nome) values
  ('renan','Renan'),
  ('rafael','Rafael'),
  ('lucas','Lucas'),
  ('osnam','Osnam')
on conflict (usuario) do update set nome = excluded.nome;

-- Para adicionar alguém depois (além de criar o usuário em Authentication>Users):
--   insert into public.construtrack_equipe (usuario, nome) values ('fulano','Fulano');
-- Para tirar alguém dos botões:
--   delete from public.construtrack_equipe where usuario = 'fulano';
