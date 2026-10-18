'use strict';
// Nhận ảnh (base64) từ trang tạo → đẩy lên Catbox (không cần khóa). Catbox lỗi mà có IMGBB_KEY thì thử ImgBB.
// Mở /api/galaxy-upload?test=1 trên trình duyệt để thử tải 1 ảnh nhỏ và xem kết quả.
const hits = globalThis.__galaxyUp || (globalThis.__thiepUp = new Map());
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const UA = 'Mozilla/5.0 (compatible; thiep-galaxy)';

function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 500) hits.clear();
  return arr.length > 30;
}

function sniff(b64) {
  if (b64.startsWith('iVBOR')) return ['image/png', 'png'];
  if (b64.startsWith('R0lGOD')) return ['image/gif', 'gif'];
  if (b64.startsWith('UklGR')) return ['image/webp', 'webp'];
  return ['image/jpeg', 'jpg'];
}

async function toCatbox(image) {
  const [mime, ext] = sniff(image);
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', new Blob([Buffer.from(image, 'base64')], { type: mime }), 'anh.' + ext);
  const r = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST', body: fd, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000)
  });
  const t = (await r.text()).trim();
  if (!r.ok || !/^https:\/\/files\.catbox\.moe\/[\w.-]+$/.test(t)) throw new Error('Catbox: ' + (t.slice(0, 120) || r.status));
  return t;
}

async function toImgbb(key, image, extra) {
  const fd = new FormData();
  fd.append('image', image);
  const r = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key) + (extra || ''),
    { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.success) throw new Error('ImgBB: ' + ((j && j.error && j.error.message) || r.status));
  return j.data.url;
}

async function uploadAny(image, test) {
  const errs = [];
  try { return { url: await toCatbox(image), via: 'catbox' }; }
  catch (e) { errs.push(e.name === 'TimeoutError' ? 'Catbox phản hồi quá chậm' : e.message); }
  const key = process.env.IMGBB_KEY;
  if (key) {
    try { return { url: await toImgbb(key, image, test ? '&expiration=60' : ''), via: 'imgbb' }; }
    catch (e) { errs.push(e.name === 'TimeoutError' ? 'ImgBB phản hồi quá chậm' : e.message); }
  }
  throw new Error(errs.join(' | '));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') { // kiểm tra nhanh
    const out = { ok: true, hasImgbbKey: !!process.env.IMGBB_KEY };
    if (req.query && req.query.test) {
      const t = Date.now();
      try { Object.assign(out, await uploadAny(GIF, true)); }
      catch (e) { out.ok = false; out.error = e.message; }
      out.ms = Date.now() - t;
    }
    return res.status(200).json(out);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });

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
    res.status(200).json({ url: (await uploadAny(image, false)).url });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
