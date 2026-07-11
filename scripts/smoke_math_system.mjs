#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.MATH_BASE_URL || "http://127.0.0.1:4180").replace(/\/+$/, "");
const teacherUsername = process.env.MATH_TEACHER_USERNAME || "stephen";
const teacherPassword = process.env.MATH_TEACHER_PASSWORD || "";
const studentUsername = process.env.MATH_TEST_STUDENT_USERNAME || "Jason";
const studentPassword = process.env.MATH_TEST_STUDENT_PASSWORD || "";
const studentName = process.env.MATH_TEST_STUDENT_NAME || "Jason";
const testNodeId = process.env.MATH_TEST_NODE_ID || "A11-1";

function ok(message, extra = {}) {
  console.log(JSON.stringify({ ok: true, message, ...extra }));
}

function fail(message, error) {
  console.error(JSON.stringify({ ok: false, message, error: error?.message || String(error) }));
  process.exit(1);
}

class Session {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }

  async request(pathname, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.cookie) headers.set("cookie", this.cookie);
    const res = await fetch(`${baseUrl}${pathname}`, {
      redirect: "manual",
      ...options,
      headers,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    return res;
  }

  async login(username, password) {
    const res = await this.request("/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });
    assert.equal(res.status, 302, `${this.name} login should redirect after success`);
    assert.match(this.cookie, /^math_session=/, `${this.name} should receive a session cookie`);
  }

  async json(pathname, options = {}) {
    const res = await this.request(pathname, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { res, body };
  }
}

async function main() {
  if (!teacherPassword) {
    throw new Error("Set MATH_TEACHER_PASSWORD before running the smoke test.");
  }

  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200, "healthz should return 200");
  ok("healthz passed", { baseUrl });

  const cssAsset = await fetch(`${baseUrl}/public/style.css`);
  assert.equal(cssAsset.status, 200, "style.css should be served");
  assert.match(cssAsset.headers.get("content-type") || "", /text\/css/, "style.css should have CSS content type");
  const cssText = await cssAsset.text();
  assert.match(cssText, /student-tablet #modules/, "tablet student current-level panel should have a dedicated override");
  assert.match(cssText, /student-tablet \.river[\s\S]*grid-template-columns:repeat\(auto-fit,minmax\(220px,1fr\)\)/, "tablet current-level nodes should render as a visible card grid");
  const sharedAsset = await fetch(`${baseUrl}/public/shared.js`);
  assert.equal(sharedAsset.status, 200, "shared.js should be served");
  assert.match(sharedAsset.headers.get("content-type") || "", /javascript/, "shared.js should have JavaScript content type");
  const sharedJsText = await sharedAsset.text();
  assert.match(sharedJsText, /老师布置的作业/, "shared.js should include student homework rendering");
  assert.match(sharedJsText, /data-cancel-assignment/, "shared.js should include teacher assignment cancel buttons");
  assert.match(sharedJsText, /\/api\/assignments\/cancel/, "shared.js should call the assignment cancel API");
  assert.match(sharedJsText, /data-homework-alert/, "shared.js should include the student homework reminder");
  assert.match(sharedJsText, /闯关检测/, "shared.js should include the upgraded mastery-check view");
  assert.match(sharedJsText, /data-ack-assignment/, "shared.js should include teacher assignment acknowledgement buttons");
  assert.match(sharedJsText, /pendingNodeIds/, "student homework should use server-computed pending assignment nodes");
  assert.match(sharedJsText, /focus-package/, "student homepage should include the task package panel");
  assert.match(sharedJsText, /practice-runner/, "student mastery check should use the focused practice runner");
  assert.match(sharedJsText, /每 2 题给一次小反馈/, "student mastery check should show checkpoint feedback every two questions");
  assert.match(sharedJsText, /概念、模型、心算、规范、应用能力雷达图/, "ability radar should use the five learning abilities");
  assert.match(sharedJsText, /renderMasteryRadarBoard/, "ability radar should render per-series radar boards");
  assert.match(sharedJsText, /\["A", "B", "C", "D"\]/, "ability radar should render A-D separately");
  assert.match(sharedJsText, /firstAttemptLayerResults/, "ability radar should prefer server-saved first-attempt layer stats");
  assert.match(sharedJsText, /confirmedAnswers/, "student practice runner should freeze answers when confirmed");
  assert.match(sharedJsText, /disabled: checked/, "student practice runner should disable confirmed questions");
  assert.match(sharedJsText, /mistakeBook/, "frontend should render the mistake notebook");
  assert.match(sharedJsText, /\/api\/mistakes/, "frontend should load mistake records");
  assert.match(sharedJsText, /orderedPracticeQuestions/, "student mastery questions should be ordered by learning layer");
  assert.doesNotMatch(sharedJsText, /shuffle\(questions\)\.map/, "student mastery questions should not shuffle the full question list");
  for (const roleScript of ["admin.js", "student.js"]) {
    const roleAsset = await fetch(`${baseUrl}/public/${roleScript}`);
    assert.equal(roleAsset.status, 200, `${roleScript} should be served`);
    assert.match(roleAsset.headers.get("content-type") || "", /javascript/, `${roleScript} should have JavaScript content type`);
  }
  for (const imagePath of ["/assets/student-starry-bg.png", "/assets/math-lab-planet-map.png"]) {
    const imageAsset = await fetch(`${baseUrl}${imagePath}`);
    assert.equal(imageAsset.status, 200, `${imagePath} should be served`);
    assert.match(imageAsset.headers.get("content-type") || "", /image\/png/, `${imagePath} should have PNG content type`);
  }
  ok("public frontend assets passed");

  const teacher = new Session("teacher");
  await teacher.login(teacherUsername, teacherPassword);
  const { res: loginLogRes, body: loginLogBody } = await teacher.json(`/api/login-log?username=${encodeURIComponent(teacherUsername)}&limit=5`);
  assert.equal(loginLogRes.status, 200, "teacher should read login logs");
  assert.ok(Array.isArray(loginLogBody.logs), "login log response should include logs array");
  assert.ok(
    loginLogBody.logs.some((item) => item.username === teacherUsername && item.success === true),
    "login log should include current teacher login",
  );
  const { res: wrongPasswordChangeRes } = await teacher.json("/api/password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword: "__wrong_current_password__",
      newPassword: "__not_applied__",
      confirmPassword: "__not_applied__",
    }),
  });
  assert.equal(wrongPasswordChangeRes.status, 403, "password change should reject a wrong current password");
  const { res: invalidStudentCreateRes } = await teacher.json("/api/students", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert.equal(invalidStudentCreateRes.status, 400, "teacher student create should validate required fields");
  const teacherHome = await teacher.request("/");
  const teacherHtml = await teacherHome.text();
  assert.equal(teacherHome.status, 200, "teacher home should load");
  assert.match(teacherHtml, /布置指定作业/, "teacher page should include assignment manager");
  assert.match(teacherHtml, /assignmentAlerts/, "teacher page should include assignment completion alerts");
  assert.match(teacherHtml, /\/public\/style\.css/, "teacher page should reference external CSS");
  assert.match(teacherHtml, /\/public\/shared\.js/, "teacher page should reference shared JS");
  assert.match(teacherHtml, /\/public\/admin\.js/, "teacher page should reference admin JS");
  assert.match(teacherHtml, /\/public\/student\.js/, "teacher page should reference student JS");
  assert.match(teacherHtml, /window\.MATH_APP_DATA/, "teacher page should include boot data script");
  assert.match(teacherHtml, /mistakeBookPanel/, "teacher page should include the mistake notebook panel");
  assert.match(teacherHtml, /generateWeeklyDiagnosis/, "teacher page should include weekly diagnosis generation");
  const studentNavHtml = teacherHtml.match(/<nav class="student-game-menu"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.match(studentNavHtml, /data-student-screen="today"/, "student navigation should include the today screen");
  assert.match(studentNavHtml, /data-student-screen="map"/, "student navigation should include the learning map");
  assert.match(studentNavHtml, /data-student-screen="tasks"/, "student navigation should include the task hub");
  assert.match(studentNavHtml, /data-student-screen="growth"/, "student navigation should include the growth view");
  assert.doesNotMatch(teacherHtml, /新窗口打开学习活动/, "learning activity button should stay removed");
  ok("teacher login and assignment UI passed");

  const { body: bootstrap } = await teacher.json("/api/bootstrap");
  const targetStudent = (bootstrap.students || []).find((student) => student.name === studentName)
    || (bootstrap.students || [])[0];
  assert.ok(targetStudent?.id, "target student should exist");
  const { res: teacherProgressRes } = await teacher.json(`/api/progress?studentId=${encodeURIComponent(targetStudent.id)}`);
  assert.equal(teacherProgressRes.status, 200, "teacher should read student progress");
  const { res: teacherReportRes, body: teacherReportBody } = await teacher.json(`/api/report?studentId=${encodeURIComponent(targetStudent.id)}`);
  assert.equal(teacherReportRes.status, 200, "teacher should read student weekly report");
  for (const key of ["thisWeekLearned", "nextWeekSuggestions", "assigned", "remediation"]) {
    assert.ok(Array.isArray(teacherReportBody.report?.[key]), `weekly report ${key} should be an array`);
  }
  const { res: teacherDiagnosisRes, body: teacherDiagnosisBody } = await teacher.json(`/api/weekly-diagnostics?studentId=${encodeURIComponent(targetStudent.id)}`);
  assert.equal(teacherDiagnosisRes.status, 200, "teacher should read student weekly diagnosis");
  for (const key of ["weeklyConclusion", "strengths", "mainProblems", "mistakeTypes", "nextSteps", "unlockDecision", "text"]) {
    assert.ok(key in (teacherDiagnosisBody.live || {}), `weekly diagnosis should include ${key}`);
  }
  assert.match(teacherDiagnosisBody.live?.text || "", /数学本周结论：/, "weekly diagnosis should use math-only fixed format");
  assert.match(teacherDiagnosisBody.live?.text || "", /我的优势：/, "weekly diagnosis should include strengths section");
  assert.match(teacherDiagnosisBody.live?.text || "", /数学主要问题：/, "weekly diagnosis should keep problems math-specific");
  assert.match(teacherDiagnosisBody.live?.text || "", /数学下一步：/, "weekly diagnosis should keep next steps math-specific");
  assert.doesNotMatch(teacherDiagnosisBody.live?.text || "", /给家长的话|给学生的话/, "weekly diagnosis should not include parent/student message sections");
  const { res: teacherMistakesRes, body: teacherMistakesBody } = await teacher.json(`/api/mistakes?studentId=${encodeURIComponent(targetStudent.id)}&status=open&limit=5`);
  assert.equal(teacherMistakesRes.status, 200, "teacher should read student mistake notebook");
  assert.ok(Array.isArray(teacherMistakesBody.mistakes), "mistake notebook response should include mistakes array");
  const { res: alertsRes, body: alertsBody } = await teacher.json("/api/assignment-alerts");
  assert.equal(alertsRes.status, 200, "teacher should read completed assignment alerts");
  assert.ok(Array.isArray(alertsBody.alerts), "assignment alerts response should include alerts array");
  const { res: invalidBatchProgressRes } = await teacher.json("/api/progress/batch", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert.equal(invalidBatchProgressRes.status, 400, "teacher batch progress should validate required fields");
  const { res: invalidQuestionReviewRes } = await teacher.json("/api/question-review", {
    method: "POST",
    body: JSON.stringify({ routeKey: "primary", nodeId: testNodeId, questionId: "missing", status: "bad-status" }),
  });
  assert.equal(invalidQuestionReviewRes.status, 400, "teacher question review should validate status");
  const { res: missingAttemptRes } = await teacher.json("/api/attempt", {
    method: "POST",
    body: JSON.stringify({ studentId: targetStudent.id, nodeId: "NO-SUCH-NODE", routeKey: "primary", answers: {} }),
  });
  assert.equal(missingAttemptRes.status, 404, "teacher attempt should reject missing question node");

  const assignmentTitle = `系统冒烟测试作业-${Date.now()}`;
  const createPayload = {
    studentIds: [targetStudent.id],
    nodeIds: testNodeId,
    title: assignmentTitle,
    note: "自动冒烟测试创建，随后归档",
    routeKey: "primary",
  };
  const { res: createRes, body: createBody } = await teacher.json("/api/assignments", {
    method: "POST",
    body: JSON.stringify(createPayload),
  });
  assert.equal(createRes.status, 200, "assignment create should return 200");
  assert.equal(createBody.created, 1, "assignment create should affect one student");

  const { body: beforeArchive } = await teacher.json(`/api/assignments?studentId=${encodeURIComponent(targetStudent.id)}`);
  const created = (beforeArchive.assignments || []).find((item) => item.title === assignmentTitle);
  assert.ok(created?.id, "created assignment should be visible before archive");
  assert.notEqual(created.computedStatus, "archived", "created assignment should be visible before archive");
  assert.equal(created.computedStatus, "active", "new assignment should not auto-complete from old mastery records");
  const { res: prematureAckRes } = await teacher.json("/api/assignments/acknowledge", {
    method: "POST",
    body: JSON.stringify({ studentId: targetStudent.id, assignmentId: created.id }),
  });
  assert.equal(prematureAckRes.status, 400, "teacher should not acknowledge an unfinished assignment");

  const cancelTitle = `系统冒烟测试取消作业-${Date.now()}`;
  const { res: cancelCreateRes, body: cancelCreateBody } = await teacher.json("/api/assignments", {
    method: "POST",
    body: JSON.stringify({ ...createPayload, title: cancelTitle, note: "自动冒烟测试创建，随后取消" }),
  });
  assert.equal(cancelCreateRes.status, 200, "assignment create for cancel should return 200");
  assert.equal(cancelCreateBody.created, 1, "assignment create for cancel should affect one student");
  const { body: beforeCancel } = await teacher.json(`/api/assignments?studentId=${encodeURIComponent(targetStudent.id)}`);
  const cancelTarget = (beforeCancel.assignments || []).find((item) => item.title === cancelTitle);
  assert.ok(cancelTarget?.id, "created cancel assignment should be visible before cancel");
  const { res: cancelRes, body: cancelBody } = await teacher.json("/api/assignments/cancel", {
    method: "POST",
    body: JSON.stringify({ studentId: targetStudent.id, assignmentId: cancelTarget.id }),
  });
  assert.equal(cancelRes.status, 200, "assignment cancel should return 200");
  assert.equal(cancelBody.ok, true, "assignment cancel response should be ok");
  const { body: afterCancel } = await teacher.json(`/api/assignments?studentId=${encodeURIComponent(targetStudent.id)}`);
  const canceled = (afterCancel.assignments || []).find((item) => item.id === cancelTarget.id);
  assert.equal(canceled?.computedStatus, "canceled", "canceled assignment should report canceled status");

  let student = null;
  if (studentPassword) {
    student = new Session("student");
    await student.login(studentUsername, studentPassword);
    const studentHome = await student.request("/");
    const studentHtml = await studentHome.text();
    assert.equal(studentHome.status, 200, "student home should load");
    assert.match(studentHtml, /\/public\/shared\.js/, "student page should reference shared JS");
    assert.match(studentHtml, /\/public\/student\.js/, "student page should reference student JS");
    assert.match(studentHtml, /window\.MATH_APP_DATA/, "student page should include boot data script");
    const { res: ownProgress } = await student.json(`/api/progress?studentId=${encodeURIComponent(targetStudent.id)}`);
    assert.equal(ownProgress.status, 200, "student should read own progress");
    const { res: ownReport } = await student.json(`/api/report?studentId=${encodeURIComponent(targetStudent.id)}`);
    assert.equal(ownReport.status, 200, "student should read own report");
    const { res: ownDiagnosis } = await student.json(`/api/weekly-diagnostics?studentId=${encodeURIComponent(targetStudent.id)}`);
    assert.equal(ownDiagnosis.status, 200, "student should read own weekly diagnosis");
    const { res: ownAssignments, body: ownAssignmentsBody } = await student.json(`/api/assignments?studentId=${encodeURIComponent(targetStudent.id)}`);
    assert.equal(ownAssignments.status, 200, "student should read own assignments");
    const studentVisibleAssignment = (ownAssignmentsBody.assignments || []).find((item) => item.id === created.id);
    assert.ok(studentVisibleAssignment?.id, "student should see the active assignment created by teacher");
    assert.notEqual(studentVisibleAssignment.computedStatus, "archived", "student-visible assignment should not be archived before cleanup");
  } else {
    ok("student login smoke skipped because MATH_TEST_STUDENT_PASSWORD is not set");
  }

  const { res: archiveRes, body: archiveBody } = await teacher.json("/api/assignments/archive", {
    method: "POST",
    body: JSON.stringify({ studentId: targetStudent.id, assignmentId: created.id }),
  });
  assert.equal(archiveRes.status, 200, "assignment archive should return 200");
  assert.equal(archiveBody.ok, true, "assignment archive response should be ok");

  const { body: afterArchive } = await teacher.json(`/api/assignments?studentId=${encodeURIComponent(targetStudent.id)}`);
  const archived = (afterArchive.assignments || []).find((item) => item.id === created.id);
  assert.equal(archived?.computedStatus, "archived", "archived assignment should report archived status");
  ok("assignment create/read/archive/student visibility passed", { studentId: targetStudent.id, nodeId: testNodeId });

  const otherStudent = (bootstrap.students || []).find((studentItem) => studentItem.id !== targetStudent.id);
  if (student && otherStudent) {
    const { res: otherAssignments } = await student.json(`/api/assignments?studentId=${encodeURIComponent(otherStudent.id)}`);
    assert.equal(otherAssignments.status, 403, "student should not read another student's assignments");
    const { res: otherProgress } = await student.json(`/api/progress?studentId=${encodeURIComponent(otherStudent.id)}`);
    assert.equal(otherProgress.status, 403, "student should not read another student's progress");
    const { res: otherDiagnosis } = await student.json(`/api/weekly-diagnostics?studentId=${encodeURIComponent(otherStudent.id)}`);
    assert.equal(otherDiagnosis.status, 403, "student should not read another student's weekly diagnosis");
    const { res: otherAttempt } = await student.json("/api/attempt", {
      method: "POST",
      body: JSON.stringify({ studentId: otherStudent.id, nodeId: testNodeId, routeKey: "primary", answers: {} }),
    });
    assert.equal(otherAttempt.status, 403, "student should not submit another student's attempt");
  }
  if (student) {
    const { res: studentLoginLogRes } = await student.json("/api/login-log?limit=1");
    assert.equal(studentLoginLogRes.status, 403, "student should not read login logs");
    const { res: studentAlertsRes } = await student.json("/api/assignment-alerts");
    assert.equal(studentAlertsRes.status, 403, "student should not read teacher assignment alerts");
    const { res: studentCreateRes } = await student.json("/api/students", {
      method: "POST",
      body: JSON.stringify({ name: "Smoke", username: "smoke-student", password: "secret" }),
    });
    assert.equal(studentCreateRes.status, 403, "student should not create students");
    const { res: studentQuestionReviewRes } = await student.json("/api/question-review", {
      method: "POST",
      body: JSON.stringify({ routeKey: "primary", nodeId: testNodeId, questionId: "missing", status: "hidden" }),
    });
    assert.equal(studentQuestionReviewRes.status, 403, "student should not review questions");
    ok("student login and assignment permission passed");
  }

  ok("math system smoke test passed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => fail("math system smoke test failed", error));
