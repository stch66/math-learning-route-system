import crypto from "node:crypto";

export function createAppStateTools({
  hashPassword,
  defaultPrimaryUnlockPolicy,
  normalizePrimaryUnlockPolicy,
  nowIso,
}) {
  function defaultDb() {
    return {
      version: 1,
      createdAt: nowIso(),
      users: [
        {
          id: "user-teacher",
          username: "teacher",
          displayName: "老师",
          role: "teacher",
          passwordHash: hashPassword("admin123"),
          studentId: null,
        },
        {
          id: "user-demo-student",
          username: "student1",
          displayName: "示例学生",
          role: "student",
          passwordHash: hashPassword("123456"),
          studentId: "student-demo",
        },
        {
          id: "user-guest",
          username: "guest",
          displayName: "访客",
          role: "guest",
          passwordHash: hashPassword("guest"),
          studentId: null,
        },
      ],
      students: [
        {
          id: "student-demo",
          name: "示例学生",
          level: "示例",
          createdAt: nowIso(),
        },
      ],
      progressByStudent: {
        "student-demo": {},
      },
      assignmentsByStudent: {
        "student-demo": [],
      },
      mistakesByStudent: {
        "student-demo": [],
      },
      weeklyDiagnosticsByStudent: {
        "student-demo": [],
      },
      unlockPoliciesByStudent: {},
      abilityRadarResetAtByStudent: {},
      offlineSyncTokens: [],
    };
  }

  function publicUser(user) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      studentId: user.studentId || null,
    };
  }

  function canAccessStudent(user, studentId) {
    return user.role === "teacher" || user.studentId === studentId;
  }

  function normalizeDbShape(db) {
    db.students ||= [];
    db.users ||= [];
    db.progressByStudent ||= {};
    db.assignmentsByStudent ||= {};
    db.mistakesByStudent ||= {};
    db.weeklyDiagnosticsByStudent ||= db.dailyDiagnosticsByStudent || {};
    db.auditLog ||= [];
    db.questionReviews ||= {};
    db.loginLog ||= [];
    db.unlockPoliciesByStudent ||= {};
    db.abilityRadarResetAtByStudent ||= {};
    db.offlineSyncTokens ||= [];
    db.students.forEach((student) => {
      db.progressByStudent[student.id] ||= {};
      db.assignmentsByStudent[student.id] ||= [];
      db.mistakesByStudent[student.id] ||= [];
      db.weeklyDiagnosticsByStudent[student.id] ||= db.dailyDiagnosticsByStudent?.[student.id] || [];
      db.unlockPoliciesByStudent[student.id] ||= { primary: defaultPrimaryUnlockPolicy() };
      db.unlockPoliciesByStudent[student.id].primary = normalizePrimaryUnlockPolicy(db.unlockPoliciesByStudent[student.id].primary);
      db.abilityRadarResetAtByStudent[student.id] ||= "";
    });
    return db;
  }

  function appendAudit(db, entry) {
    db.auditLog ||= [];
    db.auditLog.push({ id: crypto.randomBytes(8).toString("hex"), at: nowIso(), ...entry });
    if (db.auditLog.length > 2000) db.auditLog = db.auditLog.slice(-2000);
  }

  return {
    appendAudit,
    canAccessStudent,
    defaultDb,
    normalizeDbShape,
    publicUser,
  };
}
