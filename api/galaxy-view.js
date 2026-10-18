'use strict';
const store = require('../lib/galaxy-store');
const { packPage } = require('../lib/galaxy-render');

const STYLE = 'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#fbd9de;color:#5a1f33;font:600 18px system-ui;text-align:center;padding:24px';
const HEAD = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';

// 404: không tìm thấy hoặc link hết hạn
const NOT_FOUND = HEAD + '<title>Không tìm thấy</title><body style="' + STYLE + '">Link này không tồn tại hoặc đã hết hạn 💔</body>';

// 500: lỗi hệ thống
const SERVER_ERROR = HEAD + '<title>Lỗi hệ thống</title><body style="' + STYLE + '">Đã có lỗi xảy ra ở hệ thống, vui lòng thử lại sau! 🛠️</body>';

// Lấy id từ ?id=..., nếu thiếu thì thử lấy từ đường dẫn /g/<id>
function getId(req) {
  let id = req.query && req.query.id;
  if (Array.isArray(id)) id = id[0];
  if (!id && req.url) {
    const m = String(req.url).split('?')[0].match(/\/g\/([^/]+)\/?$/);
    if (m) id = m[1];
  }
  return String(id || '');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method Not Allowed');
  }

  const id = getId(req);

  // ID hợp lệ: 6-16 ký tự chữ và số
  if (!/^[0-9A-Za-z]{6,16}$/.test(id)) {
    return res.status(404).send(NOT_FOUND);
  }

  try {
    const cfg = await store.load(id);
    if (!cfg) return res.status(404).send(NOT_FOUND);
    return res.status(200).send(packPage(cfg));
  } catch (e) {
    // Ghi log chi tiết lên Vercel Console để debug
    console.error('API galaxy-view error details (id=' + id + '):', e);
    return res.status(500).send(SERVER_ERROR);
  }
};
