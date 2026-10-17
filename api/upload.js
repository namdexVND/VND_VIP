'use strict';
// Nhận ảnh (base64) từ trang tạo, đẩy lên ImgBB bằng khóa giấu trên server (biến IMGBB_KEY), trả về link ảnh.
// Mở /api/upload trên trình duyệt để kiểm tra: thêm ?test=1 để thử tải 1 ảnh nhỏ (tự xóa sau 60 giây).
const hits = globalThis.__thiepUp || (globalThis.__thiepUp = new Map());
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 500) hits.clear();
  return arr.length > 30;
}

async function toImgbb(key, image, extra) {
  const fd = new FormData();
  fd.append('image', image);
  const r = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key) + (extra || ''),
    { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.success) throw new Error('ImgBB từ chối: ' + ((j && j.error && j.error.message) || r.status));
  return j.data.url;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.IMGBB_KEY;

  if (req.method === 'GET') { // kiểm tra nhanh
    const out = { ok: true, hasKey: !!key };
    if (key && req.query && req.query.test) {
      const t = Date.now();
      try { out.url = await toImgbb(key, GIF, '&expiration=60'); out.ms = Date.now() - t; }
      catch (e) { out.ok = false; out.error = (e.name === 'TimeoutError' ? 'ImgBB phản hồi quá chậm (>20s)' : e.message); out.ms = Date.now() - t; }
    }
    return res.status(200).json(out);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });
  if (!key) return res.status(500).json({ error: 'Chưa cài biến IMGBB_KEY trên Vercel' });

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (req.headers.origin && new URL(req.headers.origin).host !== host)
    return res.status(403).json({ error: 'Sai nguồn gửi' });
  if (limited((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x'))
    return res.status(429).json({ error: 'Tải ảnh quá nhanh, thử lại sau 1 phút' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const image = String((b && b.image) || '').replace(/^data:[^,]*,/, '');
  if (!image || image.length > 3000000 || !/^[A-Za-z0-9+/=]+$/.test(image))
    return res.status(400).json({ error: 'Ảnh không hợp lệ hoặc quá lớn' });

  try {
    res.status(200).json({ url: await toImgbb(key, image) });
  } catch (e) {
    const to = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    res.status(to ? 504 : 502).json({ error: to ? 'ImgBB phản hồi quá chậm, thử lại' : e.message });
  }
};
