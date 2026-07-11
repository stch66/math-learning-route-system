import crypto from "node:crypto";

export async function handleStudentsApi(req, res, db, user, deps) {
  const { readBody, sendJson, writeDb, hashPassword, defaultPrimaryUnlockPolicy, nowIso } = deps;
  if (req.method !== "POST") return sendJson(res, 404, { error: "API 不存在。" });
  if (user.role !== "teacher") return sendJson(res, 403, { error: "只有老师可以添加学生。" });

  const body = await readBody(req);
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();
  const level = String(body.level || "").trim();
  if (!name || !username || !password) return sendJson(res, 400, { error: "姓名、用户名和密码都必填。" });
  if (db.users.some((item) => item.username === username)) return sendJson(res, 400, { error: "用户名已存在。" });

  const student = {
    id: `student-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    name,
    level,
    createdAt: nowIso(),
  };
  const studentUser = {
    id: `user-${crypto.randomBytes(8).toString("hex")}`,
    username,
    displayName: name,
    role: "student",
    passwordHash: hashPassword(password),
    studentId: student.id,
  };

  db.students.push(student);
  db.users.push(studentUser);
  db.progressByStudent[student.id] = {};
  db.assignmentsByStudent ||= {};
  db.assignmentsByStudent[student.id] = [];
  db.unlockPoliciesByStudent ||= {};
  db.unlockPoliciesByStudent[student.id] = { primary: defaultPrimaryUnlockPolicy() };
  await writeDb(db);
  return sendJson(res, 200, { student, students: db.students });
}
