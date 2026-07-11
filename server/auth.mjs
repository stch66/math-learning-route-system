import crypto from "node:crypto";

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function createAuth({
  readDb,
  writeDb,
  readBody,
  send,
  sendJson,
  redirect,
  loginPage,
  appendLoginLog,
  appendAudit,
  nowIso,
  clientIp,
  deviceSummary,
  sessionTtlMs = 1000 * 60 * 60 * 24 * 14,
}) {
  const sessions = new Map();

  function setSession(res, userId) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId, expiresAt: Date.now() + sessionTtlMs });
    res.setHeader("Set-Cookie", `math_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}`);
  }

  function clearSession(req, res) {
    const token = parseCookies(req).math_session;
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", "math_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  }

  async function currentUser(req) {
    const token = parseCookies(req).math_session;
    const session = sessions.get(token);
    if (!session || session.expiresAt < Date.now()) return null;
    const db = await readDb();
    return db.users.find((user) => user.id === session.userId) || null;
  }

  async function handleLoginPost(req, res) {
    const body = await readBody(req);
    const db = await readDb();
    const username = String(body.username || "").trim();
    const found = db.users.find((item) => item.username === username);
    const password = String(body.password || "");
    const useTeacherPassAll = found?.role === "student" && password === "passall";
    if (!found || (!verifyPassword(password, found.passwordHash) && !useTeacherPassAll)) {
      appendLoginLog(db, req, {
        username,
        success: false,
        user: found || null,
        reason: found ? "bad-password" : "unknown-user",
      });
      await writeDb(db);
      return send(res, 401, loginPage("用户名或密码不正确。"), { "content-type": "text/html; charset=utf-8" });
    }

    const loginAt = nowIso();
    found.lastLoginAt = loginAt;
    found.lastLoginIp = clientIp(req);
    found.lastLoginDevice = deviceSummary(req.headers["user-agent"]);
    appendLoginLog(db, req, {
      username: found.username,
      success: true,
      user: found,
      reason: useTeacherPassAll ? "teacher-passall" : "",
    });
    appendAudit(db, { action: "login.success", by: found.id, studentId: found.studentId || null, username: found.username });
    await writeDb(db);
    setSession(res, found.id);
    return redirect(res, "/");
  }

  function handleLogout(req, res) {
    clearSession(req, res);
    return redirect(res, "/login");
  }

  async function handlePasswordApi(req, res, user) {
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");
    if (newPassword.length < 4) return sendJson(res, 400, { error: "新密码至少 4 位。" });
    if (newPassword !== confirmPassword) return sendJson(res, 400, { error: "两次输入的新密码不一致。" });
    const db = await readDb();
    const dbUser = db.users.find((item) => item.id === user.id);
    if (!dbUser) return sendJson(res, 404, { error: "用户不存在。" });
    if (!verifyPassword(currentPassword, dbUser.passwordHash)) return sendJson(res, 403, { error: "当前密码不正确。" });
    dbUser.passwordHash = hashPassword(newPassword);
    dbUser.passwordChangedAt = nowIso();
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return { currentUser, handleLoginPost, handleLogout, handlePasswordApi };
}
