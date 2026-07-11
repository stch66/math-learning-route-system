import crypto from "node:crypto";
import { verifyPassword } from "./auth.mjs";
import { recordStudentAttempt } from "./questions.mjs";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function makeToken() {
  return "mst_" + crypto.randomBytes(32).toString("hex");
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function publicQuestion(question) {
  return {
    id: question.id,
    prompt: question.prompt || "",
    layer: question.layer || "",
    options: Array.isArray(question.options) ? question.options : [],
    answer: question.answer || "",
    status: question.status || "draft",
    quality: question.quality || {},
  };
}

function filteredQuestionModules(routeKey, routeData, db, user, questionsForUser) {
  const output = {};
  const modules = routeData[routeKey]?.questionModules || {};
  for (const [moduleCode, nodes] of Object.entries(modules)) {
    const visibleNodes = {};
    for (const nodeId of Object.keys(nodes)) {
      const questions = questionsForUser(nodeId, routeKey, db, user).filter((question) => {
        return Array.isArray(question.options) && question.options.length === 4 && "answer" in question;
      });
      if (questions.length) visibleNodes[nodeId] = questions.map(publicQuestion);
    }
    if (Object.keys(visibleNodes).length) output[moduleCode] = visibleNodes;
  }
  return output;
}

function resolveOfflineUser(db, token) {
  const hash = sha256(token || "");
  const record = (db.offlineSyncTokens || []).find((item) => item.tokenHash === hash && !item.revokedAt);
  if (!record) return { error: "离线同步令牌无效，请重新联网登录。" };
  const user = db.users.find((item) => item.id === record.userId);
  if (!user || user.role !== "student" || !user.studentId) return { error: "该离线账号不可用，请重新登录。" };
  return { record, user };
}

function buildOfflineBootstrap(db, user, deps, token = "") {
  const {
    publicUser,
    publicAssignmentsForStudent,
    publicUnlockPolicies,
    routeData,
    questionsForUser,
  } = deps;
  const student = db.students.find((item) => item.id === user.studentId);
  return {
    serverTime: new Date().toISOString(),
    syncToken: token || "",
    user: publicUser(user),
    students: student ? [student] : [],
    activeStudentId: user.studentId,
    routes: {
      primary: routeData.primary?.data,
      middle: routeData.middle?.data,
    },
    questionModules: {
      primary: filteredQuestionModules("primary", routeData, db, user, questionsForUser),
      middle: filteredQuestionModules("middle", routeData, db, user, questionsForUser),
    },
    progress: db.progressByStudent?.[user.studentId] || {},
    assignments: publicAssignmentsForStudent(db, user.studentId),
    unlockPoliciesByStudent: publicUnlockPolicies(db, [student].filter(Boolean)),
    abilityRadarResetAtByStudent: {
      [user.studentId]: db.abilityRadarResetAtByStudent?.[user.studentId] || "",
    },
  };
}

export async function handleOfflineSyncApi(req, res, pathname, db, deps) {
  const {
    readBody,
    sendJson,
    writeDb,
    appendLoginLog,
    appendAudit,
    nowIso,
  } = deps;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  if (pathname === "/api/offline/login" && req.method === "POST") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const found = db.users.find((item) => item.username === username);
    if (!found || found.role !== "student" || !found.studentId || !verifyPassword(password, found.passwordHash)) {
      appendLoginLog?.(db, req, {
        username,
        success: false,
        user: found || null,
        reason: found ? "offline-bad-password-or-role" : "offline-unknown-user",
      });
      await writeDb(db);
      return sendJson(res, 401, { error: "学生用户名或密码不正确。" });
    }

    const token = makeToken();
    db.offlineSyncTokens ||= [];
    db.offlineSyncTokens.push({
      id: crypto.randomBytes(8).toString("hex"),
      userId: found.id,
      studentId: found.studentId,
      tokenHash: sha256(token),
      deviceName: String(body.deviceName || "").slice(0, 80),
      createdAt: nowIso(),
      lastUsedAt: nowIso(),
    });
    const activeTokens = db.offlineSyncTokens.filter((item) => item.userId === found.id && !item.revokedAt);
    if (activeTokens.length > 6) {
      const remove = new Set(activeTokens.slice(0, activeTokens.length - 6).map((item) => item.id));
      db.offlineSyncTokens = db.offlineSyncTokens.filter((item) => !remove.has(item.id));
    }
    found.lastOfflineLoginAt = nowIso();
    appendLoginLog?.(db, req, {
      username: found.username,
      success: true,
      user: found,
      reason: "offline-client",
    });
    appendAudit(db, { action: "offline.login", by: found.id, studentId: found.studentId, username: found.username });
    await writeDb(db);
    return sendJson(res, 200, buildOfflineBootstrap(db, found, deps, token));
  }

  if (pathname === "/api/offline/bootstrap" && req.method === "POST") {
    const body = await readBody(req);
    const token = String(body.token || bearerToken(req) || "");
    const resolved = resolveOfflineUser(db, token);
    if (resolved.error) return sendJson(res, 401, { error: resolved.error });
    resolved.record.lastUsedAt = nowIso();
    await writeDb(db);
    return sendJson(res, 200, buildOfflineBootstrap(db, resolved.user, deps, token));
  }

  if (pathname === "/api/offline/sync" && req.method === "POST") {
    const body = await readBody(req);
    const token = String(body.token || bearerToken(req) || "");
    const resolved = resolveOfflineUser(db, token);
    if (resolved.error) return sendJson(res, 401, { error: resolved.error });
    const attempts = Array.isArray(body.attempts) ? body.attempts.slice(0, 100) : [];
    const results = [];
    let mutated = false;
    for (const item of attempts) {
      const studentId = String(item.studentId || resolved.user.studentId || "");
      if (studentId !== resolved.user.studentId) {
        results.push({ clientAttemptId: item.clientAttemptId || "", status: 403, error: "只能同步自己的作答。" });
        continue;
      }
      const result = recordStudentAttempt(db, {
        studentId,
        nodeId: String(item.nodeId || ""),
        routeKey: String(item.routeKey || "primary"),
        answers: item.answers || {},
        user: resolved.user,
        clientAttemptId: String(item.clientAttemptId || ""),
        clientCreatedAt: String(item.createdAt || ""),
        deps,
      });
      if (result.mutated) mutated = true;
      results.push({
        clientAttemptId: item.clientAttemptId || "",
        nodeId: item.nodeId || "",
        routeKey: item.routeKey || "primary",
        status: result.status,
        ...result.payload,
      });
    }
    resolved.record.lastUsedAt = nowIso();
    appendAudit(db, { action: "offline.sync", by: resolved.user.id, studentId: resolved.user.studentId, changes: [{ before: null, after: { attempts: attempts.length, accepted: results.filter((item) => item.status === 200).length } }] });
    await writeDb(db);
    return sendJson(res, 200, {
      ok: true,
      mutated,
      results,
      bootstrap: buildOfflineBootstrap(db, resolved.user, deps, token),
    });
  }

  return sendJson(res, 404, { error: "离线同步 API 不存在。" });
}
