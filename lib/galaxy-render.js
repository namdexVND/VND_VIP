'use strict';
// Ghép trang galaxy từ template + cấu hình, rồi mã hóa (XOR + base64, khóa riêng mỗi lần) thành 1 trang "vỏ" chỉ có bộ giải mã.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const T = f => fs.readFileSync(path.join(__dirname, '..', 'template', 'galaxy', f), 'utf8');
const CSS = T('galaxy.css'), BODY = T('galaxy.body.html'), JS = T('galaxy.js'), GUARD = T('guard.js');

const DEFAULTS = {
  ringTexts: ['I LOVE YOU'],
  images: [],
  music: '',
  hintText: 'Chạm Vào Tinh Cầu',
  texts: { name2: 'Gửi em', love: 'Anh yêu em', lover: 'Em' },
  letter: { title: 'Gửi em ♡', text: 'Gửi em,\n\nAnh yêu em.' },
  holdAfterName2: 5,
  nameDelay: 10
};

function merge(cfg) {
  const c = cfg || {}, pick = (v, d) => (typeof v === 'string' && v.trim() ? v : d);
  return {
    ringTexts: Array.isArray(c.ringTexts) && c.ringTexts.length ? c.ringTexts : DEFAULTS.ringTexts,
    images: Array.isArray(c.images) ? c.images : DEFAULTS.images,
    music: c.music || DEFAULTS.music,
    hintText: pick(c.hintText, DEFAULTS.hintText),
    texts: {
      name2: pick(c.texts && c.texts.name2, DEFAULTS.texts.name2),
      love: pick(c.texts && c.texts.love, DEFAULTS.texts.love),
      lover: pick(c.texts && c.texts.lover, DEFAULTS.texts.lover)
    },
    letter: {
      title: pick(c.letter && c.letter.title, DEFAULTS.letter.title),
      text: pick(c.letter && c.letter.text, DEFAULTS.letter.text)
    },
    holdAfterName2: Number.isFinite(c.holdAfterName2) ? c.holdAfterName2 : DEFAULTS.holdAfterName2,
    nameDelay: Number.isFinite(c.nameDelay) ? c.nameDelay : DEFAULTS.nameDelay
  };
}

function packPage(cfg) {
  const conf = merge(cfg);
  const code = 'function __w(){return async function(THREE,OrbitControls){' +
    JS.replace('/*CONFIG*/', () => 'const CONFIG = ' + JSON.stringify(conf) + ';') + '\n}}';
  const payload = JSON.stringify({ t: 'Galaxy Love', c: CSS, b: BODY, g: GUARD, j: code });
  const buf = Buffer.from(payload, 'utf8');
  const key = crypto.randomBytes(24);
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length] ^ ((i * 31 + 7) & 255);
  // khóa tách thành 2 nửa đảo ngược cho khó nhìn
  const k = key.toString('base64');
  const k1 = k.slice(0, 16).split('').reverse().join(''), k2 = k.slice(16).split('').reverse().join('');
  const loader = `(function(){var a=${JSON.stringify(out.toString('base64'))},b=${JSON.stringify(k1)},c=${JSON.stringify(k2)};` +
    `function bad(){document.body.textContent='Lỗi tải trang'}` +
    `try{var k=atob(b.split('').reverse().join('')+c.split('').reverse().join('')),r=atob(a),n=r.length,u=new Uint8Array(n),i;` +
    `for(i=0;i<n;i++)u[i]=r.charCodeAt(i)^k.charCodeAt(i%k.length)^((i*31+7)&255);` +
    `var o=JSON.parse(new TextDecoder().decode(u)),d=document,s=d.createElement('style');` +
    `(0,Function)(o.g)();d.title=o.t;s.textContent=o.c;d.head.appendChild(s);d.body.innerHTML=o.b;` +
    `Promise.all([import('three'),import('three/addons/controls/OrbitControls.js')]).then(function(m){` +
    `return (0,Function)(o.j+';return __w()')()(m[0],m[1].OrbitControls)}).catch(bad)}catch(e){bad()}})();`;
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">' +
    '<title>💗</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@600;700;800&family=Pacifico&family=Dancing+Script:wght@600;700&display=swap&subset=vietnamese" rel="stylesheet">' +
    '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>' +
    '<style>html,body{margin:0;height:100%;background:#000}</style></head><body><script>' + loader + '</script></body></html>';
}

module.exports = { packPage, merge };
