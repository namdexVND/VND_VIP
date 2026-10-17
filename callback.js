// GET/POST /api/callback — gachthe47 gọi về khi có kết quả thẻ.
// Điền đúng URL này vào mục "Đường dẫn nhận dữ liệu (Callback Url)": https://vndvip.vercel.app/api/callback
const { md5, PARTNER_KEY, settle } = require("./_lib");

module.exports = async (req, res) => {
  const q = { ...(req.query || {}), ...(req.body && typeof req.body === "object" ? req.body : {}) };
  const { status, message, request_id, value, code, serial, callback_sign } = q;
  if (!request_id || !code || !serial || !callback_sign) return res.status(400).send("missing params");
  // Xác thực chữ ký: chỉ nhà cung cấp biết PARTNER_KEY mới tạo được chữ ký đúng
  if (String(callback_sign) !== md5(PARTNER_KEY + code + serial)) return res.status(403).send("bad sign");
  try {
    await settle(String(request_id), Number(status), { value, message, serial });
    res.status(200).send("OK");
  } catch (e) {
    console.error("callback error:", e && e.message);
    res.status(500).send("error"); // trả lỗi để nhà cung cấp gọi lại
  }
};
