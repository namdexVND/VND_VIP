'use strict';
// Lưu thiệp vào Firebase Realtime Database qua REST (không cần cài thư viện).
// Dữ liệu nằm ở nhánh /thiep/<id>. Đặt FIREBASE_DB_URL trên Vercel để dùng database khác.
const crypto = require('crypto');

const DB = (process.env.FIREBASE_DB_URL || 'https://vndvip-9eb75-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/$/, '');
const MEM = DB === 'memory'; // chỉ dùng khi chạy thử cục bộ
const mem = globalThis.__thiepMem || (globalThis.__thiepMem = new Map());
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function newId(len = 8) {
  const b = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

async function save(obj) {
  const val = Object.assign({}, obj, { _t: Date.now() });
  let lastErr = '';
  for (let i = 0; i < 5; i++) {
    const id = newId();
    if (MEM) { if (!mem.has(id)) { mem.set(id, val); return id; } continue; }
    const r = await fetch(`${DB}/thiep/${id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(val)
    });
    if (r.ok) return id;
    lastErr = r.status + ' ' + (await r.text()).slice(0, 120);
    if (r.status !== 401 && r.status !== 403) break; // 401/403 = id đã tồn tại hoặc Rules chặn
  }
  throw new Error('Firebase từ chối ghi (' + lastErr + '). Kiểm tra Rules của Realtime Database.');
}

async function load(id) {
  if (MEM) return mem.get(id) || null;
  const r = await fetch(`${DB}/thiep/${id}.json`);
  if (!r.ok) throw new Error('Firebase đọc lỗi ' + r.status);
  return await r.json(); // null nếu không có
}

module.exports = { save, load, persistent: true };
