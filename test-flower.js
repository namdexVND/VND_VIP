// node test-flower.js — chạy thử cục bộ, không cần Vercel
const create = require('./api/flower-create'), view = require('./api/flower-view');
const mk = () => ({ h: {}, code: 200, body: null, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
  json(o) { this.body = o; return this; }, send(s) { this.body = s; return this; } });
(async () => {
  const a = mk();
  await create({ method: 'POST', headers: { host: 'x.vercel.app', origin: 'https://x.vercel.app' },
    body: { message: 'Chúc cô 20/10 </script><b>x</b> "q"', title: 'Gửi Lan', tag: '20 · 10', photos: ['https://a.com/1.jpg', 'javascript:alert(1)', 'https://a.com/a(1).jpg'], captions: ['A', 'B'], speed: 40, hold: 1 } }, a);
  console.log('create', a.code, a.body);
  const v = mk(); await view({ method: 'GET', query: { id: a.body.id } }, v);
  console.log('view', v.code, v.body.length, 'bytes; photo xấu bị lọc:', !v.body.includes('javascript:alert'), '| </script> không phá trang:', (v.body.match(/<\/script>/g) || []).length === 1);
  require('fs').writeFileSync(process.argv[2] || '/tmp/flower-out.html', v.body);
  const bad = mk(); await create({ method: 'POST', headers: { host: 'x' }, body: { message: '' } }, bad); console.log('thiếu lời chúc ->', bad.code);
  const nf = mk(); await view({ method: 'GET', query: { id: 'zzzzzzzz' } }, nf); console.log('id không có ->', nf.code);
})();
