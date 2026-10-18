'use strict';
const store = require('../lib/galaxy-store');

const hits = globalThis.__galaxyHits || (globalThis.__galaxyHits = new Map());
const MAX_IPS = 500;

const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
// Chỉ nhận http(s), loại bỏ ký tự có thể phá CSS/JS khi nhúng vào trang
const httpUrl = v => {
  v = clip(v, 600);
  if (!/^https?:\/\/[^\s"'<>\\`(){}|^]+$/i.test(v)) return '';
  try { new URL(v); return v; } catch { return ''; }
};
const lines = (v, max, len) => (Array.isArray(v) ? v : []).map(x => clip(x, len)).filter(Boolean).slice(0, max);
const secs = (v, d, max) => { v = parseFloat(v); return isFinite(v) && v >= 0 ? Math.min(v, max) : d; };

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > MAX_IPS) {
    // Xóa các IP đã hết hạn thay vì xóa sạch toàn bộ
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] >= 60000) hits.delete(k);
    }
    // Vẫn quá nhiều thì bỏ bớt các IP cũ nhất
    for (const k of hits.keys()) {
      if (hits.size <= MAX_IPS) break;
      hits.delete(k);
    }
  }
  return arr.length > 12;
}

function sameOrigin(req, host) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === host; } catch { return false; } // Origin "null" không làm sập server
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
    if (!id || !/^[0-9A-Za-z]{6,16}$/.test(String(id))) {
      // ID phải khớp định dạng mà galaxy-view.js chấp nhận, nếu không link sẽ 404
      throw new Error('ID không hợp lệ: ' + id);
    }
    if (!store.persistent) {
      console.warn('galaxy-create: store KHÔNG bền vững (đang lưu trong bộ nhớ) – link có thể 404 trên Vercel. Hãy cấu hình database.');
    }
    const base = (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '');
    res.status(200).json({ id, url: `${base}/g/${id}`, persistent: !!store.persistent });
  } catch (e) {
    console.error('API galaxy-create error:', e);
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau' });
  }
};
