// GET /api/cards — web hỏi kết quả các thẻ đã gửi của người dùng đang đăng nhập
const { db, cors, uidFrom } = require("./_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const uid = await uidFrom(req);
    const snap = await db.collection("cards").where("uid", "==", uid).get();
    const cards = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 30)
      .map((c) => ({ id: c.id, state: c.state, telco: c.telco, amount: c.amount, value: c.value || 0, credited: c.credited || 0, message: c.message || "" }));
    res.json({ ok: true, cards });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, message: e.message || "Lỗi server" });
  }
};
