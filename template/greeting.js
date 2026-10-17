/*CONFIG*/

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* nền: lấp lánh + cánh hoa (tạo 1 lần, thuần CSS) */
(() => {
  const fx = $('#fx'), r = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span'); s.className = 'spark';
    const z = r(2, 5);
    s.style.cssText = `left:${r(0,100)}%;top:${r(0,100)}%;width:${z}px;height:${z}px;--t:${r(2,5)}s;--d:${r(0,4)}s`;
    fx.appendChild(s);
  }
  const icons = ['🌸', '💗', '🌷', '🌹'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span'); p.className = 'petal';
    p.textContent = icons[i % icons.length];
    p.style.cssText = `left:${r(0,100)}%;font-size:${r(12,22)}px;--t:${r(9,16)}s;--d:-${r(0,14)}s;--dx:${r(-80,80)}px`;
    fx.appendChild(p);
  }
})();

/* màn 1: bông hồng */
setTimeout(() => $('#hint').classList.add('show'), 4200);
$('#rose').addEventListener('click', () => {
  const v = $('#roseView'), rr = $('#rose').getBoundingClientRect();
  for (let i = 0; i < 6; i++) setTimeout(() => bloom(rr.left + rr.width * rnd(.25, .75), rr.top + rr.height * rnd(.05, .55), rnd(1, 1.6)), i * 120);
  Music.start(); Photos.start();
  v.classList.add('hide');
  $('#castle').classList.add('show');
  setTimeout(() => v.hidden = true, 600);
});

/* màn 2: phong bì — chạm lần 1 mở, chạm lần 2 đọc thư (chạy cả trên điện thoại) */
const env = $('#env');
function envClick() {
  if (!env.classList.contains('open')) {
    env.classList.add('open');
    $('#tip').textContent = 'Chạm vào lá thư để đọc';
  } else openLetter();
}
env.addEventListener('click', envClick);
env.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); envClick(); } });

/* lá thư: gõ chữ, hủy được khi đóng (không bị chồng timer) */
let run = 0;
const overlay = $('#overlay'), h = $('#lt-title'), p = $('#lt-body'), sg = $('#lt-sign');
async function type(el, text, speed, id) {
  el.textContent = ''; el.classList.add('typing');
  for (const ch of Array.from(text)) {          // Array.from: không cắt đôi emoji
    if (id !== run) return false;
    el.textContent += ch;
    await sleep(speed);
  }
  el.classList.remove('typing');
  return true;
}
async function openLetter() {
  const id = ++run;
  h.textContent = ''; p.textContent = ''; sg.textContent = '';
  h.classList.remove('typing'); p.classList.remove('typing'); sg.classList.remove('typing');
  overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false');
  $('#close').focus({ preventScroll: true });
  if (await type(h, CONFIG.title, 130, id)) { await sleep(500); if (await type(p, CONFIG.message, 75, id) && CONFIG.sign) { await sleep(400); await type(sg, CONFIG.sign, 110, id); } }
}
function closeLetter() {
  run++;
  overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true');
  h.classList.remove('typing'); p.classList.remove('typing'); sg.classList.remove('typing');
  env.focus({ preventScroll: true });
}
$('#close').addEventListener('click', closeLetter);
overlay.addEventListener('click', e => { if (e.target === overlay) closeLetter(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeLetter(); });

/* ===== tiện ích ===== */
const rnd = (a, b) => a + Math.random() * (b - a);

/* ===== 🎵 nhạc nền =====
   musicUrl trống → dùng nhạc hộp tự tạo bằng Web Audio (không cần file).
   Trình duyệt chỉ cho phát nhạc sau khi người dùng chạm, nên nhạc bắt đầu khi chạm bông hồng. */
const Music = (() => {
  let ctx, master, timer = null, step = 0, nextT = 0, on = false, started = false, audio = null;
  const BPM = 76, E = 60 / BPM / 2;                       // độ dài nốt móc đơn
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);       // số MIDI → Hz
  const CH  = [[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]];   // C · Am · F · G
  const ARP = [1,2,3,2,1,3,2,3];
  const MEL = [[76,0,0,79,76,0,72,0],[72,0,0,76,74,0,72,0],[69,0,72,0,77,0,76,0],[74,0,0,79,77,0,74,0]];

  function tone(f, t, dur, vol) {                         // âm sắc hộp nhạc: sine + hoạ âm nhẹ, tắt dần
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o.frequency.value = f; o2.frequency.value = f * 4; g2.gain.value = .12;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
  }
  function sched(s, t) {
    const bar = Math.floor(s / 8) % 4, i = s % 8, c = CH[bar];
    if (i === 0) tone(hz(c[0] - 12), t, 2.4, .09);
    tone(hz(c[ARP[i]]), t, 1.4, .06);
    const m = MEL[bar][i]; if (m) tone(hz(m), t, 1.9, .1);
  }
  const tick = () => { while (nextT < ctx.currentTime + .35) { sched(step++, nextT); nextT += E; } };

  function engineStart() {
    if (CONFIG.musicUrl) {
      audio = audio || Object.assign(new Audio(CONFIG.musicUrl), { loop: true, volume: .55 });
      audio.play().catch(() => { on = false; });
      return;
    }
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = .55;
      const d = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();   // vang nhẹ
      d.delayTime.value = .32; fb.gain.value = .35; lp.type = 'lowpass'; lp.frequency.value = 2400;
      master.connect(ctx.destination); master.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(ctx.destination);
    }
    ctx.resume(); nextT = ctx.currentTime + .08;
    if (!timer) timer = setInterval(tick, 90);
  }
  function engineStop() {
    if (CONFIG.musicUrl) { if (audio) audio.pause(); return; }
    clearInterval(timer); timer = null; if (ctx) ctx.suspend();
  }
  const play = () => { if (on) return; on = true; engineStart(); };

  document.addEventListener('visibilitychange', () => { if (!on) return; document.hidden ? engineStop() : engineStart(); });  // khoá màn hình thì tạm dừng
  return { start() { if (!started) { started = true; play(); } } };   // gọi lần đầu khi chạm bông hồng
})();

/* ===== 📸 ảnh kỷ niệm gia đình (khung polaroid) bay lên liên tục ===== */
const Photos = (() => {
  const box = $('#photos');
  let idx = 0, timer = null;
  const EMO = ['👨‍👩‍👧', '💗', '🌷', '🏡', '🌸', '👩‍👧'];
  const CAP = ['Gia đình mình', 'Yêu mẹ nhiều', 'Kỷ niệm đẹp', 'Nhà có mẹ'];

  function placeholder(n) {
    const d = document.createElement('div'); d.className = 'im ph'; d.textContent = EMO[n % EMO.length]; return d;
  }
  function spawn() {
    if (document.hidden || box.childElementCount >= 8) return;
    const all = CONFIG.photos, it = all.length ? all[idx % all.length] : null;
    const src = it && (typeof it === 'string' ? it : it.src);
    const cap = it ? (typeof it === 'string' ? '' : (it.caption || '')) : CAP[idx % CAP.length];
    const n = idx++, base = Math.min(innerWidth * .26, 150), w = Math.max(76, base * rnd(.75, 1));
    const f = document.createElement('figure'); f.className = 'photo';
    let im;
    if (src) { im = new Image(); im.className = 'im'; im.alt = ''; im.onerror = () => im.replaceWith(placeholder(n)); im.src = src; }
    else im = placeholder(n);
    f.append(im);
    if (cap) { const c = document.createElement('figcaption'); c.textContent = cap; f.append(c); }
    const r0 = rnd(-12, 12);
    f.style.cssText = `--w:${w}px;left:calc((100% - ${w}px) * ${rnd(0, 1).toFixed(2)});--t:${rnd(12, 17).toFixed(1)}s;--dx:${rnd(-40, 40).toFixed(0)}px;--r0:${r0.toFixed(1)}deg;--r1:${(r0 + rnd(-10, 10)).toFixed(1)}deg`;
    f.addEventListener('animationend', () => f.remove());
    box.append(f);
  }
  function start() {
    if (timer) return;
    spawn(); setTimeout(spawn, 700); setTimeout(spawn, 1500);
    timer = setInterval(spawn, 2200);
  }
  return { start };
})();
/* ===== 🌸 bông hoa nở (chỉ khi chạm bông hồng) ===== */
const BLOOM_COLORS = [['#ff9ab5', '#ff5d8f'], ['#ffc2d1', '#f27a9d'], ['#ffd1a9', '#ff8a6b'], ['#e9b8ff', '#c36bff'], ['#fff0a8', '#ffc94d']];
function bloom(x, y, scale) {
  const c = BLOOM_COLORS[Math.floor(Math.random() * BLOOM_COLORS.length)];
  const el = document.createElement('div'); el.className = 'bloom';
  el.style.cssText = `left:${x}px;top:${y}px;--s:${(scale || rnd(.8, 1.3)).toFixed(2)};--a:${c[0]};--b:${c[1]};--spin:${rnd(-40, 40).toFixed(0)}deg`;
  let h = '';
  for (let i = 0; i < 8; i++) h += `<i style="--r:${i * 45}deg;--d:${(i * .05).toFixed(2)}s"></i>`;                    // cánh ngoài
  for (let i = 0; i < 8; i++) h += `<i class="p2" style="--r:${i * 45 + 22.5}deg;--d:${(.25 + i * .04).toFixed(2)}s"></i>`; // cánh trong
  el.innerHTML = h + '<b></b>';
  document.body.append(el);
  const all = document.querySelectorAll('.bloom'); if (all.length > 14) all[0].remove();
  setTimeout(() => el.remove(), 3200);
}
