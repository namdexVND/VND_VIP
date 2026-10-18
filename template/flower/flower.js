(function (CFG) {
'use strict';
/* ===== Thiệp hoa: toàn bộ nội dung lấy từ CFG ===== */

/* Trời đêm: sao nhấp nháy, sao băng, đom đóm bay lên */
(function () {
  var cv = document.getElementById('sky');
  var cx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  var stars = [], flies = [], shoots = [];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build() {
    var n = Math.round(Math.min(260, Math.max(90, W * H / 6500)));
    var tints = ['255,255,255', '255,255,255', '200,225,255', '255,220,235', '255,245,200'];
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.pow(Math.random(), 1.25) * H * 0.88,
        r: Math.random() < 0.08 ? rnd(1.3, 2.1) : rnd(0.3, 1.2),
        a: rnd(0.35, 1),
        sp: rnd(0.6, 2.4),
        ph: rnd(0, 6.283),
        c: tints[(Math.random() * tints.length) | 0]
      });
    }
    var m = Math.round(Math.min(46, Math.max(18, W / 32)));
    flies = [];
    for (var j = 0; j < m; j++) flies.push(newFly(true));
  }

  function newFly(init) {
    var cols = ['255,251,0', '35,240,255', '255,140,215', '170,255,238'];
    return {
      x: Math.random() * W,
      y: init ? Math.random() * H : H + 10,
      r: rnd(1, 2.6),
      vy: rnd(0.12, 0.45),
      sw: rnd(8, 28),
      sp: rnd(0.4, 1.3),
      ph: rnd(0, 6.283),
      c: cols[(Math.random() * cols.length) | 0],
      a: rnd(0.4, 0.95)
    };
  }

  function spawnShoot() {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var sp = rnd(9, 15);
    shoots.push({
      x: dir > 0 ? rnd(0, W * 0.6) : rnd(W * 0.4, W),
      y: rnd(0, H * 0.35),
      vx: sp * dir,
      vy: sp * rnd(0.35, 0.6),
      len: rnd(90, 170),
      life: 0,
      max: rnd(45, 75)
    });
  }

  var nextShoot = 1200;
  var last = performance.now();

  function frame(now) {
    var dt = now - last; last = now;
    var t = now / 1000;
    cx.clearRect(0, 0, W, H);

    /* sao nhấp nháy */
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = reduce ? 0.8 : 0.45 + 0.55 * Math.sin(t * s.sp + s.ph);
      var al = s.a * tw;
      cx.fillStyle = 'rgba(' + s.c + ',' + al.toFixed(3) + ')';
      cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.2832); cx.fill();
      if (s.r > 1.3) {
        cx.strokeStyle = 'rgba(' + s.c + ',' + (al * 0.55).toFixed(3) + ')';
        cx.lineWidth = 0.6;
        var L = s.r * 4.2 * tw;
        cx.beginPath();
        cx.moveTo(s.x - L, s.y); cx.lineTo(s.x + L, s.y);
        cx.moveTo(s.x, s.y - L); cx.lineTo(s.x, s.y + L);
        cx.stroke();
      }
    }

    /* đom đóm bay lên */
    for (var k = 0; k < flies.length; k++) {
      var f = flies[k];
      f.y -= f.vy * (dt / 16.7);
      var x = f.x + Math.sin(t * f.sp + f.ph) * f.sw;
      if (f.y < -10) flies[k] = newFly(false);
      var pul = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * 2.2 + f.ph);
      var a = f.a * pul;
      cx.fillStyle = 'rgba(' + f.c + ',' + (a * 0.18).toFixed(3) + ')';
      cx.beginPath(); cx.arc(x, f.y, f.r * 4.2, 0, 6.2832); cx.fill();
      cx.fillStyle = 'rgba(' + f.c + ',' + a.toFixed(3) + ')';
      cx.beginPath(); cx.arc(x, f.y, f.r, 0, 6.2832); cx.fill();
    }

    /* sao băng */
    if (!reduce) {
      nextShoot -= dt;
      if (nextShoot <= 0) { spawnShoot(); nextShoot = rnd(2200, 6000); }
    }
    for (var q = shoots.length - 1; q >= 0; q--) {
      var p = shoots[q];
      var step = dt / 16.7;
      p.x += p.vx * step; p.y += p.vy * step; p.life += step;
      var fade = 1 - p.life / p.max;
      if (fade <= 0 || p.x < -200 || p.x > W + 200 || p.y > H) { shoots.splice(q, 1); continue; }
      var mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      var tx = p.x - p.vx / mag * p.len, ty = p.y - p.vy / mag * p.len;
      var g = cx.createLinearGradient(p.x, p.y, tx, ty);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.95 * fade).toFixed(3) + ')');
      g.addColorStop(0.3, 'rgba(160,230,255,' + (0.45 * fade).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(160,230,255,0)');
      cx.strokeStyle = g; cx.lineWidth = 2; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(tx, ty); cx.stroke();
      cx.fillStyle = 'rgba(255,255,255,' + fade.toFixed(3) + ')';
      cx.beginPath(); cx.arc(p.x, p.y, 1.8, 0, 6.2832); cx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();


/* Thay cho main.js: bỏ class "not-loaded" để các animation bắt đầu chạy */
(function () {
  function start() {
    setTimeout(function () { document.body.classList.remove('not-loaded'); }, 1000);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();



/* ===== Hiệu ứng hạt: sao, tim, cánh hoa ===== */
(function () {
  var cv = document.getElementById('fx'), cx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, P = [], running = false, rain = false, rainT = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLS = ['35,240,255', '255,140,215', '167,255,238', '255,251,0', '255,255,255', '190,150,255'];
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  function star(s) { cx.beginPath(); cx.moveTo(0, -s); cx.quadraticCurveTo(0, 0, s, 0); cx.quadraticCurveTo(0, 0, 0, s); cx.quadraticCurveTo(0, 0, -s, 0); cx.quadraticCurveTo(0, 0, 0, -s); cx.fill(); }
  function heart(s) { cx.beginPath(); cx.moveTo(0, s * .45); cx.bezierCurveTo(-s * 1.1, -s * .2, -s * .55, -s * 1, 0, -s * .4); cx.bezierCurveTo(s * .55, -s * 1, s * 1.1, -s * .2, 0, s * .45); cx.fill(); }
  function petal(s) { cx.beginPath(); cx.ellipse(0, 0, s * .42, s, 0, 0, 6.2832); cx.fill(); }

  function burst(x, y, n, o) {
    if (reduce) n = Math.ceil(n / 3);
    o = o || {};
    var kinds = o.kinds || ['star', 'star', 'dot', 'petal'];
    for (var i = 0; i < n; i++) {
      var a = rnd(0, 6.2832), sp = rnd(o.min || 2, o.max || 7);
      P.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
        g: o.g == null ? .12 : o.g, s: rnd(o.smin || 4, o.smax || 10), rot: rnd(0, 6.28), vr: rnd(-.12, .12),
        life: 0, max: rnd(50, 100), c: pick(o.cols || COLS), k: pick(kinds), sw: 0, ph: 0
      });
    }
    kick();
  }

  function spawnRain() {
    P.push({
      x: rnd(0, W), y: -14, vx: rnd(-.3, .3), vy: rnd(.9, 2), g: 0, s: rnd(6, 12), rot: rnd(0, 6.28), vr: rnd(-.04, .04),
      life: 0, max: 9999, c: pick(['255,140,215', '167,255,238', '255,255,255', '35,240,255']),
      k: Math.random() < .25 ? 'heart' : 'petal', sw: rnd(.6, 1.6), ph: rnd(0, 6.28), rainy: 1
    });
  }

  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  var last = 0;
  function loop(now) {
    var dt = Math.min(now - last, 50) / 16.7; last = now;
    cx.clearRect(0, 0, W, H);
    cx.globalCompositeOperation = 'lighter';
    if (rain && !reduce) { rainT -= dt; if (rainT <= 0) { spawnRain(); rainT = rnd(10, 18); } }
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i];
      p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.rainy) { p.x += Math.sin(p.life * .05 * p.sw + p.ph) * .8; if (!rain && p.life > 1) p.max = Math.min(p.max, p.life + 40); }
      else { p.vx *= .985; }
      var f = p.rainy ? (p.life > p.max - 40 ? (p.max - p.life) / 40 : 1) : 1 - p.life / p.max;
      if (f <= 0 || p.y > H + 30) { P.splice(i, 1); continue; }
      var al = Math.max(0, f) * (p.rainy ? .85 : 1);
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
      cx.fillStyle = 'rgba(' + p.c + ',' + (al * .22).toFixed(3) + ')';
      cx.beginPath(); cx.arc(0, 0, p.s * 1.9, 0, 6.2832); cx.fill();
      cx.fillStyle = 'rgba(' + p.c + ',' + al.toFixed(3) + ')';
      if (p.k === 'star') star(p.s); else if (p.k === 'heart') heart(p.s); else if (p.k === 'petal') petal(p.s);
      else { cx.beginPath(); cx.arc(0, 0, p.s * .35, 0, 6.2832); cx.fill(); }
      cx.restore();
    }
    cx.globalCompositeOperation = 'source-over';
    if (P.length || rain) requestAnimationFrame(loop); else running = false;
  }

  window.FX = {
    burst: burst,
    rain: function (on) { rain = on; if (on) kick(); }
  };
})();




(function () {
  var $ = function (id) { return document.getElementById(id); };
  var env = $('env'), wrap = $('envWrap'), card = $('card'), msg = $('cardMsg'), from = $('cardFrom');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TEXT = CFG.message;
  var SPEED = CFG.speed; /* ms giữa hai ký tự */
  var HOLD = CFG.hold * 1000; /* chờ sau khi chữ chạy xong rồi tự ẩn thiệp */
  $('cTag').textContent = CFG.tag; $('cTitle').textContent = CFG.title; $('cSub').textContent = CFG.sub;
  $('envHint').textContent = CFG.hint; from.textContent = CFG.from;
  var audio = null;
  function playMusic() {
    if (!CFG.music || audio) return;
    try { audio = new Audio(CFG.music); audio.loop = true; audio.volume = .7; var p = audio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  var timer = null, openT = null, hideT = null, endT = null, raf = 0, shown = false;

  /* Chữ hiện mượt: toàn bộ chữ đã nằm sẵn đúng chỗ, từng ký tự mờ hiện lên bằng CSS (GPU), không đổi layout nên không giật */
  function buildText() {
    msg.textContent = '';
    var words = TEXT.split(' '), idx = 0, frag = document.createDocumentFragment();
    words.forEach(function (w, wi) {
      var ws = document.createElement('span'); ws.className = 'w';
      Array.from(w).forEach(function (ch) {
        var c = document.createElement('span'); c.className = 'ch'; c.textContent = ch;
        c.style.animationDelay = (idx * SPEED) + 'ms'; idx++; ws.appendChild(c);
      });
      frag.appendChild(ws);
      if (wi < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    msg.appendChild(frag);
    return idx;
  }

  function typeText() {
    clearTimeout(endT); cancelAnimationFrame(raf);
    from.classList.remove('on'); msg.classList.remove('run');
    var n = buildText(), chars = msg.querySelectorAll('.ch');
    void msg.offsetWidth;
    msg.classList.add('run');
    var t0 = performance.now(), last = -1;
    if (!reduce) (function tick(now) {
      var i = Math.min(chars.length - 1, Math.floor((now - t0) / SPEED));
      if (i !== last && i % 5 === 0) {
        var r = chars[i].getBoundingClientRect();
        FX.burst(r.left + r.width / 2, r.top + r.height / 2, 1, { min: .3, max: 1.1, g: -.01, smin: 3, smax: 6, kinds: ['star'] });
      }
      last = i;
      if (now - t0 < n * SPEED) raf = requestAnimationFrame(tick);
    })(t0);
    endT = setTimeout(function () {
      from.classList.add('on');
      var b = from.getBoundingClientRect();
      FX.burst(b.left + b.width / 2, b.top + b.height / 2, 18, { kinds: ['heart', 'star'], min: 1.5, max: 4.5, up: 1 });
      hideT = setTimeout(closeCard, HOLD);
    }, reduce ? 300 : n * SPEED + 950);
  }

  function openCard() {
    if (shown) return; shown = true;
    playMusic();
    var r = env.getBoundingClientRect();
    env.classList.add('opening');
    FX.burst(r.left + r.width / 2, r.top + r.height * .6, 40, { min: 2, max: 8, up: 2 });
    openT = setTimeout(function () {
      env.classList.add('gone'); wrap.classList.add('gone');
      card.classList.add('show');
      var c = card.getBoundingClientRect();
      FX.burst(c.left + c.width / 2, c.top + c.height / 2, 44, { min: 2, max: 8, kinds: ['star', 'heart', 'petal', 'dot'] });
      FX.rain(true);
      setTimeout(function () { if (shown) typeText(); }, 1000);
    }, 750);
  }

  function closeCard() {
    if (!shown) return; shown = false;
    clearTimeout(openT); clearTimeout(hideT); clearTimeout(endT); cancelAnimationFrame(raf);
    card.classList.remove('show'); FX.rain(false);
    /* ẩn hẳn: không hiện lại phong bì hay thiệp — thay bằng ảnh bay lên */
    startPhotos();
  }


  /* ===== Ảnh khung đẹp bay lên liên tục ===== */
  var PHOTOS = CFG.photos; /* [{src, caption}] */
  var CAPTIONS = CFG.captions;
  var SPAWN_MS = 1700, MAX_PHOTOS = 9;

  var layer = $('photos'), dim = $('photoDim');
  var pi = 0, heldEl = null, photosOn = false, loopOn = false, lastT = 0, list = [];
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  function placeholder(i) {
    var h = [190, 330, 45, 270, 150][i % 5], pet = '';
    for (var k = 0; k < 8; k++) pet += '<ellipse cx="0" cy="-30" rx="11" ry="26" transform="rotate(' + k * 45 + ')"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ',80%,62%)"/><stop offset="1" stop-color="hsl(' + ((h + 60) % 360) + ',75%,36%)"/></linearGradient></defs>' +
      '<rect width="240" height="300" fill="url(#g)"/><g transform="translate(120 128)" fill="#fff" fill-opacity=".8">' + pet +
      '<circle r="12" fill="#ffd54a" fill-opacity="1"/></g><text x="120" y="258" font-size="17" text-anchor="middle" fill="#fff" fill-opacity=".92" font-family="sans-serif">Ảnh của bạn</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function nextPhoto() {
    var i = pi++, it = PHOTOS.length ? PHOTOS[i % PHOTOS.length] : null;
    var src = it ? (typeof it === 'string' ? it : it.src) : placeholder(i);
    var cap = (it && typeof it === 'object' && it.caption) ? it.caption : CAPTIONS[i % CAPTIONS.length];
    return { src: src, cap: cap, fallback: placeholder(i) };
  }

  /* Mỗi ảnh có trạng thái riêng (vị trí, vận tốc, độ lắc). Một vòng requestAnimationFrame duy nhất cập nhật tất cả ảnh,
     nên kéo, thả, phóng to rồi bay tiếp đều dùng chung một cơ chế và không bao giờ bị "kẹt". */
  function draw(el) {
    var x = el._bx + Math.sin(el._ph) * el._amp, r = el._tilt + Math.sin(el._ph * 1.3) * 4;
    el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + el._y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg)';
  }

  function kick() { if (!loopOn) { loopOn = true; lastT = performance.now(); requestAnimationFrame(step); } }

  function step(now) {
    var dt = Math.min(now - lastT, 50); lastT = now;
    for (var i = list.length - 1; i >= 0; i--) {
      var el = list[i];
      if (el._drag || el._hold) continue;          /* đang kéo hoặc đang phóng to thì đứng yên */
      el._y -= el._vy * dt; el._ph += el._pv * dt;  /* còn lại thì bay lên tiếp từ chỗ đang đứng */
      if (el._y < -el._h - 60) { el.remove(); list.splice(i, 1); continue; }
      draw(el);
    }
    if (list.length) requestAnimationFrame(step); else loopOn = false;
  }

  function spawnPhoto() {
    if (document.hidden || list.length >= MAX_PHOTOS) return;
    var W = innerWidth, H = innerHeight, d = nextPhoto();
    var el = document.createElement('div');
    el.className = 'ph f' + (1 + ((Math.random() * 3) | 0));
    var w = Math.max(92, Math.min(150, W * .24)) * rnd(.85, 1.15);
    el.style.width = w + 'px';
    var zoom = document.createElement('div'); zoom.className = 'zoom';
    var frm = document.createElement('div'); frm.className = 'frm';
    var img = new Image(); img.alt = ''; img.draggable = false; img.src = d.src;
    img.onerror = function () { img.onerror = null; img.src = d.fallback; };
    var cp = document.createElement('div'); cp.className = 'cap'; cp.textContent = d.cap;
    frm.appendChild(img); frm.appendChild(cp); zoom.appendChild(frm); el.appendChild(zoom);
    el._zoom = zoom;
    layer.appendChild(el);
    el._w = w; el._h = el.offsetHeight || w * 1.4;
    el._bx = rnd(8, Math.max(9, W - w - 8)); el._y = H + 40;
    el._vy = rnd(.05, .07); el._amp = rnd(14, 30); el._ph = rnd(0, 6.28); el._pv = rnd(.0008, .0013); el._tilt = rnd(-7, 7);
    el._drag = false; el._hold = false;
    list.push(el); draw(el); bindDrag(el); kick();
  }

  /* Chạm = phóng to giữa màn hình · Giữ và kéo = dời ảnh · thả ra thì ảnh bay lên tiếp từ chỗ vừa thả */
  function bindDrag(el) {
    var sx = 0, sy = 0, bx0 = 0, y0 = 0, down = false, moved = false;

    el.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY;
      if (heldEl) return;
      bx0 = el._bx; y0 = el._y; el._drag = true;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });

    el.addEventListener('pointermove', function (e) {
      if (!down || heldEl) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved) {
        if (dx * dx + dy * dy < 49) return;
        moved = true; el.classList.add('drag');
        el._zoom.style.transition = 'scale .25s'; el._zoom.style.scale = 1.1;
      }
      var s = Math.sin(el._ph) * el._amp;
      var cx = Math.max(30, Math.min(innerWidth - 30, bx0 + s + el._w / 2 + dx));
      var cy = Math.max(30, Math.min(innerHeight - 30, y0 + el._h / 2 + dy));
      el._bx = cx - el._w / 2 - s; el._y = cy - el._h / 2;
      draw(el);
    });

    function endDrag() {
      el.classList.remove('drag');
      el._zoom.style.transition = ''; el._zoom.style.scale = 1;
      el._drag = false;
    }

    el.addEventListener('pointerup', function (e) {
      if (!down) return; down = false;
      if (heldEl === el) { release(); return; }
      if (heldEl) return;
      if (!moved) { el._drag = false; hold(el); return; }
      endDrag();                                    /* thả ra: ảnh bay lên tiếp */
      FX.burst(e.clientX, e.clientY, 14, { kinds: ['star', 'heart'], min: 1, max: 5, smin: 3, smax: 8, g: .06 });
    });

    function cancel() { if (!down) return; down = false; endDrag(); }
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
  }

  function hold(el) {
    if (heldEl) return; heldEl = el; el._hold = true;
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var th = (el._tilt + Math.sin(el._ph * 1.3) * 4), rad = th * Math.PI / 180;
    var dx = innerWidth / 2 - cx, dy = innerHeight / 2 - cy;
    var lx = dx * Math.cos(rad) + dy * Math.sin(rad), ly = -dx * Math.sin(rad) + dy * Math.cos(rad); /* đổi sang hệ toạ độ đã xoay của ảnh */
    var sc = Math.min(2.6, innerWidth * .78 / el._w, innerHeight * .7 / el._h);
    el.classList.add('held'); dim.classList.add('on');
    var z = el._zoom; z.style.transition = '';
    z.style.translate = lx + 'px ' + ly + 'px'; z.style.rotate = (-th) + 'deg'; z.style.scale = sc;
    FX.burst(innerWidth / 2, innerHeight / 2, 36, { kinds: ['heart', 'star', 'petal'], cols: ['255,90,170', '255,140,215', '35,240,255', '255,255,255'], min: 2, max: 8, up: 2 });
  }

  function release() {
    if (!heldEl) return;
    var el = heldEl; heldEl = null;
    var z = el._zoom; z.style.translate = '0px 0px'; z.style.rotate = '0deg'; z.style.scale = 1;
    el.classList.remove('held'); dim.classList.remove('on');
    setTimeout(function () { el._hold = false; }, 750);  /* thu về xong thì bay lên tiếp */
  }
  dim.addEventListener('click', release);

  function startPhotos() {
    if (photosOn) return; photosOn = true;
    spawnPhoto();
    setInterval(spawnPhoto, SPAWN_MS);
  }

  env.addEventListener('click', openCard);
  $('cardClose').addEventListener('click', closeCard);
  addEventListener('keydown', function (e) { if (e.key === 'Escape') { release(); closeCard(); } });

  addEventListener('pointerdown', function (e) {
    var r = document.createElement('div'); r.className = 'rip';
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r); setTimeout(function () { r.remove(); }, 900);
    FX.burst(e.clientX, e.clientY, 9, { min: 1, max: 4.5, smin: 3, smax: 7, g: .06 });
  });

  /* Đợi hoa nở hết (~6,5 giây sau khi tải xong) rồi mới hiện phong bì */
  function start() { setTimeout(function () { wrap.classList.add('ready'); }, 6500); }
  if (document.readyState === 'complete') start(); else addEventListener('load', start);
})();

})