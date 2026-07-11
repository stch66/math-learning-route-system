import crypto from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim()
    .replace(/^::ffff:/, "");
}

export function deviceSummary(userAgent = "") {
  const ua = String(userAgent || "");
  if (/curl/i.test(ua)) return "server-test/curl";
  if (/MicroMessenger/i.test(ua) && /iPhone/i.test(ua)) return "iPhone WeChat";
  if (/MicroMessenger/i.test(ua) && /iPad/i.test(ua)) return "iPad WeChat";
  if (/MicroMessenger/i.test(ua) && /Macintosh|Mac OS/i.test(ua)) return "Mac WeChat";
  if (/MicroMessenger/i.test(ua) && /Android|Linux/i.test(ua)) return "Android WeChat";
  if (/MiuiBrowser/i.test(ua)) return "Xiaomi Browser";
  if (/Safari/i.test(ua) && /Macintosh/i.test(ua)) return "Mac Safari";
  if (/Chrome/i.test(ua)) return "Chrome";
  return ua.slice(0, 120) || "unknown";
}

export function appendLoginLog(db, req, entry) {
  db.loginLog ||= [];
  db.loginLog.push({
    id: crypto.randomBytes(8).toString("hex"),
    at: nowIso(),
    username: String(entry.username || ""),
    success: Boolean(entry.success),
    userId: entry.user?.id || null,
    role: entry.user?.role || null,
    studentId: entry.user?.studentId || null,
    displayName: entry.user?.displayName || null,
    ip: clientIp(req),
    device: deviceSummary(req.headers["user-agent"]),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    reason: entry.reason || "",
  });
  if (db.loginLog.length > 5000) db.loginLog = db.loginLog.slice(-5000);
}

export function handleLoginLogApi(req, res, db, user, sendJson) {
  if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以查看登录日志。" });
  const url = new URL(req.url, "http://localhost");
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 300)));
  const username = String(url.searchParams.get("username") || "").trim().toLowerCase();
  const logs = (db.loginLog || [])
    .filter((item) => !username || String(item.username || "").toLowerCase() === username)
    .slice(-limit)
    .reverse();
  return sendJson(res, 200, { logs });
}
