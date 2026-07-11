export async function handleProgressApi(req, res, pathname, db, user, deps) {
  const {
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
  } = deps;

  if (pathname === "/api/progress" && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const studentId = url.searchParams.get("studentId");
    if (!canAccessStudent(user, studentId)) return sendJson(res, 403, { error: "无权查看该学生进度。" });
    return sendJson(res, 200, { progress: db.progressByStudent[studentId] || {} });
  }

  if (pathname === "/api/progress" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以手动记录进度。" });
    const body = await readBody(req);
    const { studentId, nodeId, status } = body;
    if (!db.students.some((student) => student.id === studentId)) return sendJson(res, 404, { error: "学生不存在。" });
    if (!["not_started", "in_progress", "mastered", "forgotten", "skipped"].includes(status)) return sendJson(res, 400, { error: "状态无效。" });

    db.progressByStudent[studentId] ||= {};
    const existing = db.progressByStudent[studentId][nodeId] || { status: "not_started", history: [], attempts: [] };
    const before = jsonClone(existing);
    db.progressByStudent[studentId][nodeId] = {
      ...existing,
      status,
      updatedAt: nowIso(),
      updatedBy: user.id,
      history: [...(existing.history || []), { status, at: nowIso(), by: user.id, source: "teacher" }],
    };
    const assignmentChanges = refreshAssignmentCompletion(db, studentId, user.id);
    appendAudit(db, { action: "progress.update", by: user.id, studentId, changes: [{ nodeId, before, after: jsonClone(db.progressByStudent[studentId][nodeId]) }] });
    if (assignmentChanges.length) appendAudit(db, { action: "assignment.complete", by: user.id, studentId, changes: assignmentChanges });
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/progress/batch" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以批量记录进度。" });
    const body = await readBody(req);
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    const nodeId = String(body.nodeId || "").trim();
    const status = String(body.status || "in_progress");
    const markPreviousMastered = Boolean(body.markPreviousMastered);
    if (!nodeId || !studentIds.length) return sendJson(res, 400, { error: "请选择学生并填写节点。" });
    if (!["not_started", "in_progress", "mastered", "forgotten", "skipped"].includes(status)) return sendJson(res, 400, { error: "状态无效。" });

    const moduleCode = nodeId.split("-")[0];
    const routeKey = /^([A-Z])(\d+)/.test(moduleCode) && Number(moduleCode.match(/^([A-Z])(\d+)/)[2]) >= 19 ? "middle" : "primary";
    const previous = markPreviousMastered ? previousNodesInModule(nodeId, routeKey) : [];
    let updated = 0;
    const changes = [];
    for (const studentId of studentIds) {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) continue;
      db.progressByStudent[studentId] ||= {};
      student.currentModule = moduleCode;
      student.level = moduleCode;
      student.updatedAt = nowIso();
      for (const previousId of previous) {
        const existing = db.progressByStudent[studentId][previousId] || { status: "not_started", history: [], attempts: [] };
        if (existing.status === "mastered") continue;
        const before = jsonClone(existing);
        db.progressByStudent[studentId][previousId] = { ...existing, status: "mastered", updatedAt: nowIso(), updatedBy: user.id, history: [...(existing.history || []), { status: "mastered", at: nowIso(), by: user.id, source: "batch-previous" }] };
        changes.push({ studentId, nodeId: previousId, before, after: jsonClone(db.progressByStudent[studentId][previousId]) });
      }
      const existing = db.progressByStudent[studentId][nodeId] || { status: "not_started", history: [], attempts: [] };
      const before = jsonClone(existing);
      db.progressByStudent[studentId][nodeId] = { ...existing, status, updatedAt: nowIso(), updatedBy: user.id, history: [...(existing.history || []), { status, at: nowIso(), by: user.id, source: "batch" }] };
      changes.push({ studentId, nodeId, before, after: jsonClone(db.progressByStudent[studentId][nodeId]) });
      changes.push(...refreshAssignmentCompletion(db, studentId, user.id));
      updated += 1;
    }
    appendAudit(db, { action: "progress.batch", by: user.id, changes });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, updated });
  }

  if (pathname === "/api/report" && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const studentId = url.searchParams.get("studentId");
    if (!canAccessStudent(user, studentId)) return sendJson(res, 403, { error: "无权查看该学生报告。" });
    return sendJson(res, 200, { report: buildWeeklyReport(db, studentId) });
  }

  if ((pathname === "/api/weekly-diagnostics" || pathname === "/api/daily-diagnostics") && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const studentId = url.searchParams.get("studentId");
    if (!canAccessStudent(user, studentId)) return sendJson(res, 403, { error: "无权查看该学生诊断。" });
    const list = db.weeklyDiagnosticsByStudent?.[studentId] || db.dailyDiagnosticsByStudent?.[studentId] || [];
    const live = buildWeeklyDiagnosis(db, studentId, { source: "preview" });
    return sendJson(res, 200, { latest: list[0] || live, live, diagnostics: list.slice(0, 30) });
  }

  if ((pathname === "/api/weekly-diagnostics/generate" || pathname === "/api/daily-diagnostics/generate") && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以生成每周诊断。" });
    const body = await readBody(req);
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    const generated = generateWeeklyDiagnostics(db, studentIds);
    appendAudit(db, { action: "weekly-diagnostics.generate", by: user.id, changes: generated.map((item) => ({ studentId: item.studentId, before: null, after: { id: item.id, generatedAt: item.generatedAt } })) });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, generated });
  }

  if (pathname === "/api/rollback" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以回滚进度。" });
    const body = await readBody(req);
    const studentId = String(body.studentId || "");
    const entry = [...(db.auditLog || [])].reverse().find((item) => !item.rolledBackAt && (item.changes || []).some((change) => change.studentId === studentId && change.nodeId));
    if (!entry) return sendJson(res, 404, { error: "没有可回滚的进度操作。" });
    for (const change of entry.changes || []) {
      if (change.studentId !== studentId || !change.nodeId) continue;
      db.progressByStudent[studentId] ||= {};
      if (change.before && change.before.status) db.progressByStudent[studentId][change.nodeId] = change.before;
      else delete db.progressByStudent[studentId][change.nodeId];
    }
    entry.rolledBackAt = nowIso();
    entry.rolledBackBy = user.id;
    appendAudit(db, { action: "progress.rollback", by: user.id, studentId, rolledBackEntryId: entry.id, changes: [] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, entry });
  }

  return sendJson(res, 404, { error: "API 不存在。" });
}
