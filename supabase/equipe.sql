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
  nome    text not null,      -- ex: 'Rafael' (o que aparece no botão)
  ordem   int not null default 99  -- posição do botão na tela de login
);

alter table public.construtrack_equipe enable row level security;

drop policy if exists equipe_ler on public.construtrack_equipe;
create policy equipe_ler on public.construtrack_equipe
  for select to anon, authenticated using (true);

insert into public.construtrack_equipe (usuario, nome, ordem) values
  ('lucas','Lucas',1),
  ('rafael','Rafael',2),
  ('osnam','Osnam',3),
  ('renan','Renan',4)
on conflict (usuario) do update set nome = excluded.nome, ordem = excluded.ordem;

-- Para adicionar alguém depois (além de criar o usuário em Authentication>Users):
--   insert into public.construtrack_equipe (usuario, nome, ordem) values ('fulano','Fulano',5);
-- Para tirar alguém dos botões:
--   delete from public.construtrack_equipe where usuario = 'fulano';
