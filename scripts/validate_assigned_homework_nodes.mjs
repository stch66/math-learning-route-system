import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createQuestionReviewTools } from "../server/questionReview.mjs";
import { validateAutoGradableQuestions } from "../server/questionValidation.mjs";
import { createRouteDataLoader } from "../server/routeDataLoader.mjs";
import { createRouteTools } from "../server/routes.mjs";

const rootDir = path.dirname(fileURLToPath(new URL("../math_multiuser_server.mjs", import.meta.url)));
const dbArgIndex = process.argv.indexOf("--db");
const dbPath = dbArgIndex >= 0 ? process.argv[dbArgIndex + 1] : path.join(rootDir, "data", "math-learning-db.json");
const modeAll = process.argv.includes("--all");

const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const { loadRouteData, loadMiddleRouteData } = createRouteDataLoader({ rootDir });
const routeData = {
  primary: await loadRouteData(),
  middle: await loadMiddleRouteData(),
};
const { routeKeyForNodeId, routeForNode } = createRouteTools({ routeData });

function getQuestionsForNode(nodeId, routeKey = "primary") {
  const moduleCode = nodeId.split("-")[0];
  return routeData[routeKey]?.questionModules?.[moduleCode]?.[nodeId] || [];
}

const { questionsForUser } = createQuestionReviewTools({ routeData, getQuestionsForNode });

function assignmentItems(assignment = {}) {
  if (Array.isArray(assignment.items) && assignment.items.length) {
    return assignment.items
      .map((item) => ({
        nodeId: String(item.nodeId || item.id || "").trim(),
        routeKey: String(item.routeKey || assignment.routeKey || "primary"),
      }))
      .filter((item) => item.nodeId);
  }
  return (assignment.nodeIds || [])
    .map((nodeId) => ({
      nodeId: String(nodeId || "").trim(),
      routeKey: String(assignment.routeKey || routeKeyForNodeId(nodeId) || "primary"),
    }))
    .filter((item) => item.nodeId);
}

function validateNode(nodeId, routeKey, context = {}) {
  const resolvedRouteKey = routeKeyForNodeId(nodeId, routeKey) || routeKey || "primary";
  const found = routeForNode(nodeId, resolvedRouteKey);
  const issues = [];
  const warnings = [];
  if (!found) issues.push("路线中找不到该节点");
  const questions = questionsForUser(nodeId, resolvedRouteKey, db, { role: "student", studentId: context.studentId || "" });
  const validation = validateAutoGradableQuestions(nodeId, questions);
  issues.push(...validation.issues);
  warnings.push(...validation.warnings);
  return { nodeId, routeKey: resolvedRouteKey, questionCount: questions.length, issues, warnings, ...context };
}

const checked = [];
const activeAssignments = [];
if (modeAll) {
  for (const routeKey of ["primary", "middle"]) {
    for (const module of routeData[routeKey]?.data?.modules || []) {
      for (const node of module.nodes || []) checked.push(validateNode(node.code, routeKey, { mode: "all" }));
    }
  }
} else {
  for (const student of db.students || []) {
    for (const assignment of db.assignmentsByStudent?.[student.id] || []) {
      if (["archived", "canceled"].includes(assignment.status || "active")) continue;
      activeAssignments.push(assignment.id);
      const seen = new Set();
      for (const item of assignmentItems(assignment)) {
        const key = `${item.routeKey}:${item.nodeId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        checked.push(validateNode(item.nodeId, item.routeKey, {
          studentId: student.id,
          studentName: student.name || student.id,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title || "老师布置的作业",
        }));
      }
    }
  }
}

const issues = checked.filter((item) => item.issues.length);
const warnings = checked.filter((item) => item.warnings.length);
const summary = {
  ok: issues.length === 0,
  dbPath,
  mode: modeAll ? "all-route-nodes" : "active-assigned-homework",
  activeAssignments: [...new Set(activeAssignments)].length,
  checkedNodes: checked.length,
  uniqueNodes: new Set(checked.map((item) => `${item.routeKey}:${item.nodeId}`)).size,
  issues: issues.slice(0, 80),
  warnings: warnings.slice(0, 80),
};
console.log(JSON.stringify(summary, null, 2));
if (issues.length) process.exit(1);
