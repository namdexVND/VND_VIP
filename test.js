// node test.js — chạy thử cục bộ, không cần Vercel
const create = require('./api/create'), view = require('./api/view');
const mk = (extra = {}) => { const r = { h: {}, code: 200, body: null,
  setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
  json(o) { this.body = o; return this; }, send(s) { this.body = s; return this; } }; return Object.assign(r, extra); };
(async () => {
  const a = mk();
  await create({ method: 'POST', headers: { host: 'x.vercel.app', origin: 'https://x.vercel.app' },
    body: { title: 'Gửi mẹ!', message: 'Chúc mẹ 20/10 vui vẻ </script><b>', sign: 'Con', musicUrl: 'https://a.com/b.mp3',
      photos: [{ src: 'https://a.com/1.jpg', caption: 'Tết' }, { src: 'javascript:alert(1)' }] } }, a);
  console.log('create', a.code, a.body);
  const v = mk();
  await view({ query: { id: a.body.id } }, v);
  console.log('view', v.code, v.body.length, 'bytes; chứa "Chúc mẹ"?', v.body.includes('Chúc mẹ'), '| chứa "CONFIG"?', v.body.includes('CONFIG'));
  // giải mã thử để kiểm tra đúng logic
  const m = v.body.match(/<script>(.*)<\/script>/s)[1];
  const { JSDOM } = (() => { try { return require('jsdom'); } catch { return {}; } })();
  console.log('jsdom', JSDOM ? 'có' : 'không có (bỏ qua chạy thử DOM)');
  const nf = mk(); await view({ query: { id: 'zzzzzzzz' } }, nf); console.log('404', nf.code);
})();
