export async function handleMistakesApi(req, res, pathname, db, user, deps) {
  const {
    readBody,
    sendJson,
    writeDb,
    canAccessStudent,
    appendAudit,
    jsonClone,
    nowIso,
  } = deps;

  if (pathname === "/api/mistakes" && req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const studentId = url.searchParams.get("studentId") || "";
    const status = url.searchParams.get("status") || "open";
    const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || 80)));
    if (!canAccessStudent(user, studentId)) return sendJson(res, 403, { error: "无权查看该学生错题本。" });
    const mistakes = [...(db.mistakesByStudent?.[studentId] || [])]
      .filter((item) => status === "all" || (item.status || "open") === status)
      .sort((a, b) => Date.parse(b.lastWrongAt || b.at || 0) - Date.parse(a.lastWrongAt || a.at || 0))
      .slice(0, limit);
    return sendJson(res, 200, { mistakes });
  }

  if (pathname === "/api/mistakes/review" && req.method === "POST") {
    const body = await readBody(req);
    const studentId = String(body.studentId || "");
    const mistakeId = String(body.mistakeId || "");
    if (!canAccessStudent(user, studentId)) return sendJson(res, 403, { error: "无权修改该学生错题本。" });
    const mistakes = db.mistakesByStudent?.[studentId] || [];
    const mistake = mistakes.find((item) => item.id === mistakeId);
    if (!mistake) return sendJson(res, 404, { error: "错题不存在。" });
    const before = jsonClone(mistake);
    mistake.status = "reviewed";
    mistake.reviewedAt = nowIso();
    mistake.reviewedBy = user.id;
    appendAudit(db, { action: "mistake.review", by: user.id, studentId, changes: [{ studentId, before, after: jsonClone(mistake) }] });
    await writeDb(db);
    return sendJson(res, 200, { ok: true, mistake });
  }

  return sendJson(res, 404, { error: "API 不存在。" });
}
