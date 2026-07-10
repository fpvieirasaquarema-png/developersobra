// ============================================================
// CONSTRUTRACK — Backend de sincronização (v1)
// Node.js >= 18, ZERO dependências externas.
//
// - Serve o app (pasta ../app) e a API no mesmo serviço
// - Cada obra é um arquivo JSON em ./data/obras/<ID>.json
// - Escrita atômica (tmp + rename) — nunca corrompe em queda
// - Merge no servidor com as MESMAS regras do app:
//     registros  -> vence o timestamp (ts) mais recente
//     historico  -> união por (em|tipo|sub), nunca apaga
//     alertas    -> derivados da última entrada 'alerta' do histórico
//     eap/meta   -> vence quem editou por último (eapEditadaEm/metaEditadaEm)
// - Autenticação por token compartilhado (data/config.json ou env TOKEN)
//
// Rodar:  node server.js       (porta 8787 ou env PORT)
// ============================================================
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = __dirname;
const DIR_DATA = path.join(RAIZ, 'data');
const DIR_OBRAS = path.join(DIR_DATA, 'obras');
const DIR_LIXEIRA = path.join(DIR_DATA, 'lixeira');
const DIR_APP = path.join(RAIZ, '..', 'app');
const PORT = parseInt(process.env.PORT, 10) || 8787;
const LIMITE_BODY = 15 * 1024 * 1024; // 15 MB
const VERSAO_API = 1;

// ── Setup inicial ────────────────────────────────────────────
for (const d of [DIR_DATA, DIR_OBRAS, DIR_LIXEIRA]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function carregarConfig() {
  const arq = path.join(DIR_DATA, 'config.json');
  let cfg = {};
  if (fs.existsSync(arq)) {
    try { cfg = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { cfg = {}; }
  }
  if (process.env.TOKEN) cfg.token = process.env.TOKEN;
  if (!cfg.token) {
    cfg.token = crypto.randomBytes(18).toString('base64url');
    fs.writeFileSync(arq, JSON.stringify(cfg, null, 2), 'utf8');
    console.log('>> Token de equipe gerado em data/config.json');
  }
  return cfg;
}
const CONFIG = carregarConfig();

// ── Utilidades ───────────────────────────────────────────────
function idSeguro(id) {
  return typeof id === 'string' && /^[A-Z0-9-]{3,40}$/.test(id);
}
function arqObra(id) { return path.join(DIR_OBRAS, id + '.json'); }

function salvarAtomico(arq, obj) {
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  fs.renameSync(tmp, arq);
}
function lerObra(id) {
  const arq = arqObra(id);
  if (!fs.existsSync(arq)) return null;
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
}
function tokenValido(req) {
  const h = req.headers['authorization'] || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : (req.headers['x-token'] || '');
  const a = Buffer.from(String(t));
  const b = Buffer.from(String(CONFIG.token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Merge (espelho das regras do app) ────────────────────────
function ms(x) { const t = new Date(x || 0).getTime(); return isNaN(t) ? 0 : t; }

function mergeObras(atual, recebido) {
  if (!atual) return recebido;
  const out = Object.assign({}, atual);

  // Meta: vence a edição mais recente (fallback: recebido, que é mais novo em uso)
  const metaCampos = ['nome', 'endereco', 'municipio', 'dataInicio', 'dataTermino',
    'status', 'lat', 'lng', 'metaEditadaEm'];
  const metaSrc = ms(recebido.metaEditadaEm || recebido.dataCriacao) >=
                  ms(atual.metaEditadaEm || atual.dataCriacao) ? recebido : atual;
  for (const k of metaCampos) if (metaSrc[k] !== undefined) out[k] = metaSrc[k];

  // EAP (slots renomeados / visibilidade): vence a configuração mais recente
  if (recebido.eap && (!atual.eap || ms(recebido.eapEditadaEm) >= ms(atual.eapEditadaEm))) {
    out.eap = recebido.eap;
    out.eapEditadaEm = recebido.eapEditadaEm || atual.eapEditadaEm || null;
  }

  // Registros: por subetapa, vence o ts mais recente
  out.registros = Object.assign({}, atual.registros);
  for (const [id, reg] of Object.entries(recebido.registros || {})) {
    const at = out.registros[id];
    if (!at || ms(reg.ts) > ms(at.ts)) out.registros[id] = reg;
  }

  // Histórico: união sem duplicatas — NUNCA apaga (log de auditoria)
  const chave = h => (h.em || '') + '|' + (h.tipo || '') + '|' + (h.sub || '');
  const vistos = new Set((atual.historico || []).map(chave));
  out.historico = (atual.historico || []).slice();
  for (const h of (recebido.historico || [])) {
    const k = chave(h);
    if (!vistos.has(k)) { vistos.add(k); out.historico.push(h); }
  }
  out.historico.sort((a, b) => ms(a.em) - ms(b.em));

  // Alertas: estado = última entrada 'alerta' do histórico por subetapa.
  // (Assim a REMOÇÃO de alertas também sincroniza entre aparelhos.)
  const ultAlerta = {};
  for (const h of out.historico) if (h.tipo === 'alerta' && h.sub) ultAlerta[h.sub] = h;
  out.alertas = {};
  for (const src of [atual.alertas || {}, recebido.alertas || {}]) {
    for (const [id, lista] of Object.entries(src)) {
      if (!ultAlerta[id] && Array.isArray(lista) && lista.length) out.alertas[id] = lista;
    }
  }
  for (const [id, h] of Object.entries(ultAlerta)) {
    if (Array.isArray(h.alertas) && h.alertas.length) out.alertas[id] = h.alertas;
  }

  // ultimaExportacao: mantém a mais recente (controle do CSV incremental)
  out.ultimaExportacao = ms(recebido.ultimaExportacao) > ms(atual.ultimaExportacao)
    ? recebido.ultimaExportacao : atual.ultimaExportacao;

  out.dataCriacao = atual.dataCriacao || recebido.dataCriacao;
  out.id_obra = atual.id_obra;
  out._versao = 2;
  return out;
}

function validarObra(o) {
  if (!o || typeof o !== 'object') return 'corpo inválido';
  if (!idSeguro(o.id_obra)) return 'id_obra inválido';
  if (typeof o.nome !== 'string' || !o.nome.trim()) return 'nome obrigatório';
  if (o.registros && typeof o.registros !== 'object') return 'registros inválidos';
  if (o.historico && !Array.isArray(o.historico)) return 'historico inválido';
  return null;
}

// ── HTTP helpers ─────────────────────────────────────────────
function json(res, status, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(b);
}
function lerBody(req) {
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on('data', c => {
      tam += c.length;
      if (tam > LIMITE_BODY) { reject(new Error('payload muito grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

function servirEstatico(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const alvo = path.normalize(path.join(DIR_APP, rel));
  if (!alvo.startsWith(DIR_APP)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('não encontrado'); return;
  }
  const ext = path.extname(alvo).toLowerCase();
  const semCache = ext === '.html' || alvo.endsWith('sw.js');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': semCache ? 'no-cache' : 'public, max-age=3600'
  });
  fs.createReadStream(alvo).pipe(res);
}

// ── Rotas ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = req.url || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Token',
      'Access-Control-Max-Age': '86400'
    });
    res.end(); return;
  }

  if (!u.startsWith('/api/')) return servirEstatico(req, res, u);

  if (u === '/api/health') return json(res, 200, { ok: true, versaoApi: VERSAO_API, agora: new Date().toISOString() });

  if (!tokenValido(req)) return json(res, 401, { erro: 'token inválido ou ausente' });

  try {
    // GET /api/obras — resumo de todas as obras no servidor
    if (req.method === 'GET' && u === '/api/obras') {
      const lista = fs.readdirSync(DIR_OBRAS).filter(f => f.endsWith('.json')).map(f => {
        try {
          const o = JSON.parse(fs.readFileSync(path.join(DIR_OBRAS, f), 'utf8'));
          return {
            id_obra: o.id_obra, nome: o.nome, municipio: o.municipio,
            status: o.status, _syncEm: o._syncEm || null,
            registros: Object.keys(o.registros || {}).length
          };
        } catch { return null; }
      }).filter(Boolean);
      return json(res, 200, { obras: lista });
    }

    // GET /api/obras/:id — obra completa
    let m = u.match(/^\/api\/obras\/([A-Z0-9-]+)$/);
    if (req.method === 'GET' && m) {
      if (!idSeguro(m[1])) return json(res, 400, { erro: 'id inválido' });
      const o = lerObra(m[1]);
      if (!o) return json(res, 404, { erro: 'obra não encontrada' });
      return json(res, 200, { obra: o });
    }

    // POST /api/sync — envia obra completa, recebe estado mesclado
    if (req.method === 'POST' && u === '/api/sync') {
      const corpo = await lerBody(req);
      let dados;
      try { dados = JSON.parse(corpo); } catch { return json(res, 400, { erro: 'JSON inválido' }); }
      const obra = dados.obra || dados;
      const erro = validarObra(obra);
      if (erro) return json(res, 400, { erro });
      const atual = lerObra(obra.id_obra);
      const merged = mergeObras(atual, obra);
      merged._syncEm = new Date().toISOString();
      salvarAtomico(arqObra(merged.id_obra), merged);
      console.log(`[sync] ${merged.id_obra} — hist:${(merged.historico || []).length} reg:${Object.keys(merged.registros || {}).length}`);
      return json(res, 200, { obra: merged });
    }

    // DELETE /api/obras/:id — soft delete (move para lixeira, nada se perde)
    m = u.match(/^\/api\/obras\/([A-Z0-9-]+)$/);
    if (req.method === 'DELETE' && m) {
      if (!idSeguro(m[1])) return json(res, 400, { erro: 'id inválido' });
      const arq = arqObra(m[1]);
      if (!fs.existsSync(arq)) return json(res, 404, { erro: 'obra não encontrada' });
      const destino = path.join(DIR_LIXEIRA, m[1] + '_' + Date.now() + '.json');
      fs.renameSync(arq, destino);
      return json(res, 200, { ok: true, movidaPara: 'lixeira' });
    }

    return json(res, 404, { erro: 'rota não encontrada' });
  } catch (e) {
    console.error('[erro]', e);
    return json(res, 500, { erro: 'erro interno' });
  }
});

server.listen(PORT, () => {
  console.log('============================================');
  console.log('  CONSTRUTRACK — servidor no ar');
  console.log('  App:   http://localhost:' + PORT + '/');
  console.log('  API:   http://localhost:' + PORT + '/api/health');
  console.log('  Token: ' + CONFIG.token);
  console.log('============================================');
});
