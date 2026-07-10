-- ============================================================
-- CONSTRUTRACK — Configuração do Supabase
-- Rodar UMA VEZ no painel do Supabase: SQL Editor > New query >
-- colar tudo > Run.
-- ============================================================

create table if not exists public.construtrack_obras (
  id_obra       text primary key,
  dados         jsonb not null,          -- a obra completa (mesmo JSON do app)
  rev           bigint not null default 1, -- controle de concorrência (CAS)
  apagada       boolean not null default false, -- "lixeira": some do app, fica na nuvem
  atualizado_em timestamptz not null default now()
);

-- Modelo de confiança v1: a "anon key" do projeto funciona como a CHAVE DA EQUIPE.
-- Quem tem a chave lê e escreve. RLS fica desativada de propósito.
-- (Para endurecer no futuro: ativar RLS + Supabase Auth com login por usuário.)
alter table public.construtrack_obras disable row level security;

-- Recuperar uma obra apagada por engano (rodar no SQL Editor):
--   update public.construtrack_obras set apagada = false where id_obra = 'ID-DA-OBRA';
