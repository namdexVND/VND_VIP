(function () {
  var T = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  var dbg = console.debug ? console.debug.bind(console) : null;
  ['log', 'info', 'warn', 'error', 'debug', 'table', 'dir', 'trace', 'clear'].forEach(function (k) {
    try { console[k] = function () {}; } catch (e) {}
  });
  function stop(e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    return false;
  }
  function inField(t) { return !!(t && t.closest && t.closest('#wish-input')); }
  document.addEventListener('contextmenu', stop, true);
  ['selectstart', 'dragstart', 'copy', 'cut'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (!inField(e.target)) return stop(e); }, true);
  });
  document.addEventListener('keydown', function (e) {
    var c = e.ctrlKey || e.metaKey;
    var L = /^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : String(e.key || '').toLowerCase();
    if (e.keyCode === 123 || e.key === 'F12') return stop(e);
    if (c && e.shiftKey && 'ijckmne'.indexOf(L) > -1 && L.length === 1) return stop(e);
    if (c && e.altKey && 'ijcu'.indexOf(L) > -1 && L.length === 1) return stop(e);
    if (c && !e.shiftKey && !e.altKey && 'usp'.indexOf(L) > -1 && L.length === 1) return stop(e);
  }, true);
  var st = document.createElement('style');
  st.textContent = 'html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}#wish-input{-webkit-user-select:text;user-select:text}img{-webkit-user-drag:none}';
  document.head.appendChild(st);

  var locked = false, hits = 0, probe = new Image(), seen = false;
  Object.defineProperty(probe, 'id', { get: function () { seen = true; return ''; } });
  function devOpen() {
    var t = performance.now();
    (new Function('debugger'))();
    var slow = performance.now() - t > 120;
    seen = false;
    if (dbg) { dbg(probe); }
    return slow || seen;
  }
  function lock() {
    if (locked) return;
    locked = true;
    document.body.innerHTML = '<div style="position:fixed;inset:0;display:grid;place-items:center;background:#000;color:#ffd6f0;font:16px/1.5 Arial,sans-serif;text-align:center;padding:24px">Vui lòng đóng công cụ dành cho nhà phát triển để tiếp tục 💗</div>';
    setInterval(function () { if (!devOpen()) location.reload(); }, 800);
  }
  setInterval(function () {
    if (locked) return;
    if (devOpen()) { if (++hits >= 2) lock(); } else hits = 0;
  }, 1000);
})();
