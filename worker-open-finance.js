// FREIVORA · servidor pessoal do Open Finance (Cloudflare Worker)
// Lê as compras do seu cartão no Meu Pluggy e entrega ao app, já separadas por banco.
//
// Variáveis a cadastrar no Cloudflare (Settings > Variables and Secrets), todas como Secret:
//   PLUGGY_CLIENT_ID      Client ID da sua aplicação no Pluggy Dashboard
//   PLUGGY_CLIENT_SECRET  Client Secret da mesma aplicação
//   ITEMS                 Bancos e itemIds, no formato:  PicPay=ID_DO_ITEM;Itaú=ID_DO_ITEM
//   APP_TOKEN             Uma senha longa inventada por você (a "chave de acesso" que vai no app)
//   ALLOW_ORIGIN          (opcional) Endereço do seu app, ex.: https://meuapp.pages.dev

const API = 'https://api.pluggy.ai';
let KEY = null, KEY_EXP = 0;

const corsHeaders = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Vary': 'Origin',
});
const json = (data, status, headers) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});
// comparação em tempo constante, para não vazar a chave por diferença de tempo
const same = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

async function apiKey(env, force) {
  if (!force && KEY && Date.now() < KEY_EXP) return KEY;
  const r = await fetch(API + '/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error('auth ' + r.status);
  KEY = (await r.json()).apiKey;
  KEY_EXP = Date.now() + 100 * 60 * 1000; // a chave vale 2 horas
  return KEY;
}
async function pluggy(env, path) {
  let r = await fetch(API + path, { headers: { 'X-API-KEY': await apiKey(env) } });
  if (r.status === 401 || r.status === 403) {
    r = await fetch(API + path, { headers: { 'X-API-KEY': await apiKey(env, true) } });
  }
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

const parseItems = (txt) => String(txt || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
  const i = x.indexOf('=');
  return { bank: x.slice(0, i).trim(), id: x.slice(i + 1).trim() };
}).filter(x => x.bank && x.id);

// categorias do app: Delivery, Assinaturas, Pessoal, Casa, Transporte, Lazer, Outros
function categoria(t) {
  const x = ((t.category || '') + ' ' + (t.description || '')).toLowerCase();
  if (/delivery|ifood|rappi|uber ?eats|restaurant|eating|food|lanche|pizza|burger/.test(x)) return 'Delivery';
  if (/netflix|spotify|prime|disney|hbo|youtube|apple\.com|google|subscri|streaming|assinatura|icloud/.test(x)) return 'Assinaturas';
  if (/uber|99 ?pop|taxi|transport|fuel|gas station|posto|combust|estaciona|pedagio|pedágio/.test(x)) return 'Transporte';
  if (/supermarket|grocery|mercado|market|home|rent|aluguel|utilit|energia|água|agua|condom/.test(x)) return 'Casa';
  if (/entertain|leisure|game|cinema|travel|viagem|hotel|ingresso|show/.test(x)) return 'Lazer';
  if (/health|pharmac|farmac|beauty|shopping|cloth|roupa|personal|saúde|saude|academia/.test(x)) return 'Pessoal';
  return 'Outros';
}

export default {
  async fetch(req, env) {
    const h = corsHeaders(env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (url.pathname !== '/transactions') return json({ ok: true, service: 'freivora-open-finance' }, 200, h);

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.APP_TOKEN || !same(token, env.APP_TOKEN)) return json({ error: 'não autorizado' }, 401, h);

    try {
      const days = Math.min(180, Math.max(1, +url.searchParams.get('days') || 90));
      const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
      const out = [];
      for (const it of parseItems(env.ITEMS)) {
        const acc = await pluggy(env, '/accounts?itemId=' + encodeURIComponent(it.id));
        for (const a of (acc.results || []).filter(x => x.type === 'CREDIT')) {
          let page = 1, pages = 1;
          do {
            const tr = await pluggy(env, `/transactions?accountId=${encodeURIComponent(a.id)}&from=${from}&pageSize=500&page=${page}`);
            pages = tr.totalPages || 1;
            for (const t of tr.results || []) {
              // no cartão, compra = DEBIT com valor positivo; pagamento da fatura = CREDIT (fica de fora)
              if (t.type !== 'DEBIT' || !(t.amount > 0)) continue;
              out.push({
                id: t.id,
                date: String(t.date).slice(0, 10),
                name: String(t.description || 'Compra').slice(0, 60),
                val: Math.round(t.amount * 100) / 100,
                bank: it.bank,
                cat: categoria(t),
              });
            }
            page++;
          } while (page <= pages && page <= 6);
        }
      }
      return json(out, 200, h);
    } catch (e) {
      return json({ error: 'falha ao consultar o Pluggy' }, 502, h);
    }
  },
};
