'use strict';
const store = require('../lib/store');
const { packPage } = require('../lib/render');

const NOT_FOUND = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Không tìm thấy</title><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#fbd9de;color:#5a1f33;font:600 18px system-ui;text-align:center;padding:24px">Link này không tồn tại hoặc đã hết hạn 💔</body>';

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!/^[0-9A-Za-z]{6,16}$/.test(id)) return res.status(404).send(NOT_FOUND);
  try {
    const cfg = await store.load(id);
    if (!cfg) return res.status(404).send(NOT_FOUND);
    res.status(200).send(packPage(cfg));
  } catch (e) {
    res.status(500).send(NOT_FOUND);
  }
};
