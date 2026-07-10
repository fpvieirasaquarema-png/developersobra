# CONSTRUTRACK — Briefing para Desenvolvedor
**Versão do documento:** 1.0  
**Data:** Julho 2026  
**Status do projeto:** Protótipo funcional aprovado — fase de conversão para app nativo

---

## 1. VISÃO GERAL DO PROJETO

O **Construtrack** é um sistema de controle de avanço físico de obras de construção civil, desenvolvido inicialmente para a gestão de obras do tipo ESF (Estrutura de Saúde da Família) e similares, financiadas por órgãos públicos como a Caixa Econômica Federal.

O problema que resolve: acompanhar o percentual de conclusão de cada etapa de uma obra em campo, com múltiplos responsáveis registrando dados em celulares diferentes, e consolidar tudo de forma confiável para relatórios e prestação de contas.

**Usuário principal:** Engenheiros e auxiliares técnicos em campo, com pouca disponibilidade de tempo e conexão instável.

**Contexto de uso:** Majoritariamente mobile (celular), em campo, com sol forte, muitas vezes sem internet.

---

## 2. PROTÓTIPO ATUAL

Existe um protótipo funcional completo em **HTML/CSS/JavaScript puro**, arquivo único sem dependências externas (exceto fontes Google Fonts via CDN).

**Arquivo:** `construtrack_v1.html` (106KB)

O protótipo já está totalmente funcional e aprovado pelo cliente. A missão do desenvolvedor é **converter esse protótipo em um aplicativo nativo (React Native ou Flutter)**, mantendo toda a lógica de negócio e UX já aprovada.

---

## 3. ARQUITETURA DE DADOS ATUAL

### Armazenamento
Atualmente usa `localStorage` do navegador. No app nativo deve ser substituído por **AsyncStorage (React Native)** ou **Hive/SharedPreferences (Flutter)**, com a mesma estrutura de dados.

### Estrutura principal — objeto Obra
```json
{
  "id_obra": "ESFVILATUR-2026",
  "nome": "ESF Vilatur",
  "endereco": "Av. Principal, 123",
  "municipio": "Saquarema / RJ",
  "dataInicio": "2026-01-15",
  "dataTermino": "2026-12-31",
  "status": "Em andamento",
  "lat": -22.9352,
  "lng": -42.5101,
  "dataCriacao": "2026-07-09T10:00:00.000Z",
  "ultimaExportacao": null,
  "eap": { ... },
  "registros": { ... },
  "alertas": { ... },
  "historico": [ ... ]
}
```

### EAP (Estrutura Analítica do Projeto)
A EAP é o coração do sistema. É uma hierarquia de 4 níveis:

```
N1 — Pacote        (ex: P2 — Construção / Ampliação)
  N2 — Subpacote   (ex: 2.1 — Fundações)
    N3 — Item      (ex: 2.1.2 — Sapatas)
      N4 — Subetapa (ex: Armação) ← onde se registra o % de avanço
```

**Pacotes existentes:**
- P0 — Projetos e Documentação Técnica
- P1 — Serviços Preliminares
- P2 — Construção / Ampliação (com 6 subpacotes: Fundações, Estrutura, Vedações, Cobertura, Instalações, Acabamentos)
- P3 — Demolições e Adequações do Existente
- PX — Pacote Extra (slot oculto, renomeável)

**Total de subetapas reais:** 251  
**Total de slots ocultos (renomeáveis):** 273  
**Total de subetapas no template:** 524

### Slots (vagas em branco)
O sistema tem "slots" — posições vazias ocultas por padrão que o usuário pode ativar e renomear para serviços fora do padrão. Importante preservar essa lógica no app.

```
visivel: false → oculto (não aparece e não entra no cálculo)
visivel: true  → visível
slot: true     → é um slot renomeável
```

### Registros
```json
"registros": {
  "2.1.2.4": {
    "percentual": 25,
    "data": "2026-06-15",
    "observacao": "Concretagem parcial",
    "ts": "2026-06-15T14:30:00.000Z"
  }
}
```

### Alertas (múltiplos por subetapa)
```json
"alertas": {
  "2.1.2.4": [
    { "cor": "am", "obs": "Chuvas atrasaram concretagem", "em": "2026-06-15T14:30:00.000Z" },
    { "cor": "azl", "obs": "Cimento aguardando entrega", "em": "2026-06-16T09:00:00.000Z" }
  ]
}
```

**5 cores de alerta:**
| Cor | Código | Uso |
|-----|--------|-----|
| Sem alerta | white | Neutro |
| Atenção | am | Problema em desenvolvimento |
| Crítico | rd | Bloqueio grave |
| Material | azl | Aguardando material/insumo |
| Resolvido | gn | Alerta encerrado |

**Regra de prioridade (propagação na hierarquia):**  
rd > am > azl > gn

Os alertas sobem automaticamente na hierarquia: se uma subetapa tem alerta vermelho, o item pai, o subpacote pai e o pacote pai todos mostram o ponto vermelho.

### Histórico (log incremental — nunca apaga)
```json
"historico": [
  {
    "tipo": "reg",
    "sub": "2.1.2.4",
    "de": 0,
    "para": 25,
    "data": "2026-06-15",
    "obs": "Concretagem parcial",
    "reg": false,
    "motivo": null,
    "em": "2026-06-15T14:30:00.000Z"
  },
  {
    "tipo": "alerta",
    "sub": "2.1.2.4",
    "alertas": [...],
    "em": "2026-06-15T14:30:00.000Z"
  }
]
```

---

## 4. REGRAS DE NEGÓCIO CRÍTICAS

### 4.1 Cálculo de Percentual em Cascata
O avanço geral da obra é calculado por médias simples em cascata:

```
% Subetapa  → valor bruto registrado pelo usuário (0–100)
% Item      → média simples das subetapas visíveis
% Subpacote → média simples dos itens visíveis
% Pacote    → média simples dos subpacotes/itens visíveis
% Obra      → média simples dos pacotes visíveis
```

**Importante:** Subetapas e itens com `visivel: false` são **excluídos** do cálculo.

### 4.2 Detecção e Bloqueio de Regressão
Se o usuário registrar um percentual **menor** que o anterior (e diferente de 100%), o sistema detecta como regressão e **bloqueia o salvamento** até que um motivo seja selecionado.

**5 motivos pré-definidos:**
1. Erro de registro anterior
2. Demolição por não conformidade
3. Retrabalho necessário
4. Dano ou intempérie
5. Outro (campo livre)

A regressão é registrada no histórico com o motivo.

### 4.3 Janela de 30 Minutos
Se o último registro de uma subetapa tem menos de 30 minutos, o novo registro **substitui silenciosamente** sem criar entrada no histórico. Isso evita poluição do log por correções imediatas.

```javascript
if (agora - ultimoRegistro < 30min) {
  // atualiza sem log
} else {
  // cria entrada no histórico
}
```

### 4.4 Alertas com Observação Obrigatória
Para alertas **Crítico (rd)** e **Atenção (am)**, a observação é **obrigatória** antes de salvar. Para **Material (azl)** e **Resolvido (gn)** é opcional.

### 4.5 Sincronização entre Dispositivos (Merge)
O sistema foi projetado para múltiplos usuários registrando na mesma obra em dispositivos diferentes, sem backend em tempo real.

**Fluxo:**
1. Usuário A exporta JSON da obra
2. Envia por WhatsApp ou Drive para Usuário B
3. Usuário B importa o JSON
4. Sistema faz merge automático

**Regra de merge por campo:**
- `registros[id]`: prevalece o com timestamp (`ts`) mais recente
- `alertas[id]`: o arquivo importado por último prevalece (sobrescreve)
- `historico`: concatena e deduplica por timestamp (`em`)

### 4.6 Exportação CSV Incremental
O CSV de Cronograma exporta apenas registros **mais recentes que a última exportação** (`ultimaExportacao`). Isso evita que dados antigos sobrescrevam o que já está na planilha do Excel.

O Histórico exporta sempre completo (é log).

Ao exportar, o sistema pede o **nome de quem está exportando** — esse nome vai como coluna `EXPORTADO_POR` no CSV.

---

## 5. TELAS DO SISTEMA

### Tela 1 — Home
- Lista de obras com cards
- Card mostra: nome, ID, município, % geral, barra de progresso, badges de alerta (contagem por cor), status
- Filtros por status: Todas / Em andamento / Paralisada / Concluída
- Ordenação: A–Z / % decrescente / Mais recente / Mais alertas
- Botão "+ Nova obra"

### Tela 2 — EAP (Estrutura da Obra)
- Hierarquia colapsável: Pacote → Subpacote → Item → Subetapa
- Percentuais em cada nível
- Pontos de alerta coloridos propagados na hierarquia
- Contadores de alerta por cor em cada nível
- Botões: Configurar EAP / Editar obra / Deletar

**Modo Configurar EAP:**
- Checkbox em cada elemento para ocultar/reexibir
- Campo de renomeação inline para slots
- Estado de abertura dos painéis preservado ao interagir
- Tag "SLOT" visual nos elementos renomeáveis
- Elementos ocultos ficam visíveis mas semitransparentes (opacity 0.5)

### Tela 3 — Registro de Subetapa
- Acessada clicando em qualquer subetapa na EAP
- Slider de 0–100% + campo numérico sincronizado
- Campo de data (pré-preenchido com hoje)
- Campo de observação (opcional)
- Detecção automática de regressão com motivos
- Sistema de múltiplos alertas (botão "+ Adicionar")
- Cada alerta tem seletor de cor + campo de observação

### Tela 4 — Cadastro de Obra
- Nome (obrigatório) e Endereço (obrigatório)
- Município/UF, datas, status
- Captura de GPS com preenchimento automático de endereço via Nominatim (geocoding reverso)
- Botão "Copiar link" gera link do Google Maps

### Tela 5 — Editar Obra
- Mesmos campos do cadastro
- ID não editável (exibido como referência)
- Pode atualizar localização GPS

### Tela 6 — Exportação
- Seletor de obras (checkboxes)
- Seção CSV: Cronograma e Histórico
- Seção JSON: Exportar e Importar (para sincronização)
- Todos os botões desabilitados se nenhuma obra selecionada

---

## 6. DESIGN VISUAL APROVADO

### Paleta de Cores (obrigatório manter)
```
Fundo principal:  #EFEDE7  (bege quente)
Fundo secundário: #E6E3DB
Bordas:           #C8C4B8, #DCD9D0

Azul principal:   #1B4965  (cor da empresa)
Azul médio:       #2C6E91
Azul claro:       #4A8BAD
Azul suave:       #E6F1FB, #C8DFF0

Texto principal:  #1B4965  (azul escuro — sem preto)
Texto secundário: #4A7A94
Texto terciário:  #8CA8B8
Texto fantasma:   #AAC4D0

Alerta Crítico:   #C4453C (vermelho)
Alerta Atenção:   #D98E2A (âmbar)
Alerta Material:  #185FA5 (azul)
Alerta Resolvido: #3F8A5C (verde)
```

**Regra importante:** Não usar preto (#000) ou cinza escuro neutro em nenhum texto. Todos os textos são em tons de azul ou cinza-azulado.

### Tipografia
- **IBM Plex Mono** — IDs, códigos, percentuais, labels uppercase, nav
- **Inter** — Todo o restante (nomes, descrições, botões)

### Princípios de UX
- Pensado para celular em campo (sol forte, uma mão)
- Elementos tocáveis com mínimo 44px de altura
- Sem fundo quadriculado ou texturas
- Cards brancos com sombra suave sobre fundo bege
- Nav fixa no topo com azul escuro (#1B4965)
- Hierarquia visual clara: pacote > subpacote > item > subetapa

---

## 7. ROADMAP PLANEJADO

### Fase atual — Converter protótipo em app
Converter `construtrack_v1.html` para React Native ou Flutter, mantendo toda lógica e design.

### Próxima fase — Excel com Dashboards
Gerador de arquivo Excel profissional com:
- Aba Cronograma (estado vigente)
- Aba Histórico (log completo)
- Aba Dashboard (KPIs: avanço por pacote, alertas, regressões)
- Aba Curva S (avanço acumulado ao longo do tempo)
- Aba Resumo Executivo

### Fase futura — Dashboards no app
- Tela de resumo por obra com KPIs visuais
- Gráfico de evolução por pacote
- Indicador de ritmo (planejado vs realizado)
- Histórico visual por subetapa

### Fase futura — Configurações
- Aba de configurações no app
- Nome do programa personalizável
- Nome e logo da empresa
- Preferências de exportação

### Fase futura — Backend
- Sincronização em tempo real entre dispositivos
- Sem necessidade de troca manual de JSON
- Multi-usuário com autenticação
- Banco de dados centralizado (quando o volume justificar)

---

## 8. PONTOS TÉCNICOS IMPORTANTES PARA O DESENVOLVEDOR

### 8.1 Versionamento de Dados
**Ainda não implementado — deve ser feito antes de produção.**

Adicionar campo `_versao` nos dados salvos. Ao abrir o app, verificar se a versão dos dados é compatível com a versão do app. Se não for, rodar função de migração antes de carregar.

```javascript
const VERSAO_DADOS = 1;
if (dados._versao !== VERSAO_DADOS) {
  dados = migrar(dados, dados._versao, VERSAO_DADOS);
}
```

### 8.2 EAP é Copiada por Obra
O template EAP **não é compartilhado** — cada obra recebe uma cópia independente do template no momento da criação. Isso permite que cada obra tenha sua própria configuração de slots ativos/renomeados sem afetar as outras.

### 8.3 Cálculo de Alertas é Sempre Derivado
Os alertas não são armazenados nos níveis superiores (pacote, subpacote, item). Eles são armazenados **apenas nas subetapas** e calculados em tempo real ao renderizar. Não armazenar alerta agregado — sempre calcular na hora.

### 8.4 Histórico é Sagrado
O array `historico` de cada obra **nunca deve ser truncado ou apagado**, nem em migração de dados. É o log de auditoria principal do sistema. Só cresce.

### 8.5 GPS e Geocoding
O geocoding reverso usa a API **Nominatim** (OpenStreetMap, gratuita):
```
GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json
```
Retorna endereço estruturado. Importante: Nominatim tem rate limit — não fazer múltiplas chamadas seguidas.

### 8.6 Merge de JSON
A lógica de merge é o coração da sincronização. Deve ser implementada com cuidado:
- Registros: ganha o mais recente por timestamp `ts`
- Alertas: importado sobrescreve (último arquivo ganha)
- Histórico: union por timestamp `em` (sem duplicatas)

### 8.7 Exportação Incremental
O campo `ultimaExportacao` na obra guarda o timestamp da última exportação CSV. O Cronograma só exporta registros com `ts > ultimaExportacao`. Após exportar, atualiza `ultimaExportacao = agora`.

---

## 9. TECNOLOGIAS RECOMENDADAS

### Para conversão em app nativo
**React Native** (preferencial se a equipe tiver experiência JS):
- Expo para build simplificado
- AsyncStorage para persistência local
- expo-file-system para exportação de arquivos
- expo-location para GPS
- expo-sharing para compartilhar JSON/CSV

**Flutter** (alternativa):
- Hive ou SharedPreferences para persistência
- path_provider + dart:io para exportação
- geolocator para GPS
- share_plus para compartilhar

### Para o gerador de Excel (próxima fase)
- **SheetJS (xlsx)** — biblioteca JS que já foi usada no protótipo anterior
- Funciona tanto em React Native (via expo-file-system) quanto em web

---

## 10. ARQUIVOS ENTREGUES

| Arquivo | Descrição |
|---------|-----------|
| `construtrack_v1.html` | Protótipo funcional completo (HTML/JS/CSS) |
| `CONSTRUTRACK_BRIEFING_DESENVOLVEDOR.md` | Este documento |

### Como rodar o protótipo
1. Abrir `construtrack_v1.html` em qualquer navegador moderno (Chrome, Firefox, Safari)
2. Funciona offline (exceto fontes Google Fonts e geocoding)
3. Dados salvos no localStorage do navegador
4. Para resetar: abrir console (F12) e rodar `localStorage.clear()`

---

## 11. CONTATO E CONTEXTO DO CLIENTE

O cliente é o responsável técnico pelas obras. O sistema foi desenvolvido iterativamente com ele ao longo de várias sessões, validando cada decisão de UX e lógica de negócio.

**Decisões importantes já tomadas que não devem ser revertidas:**
- Sem preto nos textos (paleta azul/bege)
- Sem fundo quadriculado
- Registro acessível apenas pela EAP (não há atalho direto)
- Responsável não é campo do registro — aparece só na exportação
- Alertas são múltiplos por subetapa (não exclusivos)
- Histórico nunca é apagado
- Sincronização via JSON (não backend) por ora

---

*Documento gerado em Julho 2026 — Construtrack v1.0*
