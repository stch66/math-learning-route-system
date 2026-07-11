import crypto from "node:crypto";

export function recordStudentAttempt(db, {
  studentId,
  nodeId,
  routeKey = "primary",
  answers = {},
  user,
  clientAttemptId = "",
  clientCreatedAt = "",
  deps,
}) {
  const {
    canAccessStudent,
    questionsForUser,
    isNodeUnlockedForStudent,
    routeForNode,
    unmetPrerequisitesForProgress,
    refreshAssignmentCompletion,
    appendAudit,
    jsonClone,
    nowIso,
  } = deps;

  if (user.role === "parent" || user.role === "guest") return { status: 403, payload: { error: "访客账号为只读模式。" } };
  if (!canAccessStudent(user, studentId)) return { status: 403, payload: { error: "无权提交该学生作答。" } };
  if (user.role !== "teacher" && !isNodeUnlockedForStudent(db, studentId, nodeId, routeKey)) return { status: 403, payload: { error: "这个节点还没有解锁。" } };

  const questions = questionsForUser(nodeId, routeKey, db, user);
  if (!questions.length) return { status: 404, payload: { error: "节点题目不存在。" } };
  if (!questions.every((question) => Array.isArray(question.options) && question.options.length && "answer" in question)) {
    return { status: 400, payload: { error: "该节点是开放题，暂不能自动批改。" } };
  }

  db.progressByStudent[studentId] ||= {};
  const existing = db.progressByStudent[studentId][nodeId] || { status: "not_started", history: [], attempts: [] };
  if (clientAttemptId) {
    const duplicate = (existing.attempts || []).find((attempt) => attempt.clientAttemptId === clientAttemptId);
    if (duplicate) {
      return {
        status: 200,
        mutated: false,
        payload: {
          ok: true,
          deduped: true,
          score: duplicate.score,
          total: duplicate.total,
          passed: duplicate.passed,
          results: duplicate.results || {},
          failedLayers: duplicate.failedLayers || [],
          recommendations: duplicate.recommendations || [],
          mistakesCreated: 0,
          completedAssignments: [],
        },
      };
    }
  }

  const results = {};
  let score = 0;
  questions.forEach((question) => {
    const ok = String(answers[question.id] || "").trim() === String(question.answer || "").trim();
    results[question.id] = ok;
    if (ok) score += 1;
  });
  const total = questions.length;
  const passed = score >= Math.min(8, total);
  const status = passed ? "mastered" : "in_progress";
  const failedLayers = [...new Set(questions.filter((question) => !results[question.id]).map((question) => question.layer))];
  const recommendations = passed
    ? []
    : [...new Set([...(routeForNode(nodeId, routeKey)?.node?.prerequisites || []), ...unmetPrerequisitesForProgress(nodeId, routeKey, db.progressByStudent[studentId] || {})])].slice(0, 6);
  const answeredBefore = new Set((existing.attempts || []).flatMap((attempt) => Object.keys(attempt.results || {})));
  const layerResults = {};
  const firstAttemptLayerResults = {};
  function addLayerResult(target, layer, ok) {
    const key = layer || "未知层";
    target[key] ||= { correct: 0, total: 0 };
    target[key].total += 1;
    if (ok) target[key].correct += 1;
  }
  questions.forEach((question) => {
    const ok = Boolean(results[question.id]);
    addLayerResult(layerResults, question.layer, ok);
    if (!answeredBefore.has(question.id)) addLayerResult(firstAttemptLayerResults, question.layer, ok);
  });

  const attemptAt = nowIso();
  const attempt = {
    at: attemptAt,
    clientCreatedAt: clientCreatedAt || "",
    clientAttemptId: clientAttemptId || "",
    score,
    total,
    passed,
    answers,
    results,
    failedLayers,
    recommendations,
    layerResults,
    firstAttemptLayerResults,
    by: user.id,
  };
  const attemptId = crypto.randomBytes(8).toString("hex");
  attempt.id = attemptId;

  const before = jsonClone(existing);
  db.progressByStudent[studentId][nodeId] = {
    ...existing,
    status,
    updatedAt: attemptAt,
    updatedBy: user.id,
    attempts: [...(existing.attempts || []), attempt],
    history: [...(existing.history || []), { status, at: attemptAt, by: user.id, source: clientAttemptId ? "offline-sync" : "attempt", score, total }],
  };
  const routeNode = routeForNode(nodeId, routeKey);
  const mistakeRecords = questions
    .filter((question) => !results[question.id])
    .map((question) => ({
      id: crypto.randomBytes(8).toString("hex"),
      status: "open",
      studentId,
      nodeId,
      routeKey,
      nodeTitle: routeNode?.node?.skill || nodeId,
      moduleTitle: routeNode?.module?.title || nodeId.split("-")[0],
      questionId: question.id,
      layer: question.layer || "",
      prompt: question.prompt || "",
      selected: String(answers[question.id] || ""),
      answer: String(question.answer || ""),
      reason: selectedReasonFor(question, answers[question.id]),
      at: attempt.at,
      lastWrongAt: attempt.at,
      attemptId,
      by: user.id,
    }));
  if (mistakeRecords.length) {
    db.mistakesByStudent ||= {};
    db.mistakesByStudent[studentId] ||= [];
    db.mistakesByStudent[studentId].push(...mistakeRecords);
    if (db.mistakesByStudent[studentId].length > 1000) db.mistakesByStudent[studentId] = db.mistakesByStudent[studentId].slice(-1000);
  }
  const assignmentChanges = refreshAssignmentCompletion(db, studentId, user.id);
  appendAudit(db, { action: clientAttemptId ? "attempt.offline-sync" : "attempt.submit", by: user.id, studentId, changes: [{ studentId, nodeId, before, after: jsonClone(db.progressByStudent[studentId][nodeId]) }] });
  if (mistakeRecords.length) appendAudit(db, { action: "mistake.record", by: user.id, studentId, changes: mistakeRecords.map((record) => ({ studentId, nodeId, before: null, after: jsonClone(record) })) });
  if (assignmentChanges.length) appendAudit(db, { action: "assignment.complete", by: user.id, studentId, changes: assignmentChanges });
  return {
    status: 200,
    mutated: true,
    payload: { score, total, passed, results, failedLayers, recommendations, mistakesCreated: mistakeRecords.length, completedAssignments: assignmentChanges.map((change) => change.assignmentId).filter(Boolean) },
  };
}

export async function handleQuestionsApi(req, res, pathname, db, user, deps) {
  const {
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
  } = deps;

  if (pathname === "/api/question-review" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以复核题目。" });
    const body = await readBody(req);
    const routeKey = String(body.routeKey || "primary");
    const nodeId = String(body.nodeId || "");
    const questionId = String(body.questionId || "");
    const status = String(body.status || "");
    const note = String(body.note || "");
    if (!["draft", "vetted", "hidden"].includes(status)) return sendJson(res, 400, { error: "题目状态无效。" });
    const question = getQuestionsForNode(nodeId, routeKey).find((item) => item.id === questionId);
    if (!question) return sendJson(res, 404, { error: "题目不存在。" });

    const key = questionReviewKey(routeKey, nodeId, questionId);
    const before = db.questionReviews[key] || null;
    db.questionReviews[key] = { status, note, reviewedAt: nowIso(), reviewedBy: user.id };
    appendAudit(db, { action: "question.review", by: user.id, changes: [{ nodeId, questionId, before, after: db.questionReviews[key] }] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, review: db.questionReviews[key] });
  }

  if (pathname === "/api/attempt" && req.method === "POST") {
    const body = await readBody(req);
    const { studentId, nodeId, routeKey = "primary", answers = {}, clientAttemptId = "", clientCreatedAt = "" } = body;
    const result = recordStudentAttempt(db, { studentId, nodeId, routeKey, answers, user, clientAttemptId, clientCreatedAt, deps });
    if (result.status !== 200) return sendJson(res, result.status, result.payload);
    await writeDb(db);
    return sendJson(res, 200, result.payload);
  }

  return sendJson(res, 404, { error: "API 不存在。" });
}

function selectedReasonFor(question, selected) {
  const selectedText = String(selected || "");
  if (!selectedText) return "没有选择答案。";
  const diagnostics = question.quality?.distractorDiagnostics || [];
  const selectedReason = diagnostics.find((item) => item.startsWith(selectedText + "：") || item.includes(". " + selectedText + "：") || item.includes(selectedText + "："));
  return selectedReason ? selectedReason.replace(/^[A-D]\.\s*/, "").replace(selectedText + "：", "") : "这个选项对应的关系或计算有问题。";
}
