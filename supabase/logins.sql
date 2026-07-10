-- ============================================================
-- CONSTRUTRACK — Ativar exigência de LOGIN (rodar UMA VEZ no
-- SQL Editor, DEPOIS que o app atualizado estiver no Vercel).
--
-- Efeito: a anon key sozinha deixa de ler/escrever as obras.
-- Só usuários logados (Rafael, Lucas, Osnam, Renan...) acessam.
-- ============================================================

alter table public.construtrack_obras enable row level security;

drop policy if exists equipe_logada on public.construtrack_obras;
create policy equipe_logada on public.construtrack_obras
  for all
  to authenticated
  using (true)
  with check (true);

-- Para criar mais um usuário depois: painel Authentication > Users >
-- Add user > email no formato nome@fpvieira.app + senha, e marcar
-- "Auto Confirm User". O campo nome fica em User Metadata: {"nome":"Fulano"}.

-- Para DESFAZER (voltar ao modo chave-de-equipe sem login):
--   alter table public.construtrack_obras disable row level security;
