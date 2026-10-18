'use strict';
// Lưu cấu hình thiệp galaxy vào Upstash Redis (qua REST API, không cần cài thư viện).
// Dùng 2 biến môi trường: KV_REST_API_URL + KV_REST_API_TOKEN  (hoặc UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
// Khóa có tiền tố "galaxy:" nên dùng chung database với thiệp cũ ("thiep:") không bị lẫn.
// Chưa có biến Redis: chạy local thì lưu RAM để thử; chạy trên Vercel thì BÁO LỖI (không tạo ra link chết).
const crypto = require('crypto');

const clean = v => String(v || '').trim().replace(/^["']|["']$/g, '').trim();
let URL_ = clean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
if (URL_ && !/^https?:\/\//i.test(URL_)) URL_ = 'https://' + URL_;
URL_ = URL_.replace(/\/+$/, '');
const TOKEN = clean(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN).replace(/^Bearer\s+/i, '');

const PREFIX = 'galaxy:';
const TTL = Math.max(1, parseInt(process.env.LINK_TTL_DAYS || '400', 10) || 400) * 86400;
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PERSISTENT = !!(URL_ && TOKEN);
const mem = globalThis.__galaxyMem || (globalThis.__galaxyMem = new Map());

function noDb() {
  const e = new Error('Chưa cấu hình database: thiếu KV_REST_API_URL/KV_REST_API_TOKEN (hoặc UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN)');
  e.code = 'NO_DB';
  return e;
}

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(8000)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) throw new Error('Redis ' + r.status + ': ' + ((j && j.error) || 'phản hồi không hợp lệ'));
  return j.result;
}

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
    const id = newId(), key = PREFIX + id;
    if (PERSISTENT) {
      if ((await redis(['SET', key, val, 'NX', 'EX', String(TTL)])) === 'OK') return id;
    } else if (!mem.has(key)) { mem.set(key, val); return id; }
  }
  throw new Error('Không tạo được id');
}

async function load(id) {
  if (!PERSISTENT && process.env.VERCEL) throw noDb();
  const key = PREFIX + id;
  const v = PERSISTENT ? await redis(['GET', key]) : mem.get(key);
  return v ? JSON.parse(v) : null;
}

module.exports = { save, load, persistent: PERSISTENT };
