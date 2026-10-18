// node test.js — chạy thử cục bộ, không cần Vercel
const create = require('./api/galaxy-create'), view = require('./api/galaxy-view');
const upload = require('./api/galaxy-upload');
const mk = (extra = {}) => { const r = { h: {}, code: 200, body: null,
  setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; },
  json(o) { this.body = o; return this; }, send(s) { this.body = s; return this; } }; return Object.assign(r, extra); };

function decode(html) {            // giải mã trang vỏ giống trình duyệt
  const m = html.match(/var a=("[^"]*"),b=("[^"]*"),c=("[^"]*")/);
  const [a, b, c] = [m[1], m[2], m[3]].map(JSON.parse);
  const k = Buffer.from(b.split('').reverse().join('') + c.split('').reverse().join(''), 'base64');
  const r = Buffer.from(a, 'base64'), u = Buffer.alloc(r.length);
  for (let i = 0; i < r.length; i++) u[i] = r[i] ^ k[i % k.length] ^ ((i * 31 + 7) & 255);
  return JSON.parse(u.toString('utf8'));
}

(async () => {
  const a = mk();
  await create({ method: 'POST', headers: { host: 'x.vercel.app', origin: 'https://x.vercel.app' },
    body: { ringTexts: ['TẶNG EM', ''], hintText: 'Chạm đi', texts: { name2: 'Lan', love: 'Yêu em', lover: 'Lan Anh' },
      letter: { title: 'Gửi Lan', text: 'Chúc em 20/10 </script><b>' }, music: 'https://a.com/b.mp3',
      images: ['https://a.com/1.jpg', 'javascript:alert(1)'], nameDelay: 3 } }, a);
  console.log('create', a.code, a.body);
  const v = mk();
  await view({ query: { id: a.body.id } }, v);
  console.log('view', v.code, v.body.length, 'bytes; lộ chữ thư?', v.body.includes('Chúc em'), '| lộ "CONFIG"?', v.body.includes('CONFIG'), '| lộ "contextmenu"?', v.body.includes('contextmenu'));
  const o = decode(v.body);
  const f = new Function(o.j + ';return __w()')();      // chỉ biên dịch, không chạy
  console.log('giải mã OK; có cấu hình:', o.j.includes('"TẶNG EM"') && o.j.includes('Chúc em 20/10'), '| lọc link xấu:', !o.j.includes('javascript:alert'), '| hàm:', typeof f);
  new Function(o.g);                                      // guard biên dịch được
  // upload: ảnh sai định dạng gửi lên phải bị từ chối (không gọi ra ngoài)
  const fake = mk(); await upload({ method: 'POST', headers: { host: 'x' }, body: { image: '<<<không phải base64>>>' } }, fake); console.log('ảnh sai ->', fake.code);
  const bad = mk(); await create({ method: 'POST', headers: { host: 'x' }, body: { letter: { text: '' } } }, bad); console.log('thiếu thư ->', bad.code);
  const nf = mk(); await view({ query: { id: 'zzzzzzzz' } }, nf); console.log('404', nf.code);
})();
