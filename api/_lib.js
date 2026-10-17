// Dùng chung cho các API. File bắt đầu bằng "_" sẽ KHÔNG bị Vercel coi là một endpoint.
const crypto = require("crypto");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const PARTNER_ID = process.env.PARTNER_ID;
const PARTNER_KEY = process.env.PARTNER_KEY;
const ENDPOINT = process.env.CARD_ENDPOINT || "https://gachthe47.com/chargingws/v2";
const FEE = process.env.CARD_FEE ? Number(process.env.CARD_FEE) : 0.2; // phải khớp CARD_FEE trong index.html

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

// Lấy uid từ Firebase ID token gửi lên trong header Authorization: Bearer <token>
async function uidFrom(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) throw { status: 401, message: "Bạn chưa đăng nhập" };
  try {
    return (await admin.auth().verifyIdToken(m[1])).uid;
  } catch (e) {
    throw { status: 401, message: "Phiên đăng nhập hết hạn, hãy đăng nhập lại" };
  }
}

// Chốt kết quả thẻ. Chỉ chạy được 1 lần cho mỗi thẻ (state "pending" → "ok"/"failed"),
// nên callback gọi lại nhiều lần cũng không bị cộng tiền 2 lần.
async function settle(rid, status, info = {}) {
  const ref = db.collection("cards").doc(rid);
  return db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) return null;
    const d = s.data();
    if (d.state !== "pending") return d;
    if (info.serial && String(info.serial) !== d.serial) return d; // serial không khớp → bỏ qua
    let upd;
    if (status === 1 || status === 2) {
      // 1 = đúng mệnh giá, 2 = sai mệnh giá (value là mệnh giá thật)
      const value = Number(info.value) || (status === 1 ? d.amount : 0);
      upd = { state: "ok", pstatus: status, value, credited: Math.floor(value * (1 - FEE)), message: info.message || "" };
    } else if (status === 99) {
      upd = { pstatus: 99 }; // vẫn chờ xử lý
    } else {
      upd = { state: "failed", pstatus: status, message: info.message || "Thẻ lỗi" };
    }
    t.update(ref, upd);
    return { ...d, ...upd };
  });
}

module.exports = { db, md5, PARTNER_ID, PARTNER_KEY, ENDPOINT, FEE, cors, uidFrom, settle };
