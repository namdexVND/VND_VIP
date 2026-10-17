'use strict';
const store = require('../lib/store');

const hits = globalThis.__thiepHits || (globalThis.__thiepHits = new Map());
const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
const httpUrl = v => { v = clip(v, 600); return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v : ''; };

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

  const cfg = {
    title: clip(b.title, 60) || 'Gửi bạn!',
    message: clip(b.message, 1500),
    sign: clip(b.sign, 60),
    marquee: clip(b.marquee, 200),
    musicUrl: httpUrl(b.musicUrl),
    photos: (Array.isArray(b.photos) ? b.photos : []).slice(0, 12)
      .map(p => ({ src: httpUrl(p && p.src), caption: clip(p && p.caption, 40) })).filter(p => p.src)
  };
  if (!cfg.message) return res.status(400).json({ error: 'Chưa có nội dung thư' });

  try {
    const id = await store.save(cfg);
    const base = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
    res.status(200).json({ id, url: `${base}/w/${id}`, persistent: store.persistent });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi máy chủ: ' + e.message });
  }
};
