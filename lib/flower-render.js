'use strict';
// Ghép trang thiệp hoa từ template + cấu hình người dùng. Nội dung nhập vào chỉ đi qua JSON đã escape.
const fs = require('fs');
const path = require('path');

const T = f => fs.readFileSync(path.join(__dirname, '..', 'template', 'flower', f), 'utf8');
const CSS = T('flower.css'), BODY = T('flower.body.html');
let JS;
try { JS = T('flower.min.js'); } catch (e) { JS = T('flower.js'); } // chưa build thì dùng bản gốc
JS = JS.trim().replace(/;$/, '');

const DEFAULTS = {
  pageTitle: 'Thiệp chúc mừng 20/10',
  tag: '20 · 10',
  title: 'Chúc Mừng',
  sub: 'Ngày Phụ Nữ Việt Nam',
  hint: '✦ Chạm để mở thiệp ✦',
  message: 'Chúc bạn luôn rạng rỡ như đóa hoa dưới ánh trăng, ngập tràn yêu thương và bình an mỗi ngày. 💗',
  from: '— Với tất cả yêu thương',
  speed: 85,
  hold: 3,
  music: '',
  photos: [],
  captions: ['20 · 10 ♥', 'Hoa & Trăng', 'Yêu thương', 'Rạng rỡ', 'Bình an']
};

function merge(cfg) {
  const c = cfg || {}, pick = (v, d) => (typeof v === 'string' && v.trim() ? v : d);
  const num = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);
  return {
    pageTitle: pick(c.pageTitle, DEFAULTS.pageTitle),
    tag: pick(c.tag, DEFAULTS.tag),
    title: pick(c.title, DEFAULTS.title),
    sub: pick(c.sub, DEFAULTS.sub),
    hint: pick(c.hint, DEFAULTS.hint),
    message: pick(c.message, DEFAULTS.message),
    from: pick(c.from, DEFAULTS.from),
    speed: Math.max(20, num(c.speed, DEFAULTS.speed)),
    hold: num(c.hold, DEFAULTS.hold),
    music: typeof c.music === 'string' ? c.music : '',
    photos: Array.isArray(c.photos) ? c.photos : [],
    captions: Array.isArray(c.captions) && c.captions.length ? c.captions : DEFAULTS.captions
  };
}

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// JSON nhúng trong <script>: chặn </script>, <!-- và ký tự xuống dòng đặc biệt
const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function packPage(cfg) {
  const conf = merge(cfg);
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">' +
    '<title>' + esc(conf.pageTitle) + '</title><style>' + CSS + '</style></head>' +
    '<body class="not-loaded">' + BODY + '<script>(' + JS + ')(' + safeJson(conf) + ');</script></body></html>';
}

module.exports = { packPage, merge, DEFAULTS };
