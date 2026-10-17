/* chặn chuột phải, F12, phím tắt DevTools; phát hiện DevTools mở thì xóa trang */
(function () {
  var d = document;
  function kill() {
    try {
      d.open(); d.write('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#fbd9de;color:#5a1f33;font:600 18px system-ui;text-align:center;padding:24px">Trang này không cho phép xem mã nguồn 💗</body>'); d.close();
    } catch (e) {}
  }
  ['contextmenu', 'dragstart', 'copy', 'cut'].forEach(function (n) {
    d.addEventListener(n, function (e) { e.preventDefault(); }, true);
  });
  addEventListener('keydown', function (e) {
    var c = e.ctrlKey || e.metaKey, k = e.code;
    var bad = e.keyCode === 123 || k === 'F12'
      || (c && e.shiftKey && (k === 'KeyI' || k === 'KeyJ' || k === 'KeyC' || k === 'KeyK'))
      || (c && (k === 'KeyU' || k === 'KeyS'))
      || (e.metaKey && e.altKey && (k === 'KeyI' || k === 'KeyJ' || k === 'KeyU'));
    if (bad) { e.preventDefault(); e.stopPropagation(); return false; }
  }, true);
  /* DevTools đang mở thì lệnh debugger sẽ dừng lại → đo thời gian */
  setInterval(function () {
    var t = performance.now();
    (function () {}).constructor('debugger')();
    if (performance.now() - t > 120) kill();
  }, 1000);
})();
