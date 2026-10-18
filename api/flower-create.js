'use strict';
const store = require('../lib/flower-store');

const hits = globalThis.__flowerHits || (globalThis.__flowerHits = new Map());
const MAX_IPS = 500;

const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
// Chỉ nhận http(s); cho phép ( ) trong URL, loại các ký tự có thể phá trang
const httpUrl = v => {
  v = clip(v, 600);
  if (!/^https?:\/\/[^\s"'<>\\`{}|^]+$/i.test(v)) return '';
  try { new URL(v); return v; } catch { return ''; }
};
const lines = (v, max, len) => (Array.isArray(v) ? v : []).map(x => clip(x, len)).filter(Boolean).slice(0, max);
const secs = (v, d, max, min) => { v = parseFloat(v); return isFinite(v) && v >= min ? Math.min(v, max) : d; };

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > MAX_IPS) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= 60000) hits.delete(k);
    for (const k of hits.keys()) { if (hits.size <= MAX_IPS) break; hits.delete(k); }
  }
  return arr.length > 12;
}

function sameOrigin(req, host) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === host; } catch { return false; }
}

const firstOf = v => String(v || '').split(',')[0].trim();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });

  const host = firstOf(req.headers['x-forwarded-host']) || req.headers.host;
  const proto = firstOf(req.headers['x-forwarded-proto']) || 'https';
  if (!sameOrigin(req, host)) return res.status(403).json({ error: 'Sai nguồn gửi' });

  const ip = firstOf(req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || 'x';
  if (limited(ip)) return res.status(429).json({ error: 'Bạn thao tác quá nhanh, thử lại sau 1 phút' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });

  const cfg = {
    tag: clip(b.tag, 20),
    title: clip(b.title, 30),
    sub: clip(b.sub, 40),
    hint: clip(b.hint, 40),
    message: clip(b.message, 500),
    from: clip(b.from, 60),
    music: httpUrl(b.music),
    photos: (Array.isArray(b.photos) ? b.photos : []).slice(0, 10).map(httpUrl).filter(Boolean),
    captions: lines(b.captions, 8, 40),
    speed: secs(b.speed, 85, 300, 20),
    hold: secs(b.hold, 3, 60, 0)
  };
  if (!cfg.message) return res.status(400).json({ error: 'Chưa có lời chúc' });

  try {
    const id = await store.save(cfg);
    if (!id || !/^[0-9A-Za-z]{6,16}$/.test(String(id))) throw new Error('ID không hợp lệ: ' + id);
    const base = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
    res.status(200).json({ id, url: `${base}/f/${id}`, persistent: !!store.persistent });
  } catch (e) {
    console.error('API flower-create error:', e);
    const noDb = e && e.code === 'NO_DB';
    res.status(500).json({ error: noDb ? 'Máy chủ chưa cấu hình database (FIREBASE_SERVICE_ACCOUNT)' : 'Lỗi máy chủ, vui lòng thử lại sau' });
  }
};
