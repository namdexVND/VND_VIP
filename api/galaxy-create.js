'use strict';
const store = require('../lib/galaxy-store');

const hits = globalThis.__galaxyHits || (globalThis.__galaxyHits = new Map());
const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
const httpUrl = v => { v = clip(v, 600); return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v : ''; };
const lines = (v, max, len) => (Array.isArray(v) ? v : []).map(x => clip(x, len)).filter(Boolean).slice(0, max);
const secs = (v, d, max) => { v = parseFloat(v); return isFinite(v) && v >= 0 ? Math.min(v, max) : d; };

function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 500) hits.clear();
  return arr.length > 12;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  if (req.headers.origin && new URL(req.headers.origin).host !== host)
    return res.status(403).json({ error: 'Sai nguồn gửi' });
  if (limited((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x'))
    return res.status(429).json({ error: 'Bạn thao tác quá nhanh, thử lại sau 1 phút' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });

  const t = b.texts && typeof b.texts === 'object' ? b.texts : {};
  const l = b.letter && typeof b.letter === 'object' ? b.letter : {};
  const cfg = {
    ringTexts: lines(b.ringTexts, 8, 60),
    hintText: clip(b.hintText, 40),
    texts: { name2: clip(t.name2, 40), love: clip(t.love, 40), lover: clip(t.lover, 40) },
    letter: { title: clip(l.title, 60), text: clip(l.text, 1500) },
    images: (Array.isArray(b.images) ? b.images : []).slice(0, 10).map(httpUrl).filter(Boolean),
    music: httpUrl(b.music),
    nameDelay: secs(b.nameDelay, 10, 120),
    holdAfterName2: secs(b.holdAfterName2, 5, 60)
  };
  if (!cfg.letter.text) return res.status(400).json({ error: 'Chưa có nội dung thư' });

  try {
    const id = await store.save(cfg);
    const base = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
    res.status(200).json({ id, url: `${base}/g/${id}`, persistent: store.persistent });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi máy chủ: ' + e.message });
  }
};
