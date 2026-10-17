'use strict';
// Lưu cấu hình thiệp. Có Upstash Redis (Vercel Storage) thì dùng, không có thì lưu RAM (chỉ để chạy thử).
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = Math.max(1, parseInt(process.env.LINK_TTL_DAYS || '400', 10)) * 86400;
const mem = globalThis.__thiepMem || (globalThis.__thiepMem = new Map());
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function newId(len = 8) {
  const b = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

async function save(obj) {
  const val = JSON.stringify(obj);
  for (let i = 0; i < 5; i++) {
    const id = newId();
    if (URL_ && TOKEN) {
      if ((await redis(['SET', 'thiep:' + id, val, 'NX', 'EX', String(TTL)])) === 'OK') return id;
    } else if (!mem.has(id)) { mem.set(id, val); return id; }
  }
  throw new Error('Không tạo được id');
}

async function load(id) {
  const v = URL_ && TOKEN ? await redis(['GET', 'thiep:' + id]) : mem.get(id);
  return v ? JSON.parse(v) : null;
}

module.exports = { save, load, persistent: !!(URL_ && TOKEN) };
