'use strict';
// Lưu cấu hình thiệp galaxy. Có Upstash Redis (Vercel Storage) thì dùng, không có thì lưu RAM (chỉ để chạy thử).
// Khóa dùng tiền tố "galaxy:" nên dùng chung database với thiepmoi cũng không bị lẫn.
const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = Math.max(1, parseInt(process.env.LINK_TTL_DAYS || '400', 10)) * 86400;
const mem = globalThis.__galaxyMem || (globalThis.__galaxyMem = new Map());
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

async function put(prefix, val) {
  for (let i = 0; i < 5; i++) {
    const id = newId(), key = prefix + id;
    if (URL_ && TOKEN) {
      if ((await redis(['SET', key, val, 'NX', 'EX', String(TTL)])) === 'OK') return id;
    } else if (!mem.has(key)) { mem.set(key, val); return id; }
  }
  throw new Error('Không tạo được id');
}
async function get(prefix, id) {
  const key = prefix + id;
  const v = URL_ && TOKEN ? await redis(['GET', key]) : mem.get(key);
  return v || null;
}

const save = obj => put('galaxy:', JSON.stringify(obj));
const load = async id => { const v = await get('galaxy:', id); return v ? JSON.parse(v) : null; };

module.exports = { save, load, persistent: !!(URL_ && TOKEN) };
