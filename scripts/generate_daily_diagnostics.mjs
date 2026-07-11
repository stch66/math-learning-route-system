import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppStateTools } from "../server/appState.mjs";
import { createAssignmentViewTools } from "../server/assignmentsView.mjs";
import { hashPassword } from "../server/auth.mjs";
import { createJsonDbStore } from "../server/db.mjs";
import { createReportTools } from "../server/reports.mjs";
import { createRouteDataLoader } from "../server/routeDataLoader.mjs";
import { createRouteTools } from "../server/routes.mjs";
import { loadStudentProfiles, profileForStudent } from "../server/studentProfiles.mjs";

const rootDir = path.dirname(fileURLToPath(new URL("../math_multiuser_server.mjs", import.meta.url)));
const dbPath = process.env.MATH_DB_PATH || path.join(rootDir, "data", "math-learning-db.json");

function nowIso() {
  return new Date().toISOString();
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const { loadRouteData, loadMiddleRouteData } = createRouteDataLoader({ rootDir });
const routeData = {
  primary: await loadRouteData(),
  middle: await loadMiddleRouteData(),
};
const {
  assignmentItems,
  defaultPrimaryUnlockPolicy,
  normalizePrimaryUnlockPolicy,
  routeForNode,
  routeKeyForNodeId,
} = createRouteTools({ routeData });
const { assignmentComputedState } = createAssignmentViewTools({
  assignmentItems,
  routeKeyForNodeId,
  routeForNode,
  jsonClone,
  nowIso,
});
const { defaultDb, normalizeDbShape } = createAppStateTools({
  hashPassword,
  defaultPrimaryUnlockPolicy,
  normalizePrimaryUnlockPolicy,
  nowIso,
});
const studentProfiles = loadStudentProfiles(rootDir);
const { generateDailyDiagnostics } = createReportTools({
  assignmentComputedState,
  routeData,
  routeForNode,
  studentProfiles,
  profileForStudent,
  nowIso,
});
const { readDb, writeDb } = createJsonDbStore({
  dbPath,
  createDefaultDb: defaultDb,
  normalizeDb: normalizeDbShape,
});

const studentIds = process.argv.slice(2).filter(Boolean);
const db = await readDb();
const generated = generateDailyDiagnostics(db, studentIds);
await writeDb(db);
console.log(JSON.stringify({
  ok: true,
  generated: generated.length,
  students: generated.map((item) => ({ studentId: item.studentId, studentName: item.studentName, generatedAt: item.generatedAt })),
}, null, 2));
