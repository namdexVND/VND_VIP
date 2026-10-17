// POST /api/charge  — web gọi để gửi thẻ cào. Body JSON: { telco, amount, serial, code }
const { db, md5, PARTNER_ID, PARTNER_KEY, ENDPOINT, cors, uidFrom, settle } = require("./_lib");

const TELCO = { viettel: "VIETTEL", mobifone: "MOBIFONE", vinaphone: "VINAPHONE", vietnamobile: "VNMOBI", garena: "GARENA", zing: "ZING" };
const AMOUNTS = [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  try {
    if (!PARTNER_ID || !PARTNER_KEY) throw { status: 500, message: "Server chưa cấu hình PARTNER_ID / PARTNER_KEY" };
    const uid = await uidFrom(req);
    const b = req.body || {};
    const net = String(b.telco || "");
    const telco = TELCO[net.toLowerCase()];
    const amount = Number(b.amount);
    const serial = String(b.serial || "").trim();
    const code = String(b.code || "").trim();
    if (!telco) throw { status: 400, message: "Loại thẻ không hợp lệ" };
    if (!AMOUNTS.includes(amount)) throw { status: 400, message: "Mệnh giá không hợp lệ" };
    if (!/^[A-Za-z0-9]{8,25}$/.test(serial) || !/^[A-Za-z0-9]{8,25}$/.test(code)) throw { status: 400, message: "Seri hoặc mã thẻ không hợp lệ" };

    // Chặn gửi trùng thẻ và spam nhiều thẻ chờ cùng lúc
    const dup = await db.collection("cards").where("serial", "==", serial).limit(5).get();
    if (dup.docs.some((d) => d.data().state !== "failed")) throw { status: 400, message: "Thẻ này đã được gửi trước đó" };
    const pend = await db.collection("cards").where("uid", "==", uid).where("state", "==", "pending").limit(5).get();
    if (pend.size >= 5) throw { status: 429, message: "Bạn có quá nhiều thẻ đang chờ xử lý" };

    const request_id = "C" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    // Lưu trước khi gửi. KHÔNG lưu mã thẻ (code) vào database.
    await db.collection("cards").doc(request_id).set({ uid, telco: net, amount, serial, state: "pending", ts: Date.now() });

    let j;
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          telco, code, serial, amount: String(amount), request_id,
          partner_id: PARTNER_ID, command: "charging", sign: md5(PARTNER_KEY + code + serial),
        }),
      });
      j = await r.json();
    } catch (e) {
      await settle(request_id, 100, { message: "Không kết nối được hệ thống thẻ" });
      throw { status: 502, message: "Không kết nối được hệ thống thẻ, thử lại sau" };
    }

    const st = Number(j.status);
    if (st === 99) return res.json({ ok: true, request_id, state: "pending" });          // chờ callback
    if (st === 1 || st === 2 || st === 3) {                                                // có kết quả ngay
      const d = await settle(request_id, st, { value: j.value, message: j.message });
      return res.json({ ok: true, request_id, state: d ? d.state : "pending" });
    }
    await settle(request_id, st || 100, { message: j.message });                           // 100, 4... = gửi thất bại
    throw { status: 400, message: j.message || "Gửi thẻ thất bại" };
  } catch (e) {
    if (!e.status) console.error("charge error:", e && e.message);
    res.status(e.status || 500).json({ ok: false, message: e.message || "Lỗi server" });
  }
};
