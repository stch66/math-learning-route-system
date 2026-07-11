export function createRouteTools({
  routeData,
  primarySeriesCodes = ["A", "B", "C", "D", "E"],
  unlockGlobalModes = ["sequential", "all_free"],
  unlockSeriesModes = ["sequential", "series_free"],
}) {
  function defaultPrimaryUnlockPolicy() {
    return {
      globalMode: "sequential",
      series: Object.fromEntries(primarySeriesCodes.map((code) => [code, "sequential"])),
    };
  }

  function normalizePrimaryUnlockPolicy(policy = {}) {
    const fallback = defaultPrimaryUnlockPolicy();
    const normalized = {
      globalMode: unlockGlobalModes.includes(policy.globalMode) ? policy.globalMode : fallback.globalMode,
      series: { ...fallback.series },
    };
    for (const code of primarySeriesCodes) {
      const value = policy.series?.[code];
      normalized.series[code] = unlockSeriesModes.includes(value) ? value : "sequential";
    }
    return normalized;
  }

  function primaryUnlockPolicyForStudent(db, studentId) {
    return normalizePrimaryUnlockPolicy(db.unlockPoliciesByStudent?.[studentId]?.primary);
  }

  function publicUnlockPolicies(db, students) {
    return Object.fromEntries(students.map((student) => [student.id, { primary: primaryUnlockPolicyForStudent(db, student.id) }]));
  }

  function statusCounts(progress = {}) {
    const counts = { not_started: 0, in_progress: 0, mastered: 0 };
    routeData.primary.data.modules.forEach((module) => {
      module.nodes.forEach((node) => {
        const status = progress[node.code]?.status || "not_started";
        counts[status] = (counts[status] || 0) + 1;
      });
    });
    return counts;
  }

  function routeForNode(nodeId, routeKey = "primary") {
    const route = routeData[routeKey]?.data;
    if (!route) return null;
    for (const module of route.modules) {
      const index = module.nodes.findIndex((node) => node.code === nodeId);
      if (index >= 0) return { route, module, index, node: module.nodes[index] };
    }
    return null;
  }

  function routeKeyForNodeId(nodeId, preferredRouteKey = "primary") {
    if (routeForNode(nodeId, preferredRouteKey)) return preferredRouteKey;
    if (routeForNode(nodeId, "primary")) return "primary";
    if (routeForNode(nodeId, "middle")) return "middle";
    return "";
  }

  function assignmentItems(assignment = {}) {
    if (Array.isArray(assignment.items) && assignment.items.length) {
      return assignment.items
        .map((item) => ({
          nodeId: String(item.nodeId || item.id || "").trim(),
          routeKey: String(item.routeKey || assignment.routeKey || "primary"),
        }))
        .filter((item) => item.nodeId);
    }
    return (assignment.nodeIds || []).map((nodeId) => ({
      nodeId: String(nodeId || "").trim(),
      routeKey: String(assignment.routeKey || routeKeyForNodeId(nodeId) || "primary"),
    })).filter((item) => item.nodeId);
  }

  function parseAssignmentNodeIds(value) {
    const raw = Array.isArray(value) ? value.join(" ") : String(value || "");
    return [...new Set(raw.split(/[\s,，、;；]+/).map((item) => item.trim().toUpperCase()).filter(Boolean))];
  }

  function previousNodesInModule(nodeId, routeKey = "primary") {
    const found = routeForNode(nodeId, routeKey) || routeForNode(nodeId, "primary") || routeForNode(nodeId, "middle");
    if (!found) return [];
    return found.module.nodes.slice(0, found.index).map((node) => node.code);
  }

  function previousNodeInModule(nodeId, routeKey = "primary") {
    const found = routeForNode(nodeId, routeKey);
    if (!found || found.index <= 0) return "";
    return found.module.nodes[found.index - 1]?.code || "";
  }

  function primarySequentialPreviousNode(nodeId) {
    const match = String(nodeId || "").match(/^([A-E]\d+)-(\d+)$/);
    if (match && Number(match[2]) > 1) {
      const numericPrevious = `${match[1]}-${Number(match[2]) - 1}`;
      if (routeForNode(numericPrevious, "primary")) return numericPrevious;
    }
    return previousNodeInModule(nodeId, "primary");
  }

  function isPrimarySequentialNodeUnlocked(db, studentId, nodeId) {
    const progress = db.progressByStudent?.[studentId] || {};
    const student = db.students.find((item) => item.id === studentId);
    const currentModule = String(student?.currentModule || student?.level || "").split("-")[0];
    const moduleCode = nodeId.split("-")[0];
    if (currentModule && currentModule !== moduleCode) return false;
    const previous = primarySequentialPreviousNode(nodeId);
    return !previous || ["mastered", "skipped"].includes(progress[previous]?.status);
  }

  function isAssignedNodeAvailable(db, studentId, nodeId) {
    return (db.assignmentsByStudent?.[studentId] || []).some((assignment) => {
      if (!["active", "completed"].includes(assignment.status || "active")) return false;
      return assignmentItems(assignment).some((item) => item.nodeId === nodeId);
    });
  }

  function unmetPrerequisitesForProgress(nodeId, routeKey, progress = {}) {
    const found = routeForNode(nodeId, routeKey);
    const prerequisites = found?.node?.prerequisites || routeData[routeKey]?.data?.practice?.byId?.[nodeId]?.prerequisites || [];
    return prerequisites.filter((id) => !["mastered", "skipped"].includes(progress[id]?.status));
  }

  function isNodeUnlockedForStudent(db, studentId, nodeId, routeKey = "primary") {
    if (isAssignedNodeAvailable(db, studentId, nodeId)) return true;
    if (routeKey !== "primary") {
      return unmetPrerequisitesForProgress(nodeId, routeKey, db.progressByStudent?.[studentId] || {}).length === 0;
    }
    const policy = primaryUnlockPolicyForStudent(db, studentId);
    if (policy.globalMode === "all_free") return true;
    const seriesCode = String(nodeId || "").slice(0, 1);
    if (policy.series?.[seriesCode] === "series_free") return true;
    return isPrimarySequentialNodeUnlocked(db, studentId, nodeId);
  }

  return {
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
    statusCounts,
    unmetPrerequisitesForProgress,
  };
}
