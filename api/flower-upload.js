'use strict';
// Nhận ảnh (base64) từ trang tạo → đẩy lên Catbox (không cần khóa). Catbox lỗi mà có IMGBB_KEY thì thử ImgBB.
// Kiểm tra nhanh: GET /api/flower-upload?test=<FLOWER_TEST_TOKEN>
//   (cần đặt biến môi trường FLOWER_TEST_TOKEN; không đặt thì chỉ test được khi không chạy production)
const hits = globalThis.__flowerUp || (globalThis.__flowerUp = new Map());
const MAX_IPS = 500;
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const UA = 'Mozilla/5.0 (compatible; flower-upload)';

function limited(ip, max) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > MAX_IPS) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] >= 60000) hits.delete(k);
    }
    for (const k of hits.keys()) {
      if (hits.size <= MAX_IPS) break;
      hits.delete(k);
    }
  }
  return arr.length > max;
}

function sameOrigin(req, host) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === host; } catch { return false; } // Origin "null" không làm sập server
}

const firstOf = v => String(v || '').split(',')[0].trim();

// Nhận diện định dạng qua magic bytes; trả null nếu không phải ảnh được hỗ trợ
function sniff(b64) {
  if (b64.startsWith('iVBOR')) return ['image/png', 'png'];
  if (b64.startsWith('R0lGOD')) return ['image/gif', 'gif'];
  if (b64.startsWith('UklGR')) return ['image/webp', 'webp'];
  if (b64.startsWith('/9j/')) return ['image/jpeg', 'jpg'];
  return null;
}

async function toCatbox(image, mime, ext) {
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
  const type = sniff(image);
  if (!type) throw new Error('Định dạng ảnh không được hỗ trợ (chỉ JPG, PNG, GIF, WEBP)');
  const errs = [];
  try { return { url: await toCatbox(image, type[0], type[1]), via: 'catbox' }; }
  catch (e) { errs.push(e.name === 'TimeoutError' ? 'Catbox phản hồi quá chậm' : e.message); }
  const key = process.env.IMGBB_KEY;
  if (key) {
    try { return { url: await toImgbb(key, image, test ? '&expiration=60' : ''), via: 'imgbb' }; }
    catch (e) { errs.push(e.name === 'TimeoutError' ? 'ImgBB phản hồi quá chậm' : e.message); }
  }
  const err = new Error(errs.join(' | '));
  err.upstream = true;
  throw err;
}

function testAllowed(req) {
  const token = process.env.FLOWER_TEST_TOKEN;
  if (token) return String(req.query.test) === token;
  return process.env.NODE_ENV !== 'production';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ip = firstOf(req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || 'x';

  if (req.method === 'GET') { // kiểm tra nhanh
    if (limited(ip, 10)) return res.status(429).json({ error: 'Thao tác quá nhanh, thử lại sau 1 phút' });
    const out = { ok: true };
    if (req.query && req.query.test) {
      if (!testAllowed(req)) return res.status(403).json({ error: 'Không được phép' });
      out.hasImgbbKey = !!process.env.IMGBB_KEY;
      const t = Date.now();
      try { Object.assign(out, await uploadAny(GIF, true)); }
      catch (e) { out.ok = false; out.error = e.message; }
      out.ms = Date.now() - t;
    }
    return res.status(200).json(out);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' });

  const host = firstOf(req.headers['x-forwarded-host']) || req.headers.host;
  if (!sameOrigin(req, host)) return res.status(403).json({ error: 'Sai nguồn gửi' });
  if (limited(ip, 30)) return res.status(429).json({ error: 'Tải ảnh quá nhanh, thử lại sau 1 phút' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const image = String((b && b.image) || '').replace(/^data:[^,]*,/, '');
  if (!image || image.length > 3000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image))
    return res.status(400).json({ error: 'Ảnh không hợp lệ hoặc quá lớn' });
  if (!sniff(image))
    return res.status(400).json({ error: 'Chỉ nhận ảnh JPG, PNG, GIF hoặc WEBP' });

  try {
    res.status(200).json({ url: (await uploadAny(image, false)).url });
  } catch (e) {
    console.error('API flower-upload error:', e.message);
    res.status(502).json({ error: 'Không tải được ảnh lên, vui lòng thử lại sau' });
  }
};
