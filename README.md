# CONSTRUTRACK v2 — Produção

Sistema de controle de avanço físico de obras (EAP, alertas, sincronização de equipe).
Evolução do protótipo aprovado (`prototipo/construtrack_v1_ORIGINAL.html` — **não alterar**).

## Estrutura

| Pasta / arquivo | O que é |
|---|---|
| `app/` | O aplicativo (PWA) — instala no celular, funciona offline |
| `server/server.js` | Backend de sincronização — Node.js puro, **zero dependências** |
| `server/data/` | Dados do servidor (criado ao rodar; fora do git) |
| `prototipo/` | Protótipo original v1 e briefing — referência intocada |
| `INICIAR_SERVIDOR.bat` | Duplo clique para rodar o servidor no PC |
| `render.yaml` | Deploy com um clique no Render.com |

## Como rodar localmente

1. Instalar Node.js LTS (https://nodejs.org) — já instalado nesta máquina
2. Duplo clique em `INICIAR_SERVIDOR.bat`
3. Abrir http://localhost:8787 no navegador
4. O token da equipe aparece no console e fica em `server/data/config.json`

## Como funciona a sincronização

- Cada celular guarda **tudo localmente** (funciona 100% offline em campo)
- Na tela **EXPORT → Nuvem**, configura-se o endereço do servidor + chave da equipe
- Ao tocar **Sincronizar agora** (ou ao abrir o app com internet), cada obra é
  enviada ao servidor, que faz o *merge* e devolve o estado consolidado da equipe
- A troca manual de JSON por WhatsApp continua funcionando como plano B

### Regras de merge (iguais no app e no servidor)

| Dado | Regra |
|---|---|
| Registros de avanço | vence o timestamp mais recente |
| Histórico | união, **nunca apaga** (auditoria) |
| Alertas | última alteração registrada no histórico vence (remoções sincronizam) |
| EAP (slots/ocultos) | vence quem configurou por último (`eapEditadaEm`) |
| Dados da obra (nome, status…) | vence quem editou por último (`metaEditadaEm`) |

## Bugs do protótipo corrigidos na v2

1. Exportar JSON zerava o controle do CSV incremental (`ultimaExportacao`)
2. CSV quebrava com aspas/quebras de linha nas observações; sem BOM o Excel
   pt-BR desfigurava acentos; separador virou `;` (padrão Excel BR)
3. CSV incremental exportava centenas de linhas 0% sem registro novo
4. % de subpacote contava itens ocultos no denominador (regra 4.1 do briefing)
5. Obras com mesmo nome no mesmo ano geravam o mesmo ID (colisão — a segunda
   ficava inacessível)
6. Todo salvamento de registro reescrevia timestamps dos alertas e poluía o
   histórico com entradas duplicadas de alerta
7. Um celular novo não conseguia receber uma obra por JSON ("Obra não
   encontrada") — agora oferece adicionar
8. Nomes/observações com `<`, `"` ou `'` quebravam a tela (injeção de HTML)
9. Renomear slots / ocultar itens não sincronizava entre aparelhos
10. Obra de demonstração era criada sozinha em todo aparelho novo (removida)
11. lat/lng eram gravados como texto (agora número)
12. Versionamento `_versao` + migração automática (exigência 8.1 do briefing)

## Colocar em produção (internet)

**Opção A — Vercel + Supabase (arranjo atual):**
1. **Supabase:** no painel do projeto, abrir *SQL Editor*, colar o conteúdo de
   `supabase/setup.sql` e executar (uma vez só). Depois, em *Settings → API*,
   copiar a **Project URL** e a **anon key**.
2. **Vercel:** importar o repositório GitHub (`vercel.json` já publica a pasta
   `app/` como estático — sem Vite, sem build). Framework: *Other/None*.
3. **Em cada celular:** abrir a URL do Vercel, "Adicionar à tela inicial",
   e na tela EXPORT → Nuvem colar a Project URL do Supabase + a anon key.

O app detecta o Supabase pela URL e sincroniza direto com o banco (tabela
`construtrack_obras`), com trava de versão (`rev`) contra conflito de equipe e
"lixeira" (`apagada`) para obras deletadas.

### Logins individuais (Supabase Auth)

Na tela EXPORT → Nuvem a pessoa **toca no próprio nome e digita só a senha**
(os botões de nome vêm da tabela `construtrack_equipe` — rodar
`supabase/equipe.sql` uma vez). A sessão fica salva no aparelho e se renova
sozinha; sem login não há sincronização. O nome do usuário logado já vem
preenchido nas exportações (coluna `EXPORTADO_POR`), e o botão **Trocar senha**
permite que cada um escolha a própria senha.

- Criar usuário: painel do Supabase → *Authentication → Users → Add user* —
  email `nome@fpvieira.app`, senha, marcar *Auto Confirm*; em *User Metadata*
  colocar `{"nome":"Fulano"}`.
- Travar o banco para exigir login: rodar `supabase/logins.sql` (uma vez).
  Depois disso a anon key sozinha não lê nem escreve dados.

**Opção A2 — Render.com (servidor próprio):** criar Blueprint apontando para o
repositório (`render.yaml` já configura tudo), definir a variável `TOKEN`. Com
o plano Starter o disco é persistente.

**Opção B — App no Vercel + servidor no Render:** o `vercel.json` já publica a
pasta `app/` como site estático (sem build — não usa Vite/framework). O Vercel
**não** consegue rodar o servidor de sincronização (serverless = sem disco
persistente), então o backend continua no Render; basta apontar o campo
"Endereço do servidor" do app para a URL do Render.

**Opção C — PC sempre ligado no escritório:** rodar `INICIAR_SERVIDOR.bat` e
expor com um túnel (ex.: Cloudflare Tunnel) ou usar só na rede local.

Depois, em cada celular: abrir o endereço, **Adicionar à tela inicial**
(vira app), e configurar a nuvem na tela EXPORT.
