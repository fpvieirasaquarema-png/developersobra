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

**Opção A — Render.com (recomendada):** subir o repositório no GitHub, criar
Blueprint apontando para ele (`render.yaml` já configura tudo), definir a
variável `TOKEN`. Com o plano Starter o disco é persistente.

**Opção B — PC sempre ligado no escritório:** rodar `INICIAR_SERVIDOR.bat` e
expor com um túnel (ex.: Cloudflare Tunnel) ou usar só na rede local.

Depois, em cada celular: abrir o endereço, **Adicionar à tela inicial**
(vira app), e configurar a nuvem na tela EXPORT.
