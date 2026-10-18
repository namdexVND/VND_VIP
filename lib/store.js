'use strict';
// Lưu cấu hình thiệp vào Firebase Realtime Database (REST API) bằng khóa FIREBASE_SERVICE_ACCOUNT có sẵn.
// KHÔNG cần cài thư viện (không cần sửa package.json), không dùng firebase web SDK.
// Dữ liệu nằm ở nhánh /thiep_links/<id>. Chưa có khóa: chạy local thì lưu RAM, chạy trên Vercel thì BÁO LỖI.
const crypto = require('crypto');

const DB_URL = String(process.env.FIREBASE_DATABASE_URL ||
  'https://vndvip-9eb75-default-rtdb.asia-southeast1.firebasedatabase.app').trim().replace(/\/+$/, '');
const NODE = 'thiep_links';
const SCOPE = 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TTL_MS = Math.max(1, parseInt(process.env.LINK_TTL_DAYS || '400', 10) || 400) * 86400000;
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const mem = globalThis.__thiepMem || (globalThis.__thiepMem = new Map());

// Đọc khóa service account (JSON, JSON có \n bị escape, hoặc base64)
function readAccount() {
  const name = process.env.FIREBASE_SERVICE_ACCOUNT ? 'FIREBASE_SERVICE_ACCOUNT'
    : Object.keys(process.env).find(k => /^FIREBASE_.*SERVICE.*ACCOUNT/i.test(k));
  let raw = name ? String(process.env[name] || '').trim() : '';
  if (!raw) return null;
  raw = raw.replace(/^["']|["']$/g, '').trim();
  if (raw[0] !== '{') { try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch { return null; } }
  try {
    const a = JSON.parse(raw);
    if (!a.client_email || !a.private_key) return null;
    a.private_key = String(a.private_key).replace(/\\n/g, '\n');
    return a;
  } catch { return null; }
}
const ACC = readAccount();
const PERSISTENT = !!ACC;

function noDb() {
  const e = new Error('Chưa cấu hình Firebase: thiếu hoặc sai biến FIREBASE_SERVICE_ACCOUNT');
  e.code = 'NO_DB';
  return e;
}

const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// Lấy access token từ service account (ký JWT RS256) và lưu lại để dùng cho các request sau
async function getToken() {
  const c = globalThis.__thiepTok;
  if (c && c.exp > Date.now() + 60000) return c.token;
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ACC.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(ACC.private_key);
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + body + '.' + b64u(sig),
    signal: AbortSignal.timeout(8000)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) throw new Error('Firebase đăng nhập lỗi ' + r.status + ': ' + ((j && (j.error_description || j.error)) || 'phản hồi không hợp lệ'));
  globalThis.__thiepTok = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

async function rtdb(method, id, body, extraHeaders) {
  const r = await fetch(DB_URL + '/' + NODE + '/' + id + '.json', {
    method,
    headers: Object.assign({ Authorization: 'Bearer ' + await getToken(), 'Content-Type': 'application/json' }, extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, j };
}

const fail = r => new Error('Firebase DB ' + r.status + ': ' + ((r.j && (r.j.error || (r.j.error && r.j.error.message))) || 'lỗi không rõ'));

function newId(len = 8) {
  const b = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

async function save(obj) {
  if (!PERSISTENT && process.env.VERCEL) throw noDb();
  const val = JSON.stringify(obj);
  for (let i = 0; i < 5; i++) {
    const id = newId();
    if (PERSISTENT) {
      const now = Date.now();
      // if-match: null_etag => chỉ ghi khi ID chưa tồn tại (trùng thì Firebase trả 412)
      const r = await rtdb('PUT', id, { data: val, createdAt: now, expireAt: now + TTL_MS }, { 'if-match': 'null_etag' });
      if (r.ok) return id;
      if (r.status !== 412) throw fail(r);
    } else if (!mem.has(id)) { mem.set(id, val); return id; }
  }
  throw new Error('Không tạo được id');
}

async function load(id) {
  if (!PERSISTENT && process.env.VERCEL) throw noDb();
  if (!PERSISTENT) { const v = mem.get(id); return v ? JSON.parse(v) : null; }
  const r = await rtdb('GET', id);
  if (!r.ok) throw fail(r);
  const d = r.j;
  if (!d || typeof d.data !== 'string') return null;
  if (d.expireAt && d.expireAt < Date.now()) return null; // hết hạn
  return JSON.parse(d.data);
}

module.exports = { save, load, persistent: PERSISTENT };
