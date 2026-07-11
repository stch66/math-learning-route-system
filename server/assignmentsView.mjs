export function createAssignmentViewTools({ assignmentItems, routeKeyForNodeId, routeForNode, jsonClone, nowIso }) {
  function dateMs(value) {
    const ms = Date.parse(value || "");
    return Number.isFinite(ms) ? ms : 0;
  }

  function completedAfterAssigned(record = {}, assignment = {}) {
    if (!["mastered", "skipped"].includes(record.status)) return false;
    const assignedAt = dateMs(assignment.assignedAt);
    if (!assignedAt) return true;
    const activityTimes = [
      dateMs(record.updatedAt),
      ...(record.history || []).map((item) => dateMs(item.at)),
      ...(record.attempts || []).map((item) => dateMs(item.at)),
    ];
    return activityTimes.some((time) => time >= assignedAt);
  }

  function assignmentComputedState(db, studentId, assignment = {}) {
    const progress = db.progressByStudent?.[studentId] || {};
    const items = assignmentItems(assignment);
    const completedNodeIds = items
      .filter((item) => completedAfterAssigned(progress[item.nodeId], assignment))
      .map((item) => item.nodeId);
    const pendingNodeIds = items
      .filter((item) => !completedAfterAssigned(progress[item.nodeId], assignment))
      .map((item) => item.nodeId);
    const status = assignment.status || "active";
    const computedStatus = ["archived", "canceled"].includes(status)
      ? status
      : (pendingNodeIds.length ? "active" : "completed");
    return { completedNodeIds, pendingNodeIds, computedStatus };
  }

  function publicAssignmentsForStudent(db, studentId) {
    const assignments = db.assignmentsByStudent?.[studentId] || [];
    return assignments.map((assignment) => {
      const items = assignmentItems(assignment).map((item) => {
        const routeKey = routeKeyForNodeId(item.nodeId, item.routeKey);
        const found = routeKey ? routeForNode(item.nodeId, routeKey) : null;
        return {
          nodeId: item.nodeId,
          routeKey: routeKey || item.routeKey,
          moduleCode: found?.module?.code || item.nodeId.split("-")[0],
          title: found?.node?.skill || item.nodeId,
        };
      });
      const computed = assignmentComputedState(db, studentId, assignment);
      return {
        id: assignment.id,
        title: assignment.title || "老师布置的作业",
        note: assignment.note || "",
        dueDate: assignment.dueDate || "",
        assignedAt: assignment.assignedAt || "",
        assignedBy: assignment.assignedBy || "",
        status: assignment.status || "active",
        computedStatus: computed.computedStatus,
        completedAt: assignment.completedAt || "",
        completedBy: assignment.completedBy || "",
        teacherNoticeAt: assignment.teacherNoticeAt || assignment.completedAt || "",
        acknowledgedAt: assignment.acknowledgedAt || "",
        acknowledgedBy: assignment.acknowledgedBy || "",
        canceledAt: assignment.canceledAt || "",
        canceledBy: assignment.canceledBy || "",
        needsTeacherReview: computed.computedStatus === "completed" && !assignment.acknowledgedAt,
        items,
        nodeIds: items.map((item) => item.nodeId),
        completedNodeIds: computed.completedNodeIds,
        pendingNodeIds: computed.pendingNodeIds,
      };
    }).sort((a, b) => String(b.assignedAt || "").localeCompare(String(a.assignedAt || "")));
  }

  function completedAssignmentAlerts(db) {
    const alerts = [];
    for (const student of db.students || []) {
      for (const assignment of publicAssignmentsForStudent(db, student.id)) {
        if (!assignment.needsTeacherReview) continue;
        alerts.push({
          ...assignment,
          studentId: student.id,
          studentName: student.name || student.id,
        });
      }
    }
    return alerts.sort((a, b) => String(b.completedAt || b.teacherNoticeAt || b.assignedAt || "").localeCompare(String(a.completedAt || a.teacherNoticeAt || a.assignedAt || "")));
  }

  function refreshAssignmentCompletion(db, studentId, by) {
    const assignments = db.assignmentsByStudent?.[studentId] || [];
    const changes = [];
    for (const assignment of assignments) {
      if (["archived", "canceled"].includes(assignment.status || "active")) continue;
      const state = assignmentComputedState(db, studentId, assignment);
      if (state.pendingNodeIds.length) continue;
      if ((assignment.status || "active") === "completed" && assignment.completedAt) continue;
      const before = jsonClone(assignment);
      assignment.status = "completed";
      assignment.completedAt = nowIso();
      assignment.completedBy = by;
      assignment.teacherNoticeAt = assignment.teacherNoticeAt || assignment.completedAt;
      changes.push({ studentId, assignmentId: assignment.id, before, after: jsonClone(assignment) });
    }
    return changes;
  }

  return { assignmentComputedState, completedAssignmentAlerts, publicAssignmentsForStudent, refreshAssignmentCompletion };
}
