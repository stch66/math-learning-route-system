import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppStateTools } from "./server/appState.mjs";
import { handleAssignmentsApi } from "./server/assignments.mjs";
import { createAssignmentViewTools } from "./server/assignmentsView.mjs";
import { createAuth, hashPassword } from "./server/auth.mjs";
import { createJsonDbStore } from "./server/db.mjs";
import { appendLoginLog, clientIp, deviceSummary, handleLoginLogApi } from "./server/loginLogs.mjs";
import { handleMistakesApi } from "./server/mistakes.mjs";
import { handleOfflineSyncApi } from "./server/offlineSync.mjs";
import { handleProgressApi } from "./server/progress.mjs";
import { handleQuestionsApi } from "./server/questions.mjs";
import { createQuestionReviewTools } from "./server/questionReview.mjs";
import { createReportTools } from "./server/reports.mjs";
import { createRouteDataLoader } from "./server/routeDataLoader.mjs";
import { createRouteTools } from "./server/routes.mjs";
import { createStaticAssetHandler } from "./server/staticAssets.mjs";
import { loadStudentProfiles, profileForStudent } from "./server/studentProfiles.mjs";
import { handleStudentsApi } from "./server/students.mjs";
import { createUiPages } from "./server/uiPage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4180);
const host = process.env.HOST || "127.0.0.1";
const assetsDir = path.join(__dirname, "assets");
const publicDir = path.join(__dirname, "public");
const dbPath = path.join(__dirname, "data", "math-learning-db.json");
const { learningPagePaths, loadRouteData, loadMiddleRouteData } = createRouteDataLoader({ rootDir: __dirname });
function nowIso() {
  return new Date().toISOString();
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isClientAbort(error) {
  const message = String(error?.message || "");
  return error?.code === "ECONNRESET" || error?.code === "ERR_STREAM_PREMATURE_CLOSE" || /aborted|socket hang up/i.test(message);
}

process.on("uncaughtException", (error) => {
  if (isClientAbort(error)) {
    console.warn("Ignored aborted client connection:", error.code || error.message);
    return;
  }
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (isClientAbort(reason)) {
    console.warn("Ignored aborted client promise:", reason.code || reason.message);
    return;
  }
  console.error(reason);
  process.exit(1);
});

const primaryRouteData = await loadRouteData();
const middleRouteData = await loadMiddleRouteData();
const routeData = {
  primary: primaryRouteData,
  middle: middleRouteData,
};
const studentProfiles = loadStudentProfiles(__dirname);

const PRIMARY_SERIES_CODES = ["A", "B", "C", "D", "E"];
const UNLOCK_GLOBAL_MODES = ["sequential", "all_free"];
const UNLOCK_SERIES_MODES = ["sequential", "series_free"];

const {
  assignmentItems,
  defaultPrimaryUnlockPolicy,
  isNodeUnlockedForStudent,
  normalizePrimaryUnlockPolicy,
  parseAssignmentNodeIds,
  previousNodesInModule,
  primaryUnlockPolicyForStudent,
  publicUnlockPolicies,
  routeForNode,
  routeKeyForNodeId,
  unmetPrerequisitesForProgress,
} = createRouteTools({
  routeData,
  primarySeriesCodes: PRIMARY_SERIES_CODES,
  unlockGlobalModes: UNLOCK_GLOBAL_MODES,
  unlockSeriesModes: UNLOCK_SERIES_MODES,
});

const {
  assignmentComputedState,
  completedAssignmentAlerts,
  publicAssignmentsForStudent,
  refreshAssignmentCompletion,
} = createAssignmentViewTools({
  assignmentItems,
  routeKeyForNodeId,
  routeForNode,
  jsonClone,
  nowIso,
});

function send(res, status, body, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), { "content-type": "application/json; charset=utf-8" });
}

function redirect(res, location) {
  send(res, 302, "", { location });
}

const handleStaticAsset = createStaticAssetHandler({ assetsDir, publicDir, send });

const { loginPage, appPage } = createUiPages({ routeData });

let cachedAppHtml = "";
const learningPageCache = new Map();

function cachedAppPage() {
  if (!cachedAppHtml) cachedAppHtml = appPage();
  return cachedAppHtml;
}

async function cachedLearningPage(nodeId) {
  if (learningPageCache.has(nodeId)) return learningPageCache.get(nodeId);
  const filePath = learningPagePaths[nodeId];
  if (!filePath) return null;
  const html = await fs.readFile(filePath, "utf8");
  learningPageCache.set(nodeId, html);
  return html;
}

async function readBody(req) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text) return {};
    const type = req.headers["content-type"] || "";
    if (type.includes("application/json")) return JSON.parse(text);
    return Object.fromEntries(new URLSearchParams(text));
  } catch (error) {
    if (isClientAbort(error)) {
      const abortError = new Error("请求已中断，请重新提交。");
      abortError.statusCode = 499;
      throw abortError;
    }
    throw error;
  }
}

const {
  appendAudit,
  canAccessStudent,
  defaultDb,
  normalizeDbShape,
  publicUser,
} = createAppStateTools({
  hashPassword,
  defaultPrimaryUnlockPolicy,
  normalizePrimaryUnlockPolicy,
  nowIso,
});

const { readDb, writeDb } = createJsonDbStore({
  dbPath,
  createDefaultDb: defaultDb,
  normalizeDb: normalizeDbShape,
});

const auth = createAuth({
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
});

function getQuestionsForNode(nodeId, routeKey = "primary") {
  const moduleCode = nodeId.split("-")[0];
  return routeData[routeKey]?.questionModules?.[moduleCode]?.[nodeId] || [];
}

const {
  questionReviewKey,
  questionReviewSummary,
  questionsForUser,
} = createQuestionReviewTools({ routeData, getQuestionsForNode });

const {
  buildWeeklyReport,
  buildWeeklyDiagnosis,
  generateWeeklyDiagnostics,
} = createReportTools({
  assignmentComputedState,
  routeData,
  routeForNode,
  studentProfiles,
  profileForStudent,
  nowIso,
});

async function handleApi(req, res, pathname, user) {
  const db = await readDb();
  if (pathname === "/api/bootstrap" && req.method === "GET") {
    const students = user.role === "teacher"
      ? db.students
      : db.students.filter((student) => student.id === user.studentId);
    return sendJson(res, 200, {
      user: publicUser(user),
      students,
      activeStudentId: user.role === "teacher" ? students[0]?.id : user.studentId,
      unlockPoliciesByStudent: publicUnlockPolicies(db, students),
      abilityRadarResetAtByStudent: Object.fromEntries(students.map((student) => [student.id, db.abilityRadarResetAtByStudent?.[student.id] || ""])),
      questionReviews: db.questionReviews || {},
      questionReviewSummary: user.role === "teacher" ? {
        primary: questionReviewSummary(db, "primary"),
        middle: questionReviewSummary(db, "middle"),
      } : {},
    });
  }

  if (pathname === "/api/question-review") {
    return handleQuestionsApi(req, res, pathname, db, user, {
      readBody,
      sendJson,
      writeDb,
      canAccessStudent,
      getQuestionsForNode,
      questionReviewKey,
      questionsForUser,
      isNodeUnlockedForStudent,
      routeForNode,
      unmetPrerequisitesForProgress,
      refreshAssignmentCompletion,
      appendAudit,
      jsonClone,
      nowIso,
    });
  }

  if (pathname === "/api/unlock-policy" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以修改解锁规则。" });
    const body = await readBody(req);
    const studentId = String(body.studentId || "");
    const routeKey = String(body.routeKey || "primary");
    if (routeKey !== "primary") return sendJson(res, 400, { error: "目前只支持小学路线解锁规则。" });
    if (!db.students.some((student) => student.id === studentId)) return sendJson(res, 404, { error: "学生不存在。" });
    db.unlockPoliciesByStudent ||= {};
    db.unlockPoliciesByStudent[studentId] ||= {};
    const before = primaryUnlockPolicyForStudent(db, studentId);
    const after = normalizePrimaryUnlockPolicy(body.policy || {});
    db.unlockPoliciesByStudent[studentId].primary = after;
    appendAudit(db, { action: "unlock-policy.update", by: user.id, studentId, changes: [{ studentId, before, after }] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, policy: after });
  }

  if (pathname === "/api/assignments" || pathname === "/api/assignments/archive" || pathname === "/api/assignments/cancel" || pathname === "/api/assignments/acknowledge" || pathname === "/api/assignment-alerts") {
    return handleAssignmentsApi(req, res, pathname, db, user, {
      readBody,
      sendJson,
      writeDb,
      canAccessStudent,
      publicAssignmentsForStudent,
      completedAssignmentAlerts,
      parseAssignmentNodeIds,
      routeKeyForNodeId,
      routeForNode,
      questionsForUser,
      appendAudit,
      jsonClone,
      nowIso,
    });
  }

  if (pathname === "/api/mistakes" || pathname === "/api/mistakes/review") {
    return handleMistakesApi(req, res, pathname, db, user, {
      readBody,
      sendJson,
      writeDb,
      canAccessStudent,
      appendAudit,
      jsonClone,
      nowIso,
    });
  }

  if (pathname === "/api/progress" || pathname === "/api/progress/batch" || pathname === "/api/report" || pathname === "/api/weekly-diagnostics" || pathname === "/api/weekly-diagnostics/generate" || pathname === "/api/daily-diagnostics" || pathname === "/api/daily-diagnostics/generate") {
    return handleProgressApi(req, res, pathname, db, user, {
      readBody,
      sendJson,
      writeDb,
      canAccessStudent,
      refreshAssignmentCompletion,
      previousNodesInModule,
      buildWeeklyReport,
      buildWeeklyDiagnosis,
      generateWeeklyDiagnostics,
      appendAudit,
      jsonClone,
      nowIso,
    });
  }

  if (pathname === "/api/login-log" && req.method === "GET") {
    return handleLoginLogApi(req, res, db, user, sendJson);
  }

  if (pathname === "/api/rollback") {
    return handleProgressApi(req, res, pathname, db, user, {
      readBody,
      sendJson,
      writeDb,
      canAccessStudent,
      refreshAssignmentCompletion,
      previousNodesInModule,
      buildWeeklyReport,
      buildWeeklyDiagnosis,
      generateWeeklyDiagnostics,
      appendAudit,
      jsonClone,
      nowIso,
    });
  }

  if (pathname === "/api/attempt") {
    return handleQuestionsApi(req, res, pathname, db, user, {
      readBody,
      sendJson,
      writeDb,
      canAccessStudent,
      getQuestionsForNode,
      questionReviewKey,
      questionsForUser,
      isNodeUnlockedForStudent,
      routeForNode,
      unmetPrerequisitesForProgress,
      refreshAssignmentCompletion,
      appendAudit,
      jsonClone,
      nowIso,
    });
  }

  if (pathname === "/api/password" && req.method === "POST") {
    return auth.handlePasswordApi(req, res, user);
  }

  if (pathname === "/api/students" && req.method === "POST") {
    return handleStudentsApi(req, res, db, user, { readBody, sendJson, writeDb, hashPassword, defaultPrimaryUnlockPolicy, nowIso });
  }

  return sendJson(res, 404, { error: "API 不存在。" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (await handleStaticAsset(res, url.pathname)) return;

    const user = await auth.currentUser(req);

    if (url.pathname === "/login" && req.method === "GET") {
      return send(res, 200, loginPage(), { "content-type": "text/html; charset=utf-8" });
    }

    if (url.pathname === "/healthz" && req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        service: "math-system",
        uptimeSeconds: Math.round(process.uptime()),
        cachedLearningPages: learningPageCache.size,
      });
    }

    if (url.pathname === "/login" && req.method === "POST") {
      return auth.handleLoginPost(req, res);
    }

    if (url.pathname.startsWith("/api/offline/")) {
      const db = await readDb();
      return handleOfflineSyncApi(req, res, url.pathname, db, {
        readBody,
        sendJson,
        writeDb,
        appendLoginLog,
        appendAudit,
        nowIso,
        publicUser,
        publicAssignmentsForStudent,
        publicUnlockPolicies,
        routeData,
        questionsForUser,
        canAccessStudent,
        isNodeUnlockedForStudent,
        routeForNode,
        unmetPrerequisitesForProgress,
        refreshAssignmentCompletion,
        jsonClone,
      });
    }

    if (url.pathname === "/logout") {
      return auth.handleLogout(req, res);
    }

    if (!user) {
      if (url.pathname.startsWith("/api/")) return sendJson(res, 401, { error: "请先登录。" });
      return redirect(res, "/login");
    }

    if (url.pathname.startsWith("/learning/")) return send(res, 404, "Learning activities are disabled", { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });

    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname, user);
    if (url.pathname === "/") return send(res, 200, cachedAppPage(), { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });

    return send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
  } catch (error) {
    if (error.statusCode === 499 || isClientAbort(error)) {
      return sendJson(res, 499, { error: error.message || "请求已中断，请重新提交。" });
    }
    console.error(error);
    return sendJson(res, 500, { error: error.message || "服务器错误。" });
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(port, host, () => {
  console.log(`Math learning system: http://${host}:${port}`);
  console.log("Teacher login configured; credentials are not printed.");
});
