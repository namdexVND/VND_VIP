'use strict';
// Ghép trang thiệp từ template + cấu hình, rồi mã hóa (XOR + base64) thành 1 trang "vỏ" chỉ có bộ giải mã.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const T = f => {
  const p = path.join(__dirname, '..', 'template', f);
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { throw new Error('Thiếu file template: template/' + f + ' (' + e.code + ')'); }
};
// Đọc template khi cần (không đọc lúc nạp module) để lỗi thiếu file hiện rõ thay vì làm chết cả function
let _tpl = null;
function tpl() {
  if (!_tpl) _tpl = { CSS: T('greeting.css'), BODY: T('greeting.body.html'), JS: T('greeting.js'), GUARD: T('guard.js') };
  return _tpl;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function marquee(text) {
  let t = (text || '').trim() || '🌹 Chúc mừng ngày 20/10 🌹 Happy Women\'s Day 💗';
  let out = t;
  while (out.length < 130) out += ' ' + t;
  return esc(out);
}

function packPage(cfg) {
  const { CSS, BODY, JS, GUARD } = tpl();
  const payload = JSON.stringify({
    t: cfg.title || 'Gửi bạn',
    c: CSS,
    b: BODY.replace('{{MARQUEE}}', () => marquee(cfg.marquee)),
    j: GUARD + '\n' + JS.replace('/*CONFIG*/', () => 'const CONFIG = ' + JSON.stringify({
      title: cfg.title, message: cfg.message, sign: cfg.sign || '', photos: cfg.photos || [], musicUrl: cfg.musicUrl || ''
    }) + ';')
  });
  const buf = Buffer.from(payload, 'utf8');
  const key = crypto.randomBytes(24);
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length] ^ ((i * 31 + 7) & 255);
  // khóa tách thành 2 nửa đảo ngược cho khó nhìn
  const k = key.toString('base64');
  const k1 = k.slice(0, 16).split('').reverse().join(''), k2 = k.slice(16).split('').reverse().join('');
  const loader = `(function(){var a=${JSON.stringify(out.toString('base64'))},b=${JSON.stringify(k1)},c=${JSON.stringify(k2)};` +
    `try{var k=atob(b.split('').reverse().join('')+c.split('').reverse().join('')),r=atob(a),n=r.length,u=new Uint8Array(n),i;` +
    `for(i=0;i<n;i++)u[i]=r.charCodeAt(i)^k.charCodeAt(i%k.length)^((i*31+7)&255);` +
    `var o=JSON.parse(new TextDecoder().decode(u)),d=document,s=d.createElement('style');d.title=o.t;s.textContent=o.c;d.head.appendChild(s);d.body.innerHTML=o.b;(new Function(o.j))();}` +
    `catch(e){document.body.textContent='Lỗi tải trang'}})();`;
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">' +
    '<title>💗</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600&family=Dancing+Script:wght@600;700&display=swap&subset=vietnamese" rel="stylesheet">' +
    '<style>html,body{margin:0;height:100%;background:#fbd9de}</style></head><body><script>' + loader + '</script></body></html>';
}

module.exports = { packPage, esc };
