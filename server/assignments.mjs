import crypto from "node:crypto";
import { validateAutoGradableQuestions } from "./questionValidation.mjs";

export async function handleAssignmentsApi(req, res, pathname, db, user, deps) {
  const {
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
  } = deps;

  if (pathname === "/api/assignment-alerts" && req.method === "GET") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以查看作业完成提醒。" });
    return sendJson(res, 200, { alerts: completedAssignmentAlerts(db) });
  }

  if (pathname === "/api/assignments" && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const studentId = url.searchParams.get("studentId");
    if (!canAccessStudent(user, studentId)) return sendJson(res, 403, { error: "无权查看该学生作业。" });
    return sendJson(res, 200, { assignments: publicAssignmentsForStudent(db, studentId) });
  }

  if (pathname === "/api/assignments" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以布置作业。" });
    const body = await readBody(req);
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds.map(String) : [];
    const requestedRouteKey = String(body.routeKey || "primary");
    const nodeIds = parseAssignmentNodeIds(body.nodeIds);
    const title = String(body.title || "").trim();
    const note = String(body.note || "").trim();
    const dueDate = String(body.dueDate || "").trim();
    if (!studentIds.length) return sendJson(res, 400, { error: "请选择学生。" });
    if (!nodeIds.length) return sendJson(res, 400, { error: "请填写至少一个节点。" });

    const items = nodeIds.map((nodeId) => {
      const routeKey = routeKeyForNodeId(nodeId, requestedRouteKey);
      const found = routeKey ? routeForNode(nodeId, routeKey) : null;
      return { nodeId, routeKey, found };
    });
    const missing = items.filter((item) => !item.found).map((item) => item.nodeId);
    if (missing.length) return sendJson(res, 400, { error: "找不到节点：" + missing.join("、") });

    const validStudents = studentIds.filter((studentId) => db.students.some((student) => student.id === studentId));
    if (!validStudents.length) return sendJson(res, 404, { error: "没有找到可布置的学生。" });
    if (questionsForUser) {
      const blocked = [];
      for (const item of items) {
        const questions = questionsForUser(item.nodeId, item.routeKey, db, { role: "student", studentId: validStudents[0] });
        const validation = validateAutoGradableQuestions(item.nodeId, questions);
        if (validation.issues.length) blocked.push(`${item.nodeId}（${validation.issues.slice(0, 2).join("；")}）`);
      }
      if (blocked.length) return sendJson(res, 400, { error: "以下节点暂不能布置给学生：" + blocked.join("、") });
    }

    db.assignmentsByStudent ||= {};
    const changes = [];
    for (const studentId of validStudents) {
      db.assignmentsByStudent[studentId] ||= [];
      const assignment = {
        id: `assign-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
        title: title || "作业：" + nodeIds.join("、"),
        items: items.map((item) => ({ nodeId: item.nodeId, routeKey: item.routeKey })),
        nodeIds,
        note,
        dueDate,
        status: "active",
        assignedAt: nowIso(),
        assignedBy: user.id,
      };
      db.assignmentsByStudent[studentId].push(assignment);
      changes.push({ studentId, assignmentId: assignment.id, before: null, after: jsonClone(assignment) });
    }

    appendAudit(db, { action: "assignment.create", by: user.id, changes });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, created: validStudents.length, assignments: publicAssignmentsForStudent(db, validStudents[0]) });
  }

  if (pathname === "/api/assignments/archive" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以归档作业。" });
    const body = await readBody(req);
    const studentId = String(body.studentId || "");
    const assignmentId = String(body.assignmentId || "");
    if (!db.students.some((student) => student.id === studentId)) return sendJson(res, 404, { error: "学生不存在。" });
    const assignment = (db.assignmentsByStudent?.[studentId] || []).find((item) => item.id === assignmentId);
    if (!assignment) return sendJson(res, 404, { error: "作业不存在。" });

    const before = jsonClone(assignment);
    assignment.status = "archived";
    assignment.archivedAt = nowIso();
    assignment.archivedBy = user.id;
    appendAudit(db, { action: "assignment.archive", by: user.id, studentId, changes: [{ studentId, assignmentId, before, after: jsonClone(assignment) }] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, assignments: publicAssignmentsForStudent(db, studentId) });
  }

  if (pathname === "/api/assignments/cancel" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以取消作业。" });
    const body = await readBody(req);
    const studentId = String(body.studentId || "");
    const assignmentId = String(body.assignmentId || "");
    if (!db.students.some((student) => student.id === studentId)) return sendJson(res, 404, { error: "学生不存在。" });
    const assignment = (db.assignmentsByStudent?.[studentId] || []).find((item) => item.id === assignmentId);
    if (!assignment) return sendJson(res, 404, { error: "作业不存在。" });

    const before = jsonClone(assignment);
    assignment.status = "canceled";
    assignment.canceledAt = nowIso();
    assignment.canceledBy = user.id;
    appendAudit(db, { action: "assignment.cancel", by: user.id, studentId, changes: [{ studentId, assignmentId, before, after: jsonClone(assignment) }] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, assignments: publicAssignmentsForStudent(db, studentId) });
  }

  if (pathname === "/api/assignments/acknowledge" && req.method === "POST") {
    if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以确认完成作业。" });
    const body = await readBody(req);
    const studentId = String(body.studentId || "");
    const assignmentId = String(body.assignmentId || "");
    if (!db.students.some((student) => student.id === studentId)) return sendJson(res, 404, { error: "学生不存在。" });
    const assignment = (db.assignmentsByStudent?.[studentId] || []).find((item) => item.id === assignmentId);
    if (!assignment) return sendJson(res, 404, { error: "作业不存在。" });

    const publicAssignment = publicAssignmentsForStudent(db, studentId).find((item) => item.id === assignmentId);
    if (publicAssignment?.computedStatus !== "completed") return sendJson(res, 400, { error: "这份作业还没有完成。" });

    const before = jsonClone(assignment);
    assignment.status = "completed";
    assignment.completedAt ||= nowIso();
    assignment.teacherNoticeAt ||= assignment.completedAt;
    assignment.acknowledgedAt = nowIso();
    assignment.acknowledgedBy = user.id;
    appendAudit(db, { action: "assignment.acknowledge", by: user.id, studentId, changes: [{ studentId, assignmentId, before, after: jsonClone(assignment) }] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, assignments: publicAssignmentsForStudent(db, studentId), alerts: completedAssignmentAlerts(db) });
  }

  return sendJson(res, 404, { error: "API 不存在。" });
}
