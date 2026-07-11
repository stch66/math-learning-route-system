const ABILITY_LABELS = {
  concept: "概念",
  model: "模型",
  mental: "心算",
  standard: "规范",
  application: "应用",
  unknown: "未知",
};

function abilityForLayer(layer = "") {
  const text = String(layer);
  if (/概念|concept/i.test(text)) return "concept";
  if (/模型|model|图|数轴|方格|条形/i.test(text)) return "model";
  if (/快速|心算|mental|反应|口算/i.test(text)) return "mental";
  if (/规范|standard|笔算|算法|竖式/i.test(text)) return "standard";
  if (/应用|application|故事|生活|图表/i.test(text)) return "application";
  return "unknown";
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function formatList(items, fallback = "暂无集中问题。") {
  const list = items.length ? items : [fallback];
  return list.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function isMathRelatedLine(line = "") {
  return /数学|数感|计算|心算|口算|笔算|加法|减法|乘法|除法|加减|乘除|四则|进位|退位|凑十|破十|估算|估商|分数|小数|百分数|比例|比|方程|代数|函数|几何|图形|空间|面积|周长|体积|单位|测量|时间|钱币|应用题|审题|模型|数轴|方格|条形图|图表|概念|规范|错题|检测|题|节点|路线|A\d|B\d|C\d|D\d|E\d/u.test(String(line));
}

function cleanProfileLine(line = "") {
  return String(line)
    .trim()
    .replace(/^[-#*🟣🔵🟡🟢\s]+/gu, "")
    .replace(/^学生(?:学习)?画像[:：]?\s*/u, "")
    .replace(/^画像判断[:：]?\s*/u, "")
    .trim();
}

function weekKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").slice(0, 10);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function latestAttempts(progress = {}) {
  return Object.entries(progress)
    .flatMap(([nodeId, record]) => (record.attempts || []).map((attempt) => ({ nodeId, record, ...attempt })))
    .filter((attempt) => attempt.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function nodeLabel(routeForNode, nodeId, routeKey = "primary") {
  const found = routeForNode?.(nodeId, routeKey) || routeForNode?.(nodeId, "primary") || routeForNode?.(nodeId, "middle");
  return found?.node?.skill ? `${nodeId} ${found.node.skill}` : nodeId;
}

function currentNodeSuggestion(db, studentId, routeData, routeForNode) {
  const student = db.students.find((item) => item.id === studentId);
  const moduleCode = String(student?.currentModule || student?.level || "").split("-")[0];
  const routeKey = /^([A-Z])(\d+)/.test(moduleCode) && Number(moduleCode.match(/^([A-Z])(\d+)/)?.[2] || 0) >= 19 ? "middle" : "primary";
  const modules = routeData?.[routeKey]?.data?.modules || [];
  const module = modules.find((item) => item.code === moduleCode) || modules[0];
  const progress = db.progressByStudent?.[studentId] || {};
  const node = module?.nodes?.find((item) => !["mastered", "skipped"].includes(progress[item.code]?.status)) || module?.nodes?.[0];
  return node ? { nodeId: node.code, routeKey, title: nodeLabel(routeForNode, node.code, routeKey) } : null;
}

function profileHint(profile) {
  if (!profile?.summary) return "暂无数学画像文件，先依据做题数据判断。";
  const firstLines = profile.summary
    .split(/\r?\n/)
    .map(cleanProfileLine)
    .filter((line) => line && isMathRelatedLine(line))
    .slice(0, 4);
  return firstLines.join("；") || "已读取数学画像，但本周诊断只使用数学相关信息。";
}

function profileStrengths(profile) {
  if (!profile?.summary) return [];
  return profile.summary
    .split(/\r?\n/)
    .map(cleanProfileLine)
    .filter((line) => isMathRelatedLine(line) && /优势|强项|不错|较好|稳定|清晰|理解|计算|空间|数感|模型|应用|规范|心算|口算|笔算|几何|分数|小数/u.test(line))
    .slice(0, 3);
}

function mistakeTypeSummary(db, studentId) {
  const openMistakes = (db.mistakesByStudent?.[studentId] || []).filter((item) => (item.status || "open") === "open");
  const counts = {};
  for (const mistake of openMistakes) {
    const ability = abilityForLayer(mistake.layer);
    counts[ability] = (counts[ability] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([ability, count]) => `${ABILITY_LABELS[ability] || ability}层错题 ${count} 道`);
}

function weakLayerSummary(attempts) {
  const stats = {};
  for (const attempt of attempts) {
    for (const [layer, result] of Object.entries(attempt.firstAttemptLayerResults || attempt.layerResults || {})) {
      const ability = abilityForLayer(layer);
      stats[ability] ||= { correct: 0, total: 0 };
      stats[ability].correct += Number(result.correct || 0);
      stats[ability].total += Number(result.total || 0);
    }
  }
  return Object.entries(stats)
    .filter(([, result]) => result.total && result.correct / result.total < 0.8)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .map(([ability, result]) => `${ABILITY_LABELS[ability] || ability}层第一次正确率 ${result.correct}/${result.total}`);
}

function strongLayerSummary(attempts) {
  const stats = {};
  for (const attempt of attempts) {
    for (const [layer, result] of Object.entries(attempt.firstAttemptLayerResults || attempt.layerResults || {})) {
      const ability = abilityForLayer(layer);
      stats[ability] ||= { correct: 0, total: 0 };
      stats[ability].correct += Number(result.correct || 0);
      stats[ability].total += Number(result.total || 0);
    }
  }
  return Object.entries(stats)
    .filter(([, result]) => result.total >= 2 && result.correct / result.total >= 0.8)
    .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))
    .map(([ability, result]) => `${ABILITY_LABELS[ability] || ability}层第一次正确率 ${result.correct}/${result.total}`);
}

function fixedFormatDiagnosis(parts) {
  return [
    `数学本周结论：${parts.weeklyConclusion}`,
    "我的优势：",
    formatList(parts.strengths, "本周暂未形成可量化优势，先完成一次检测后再判断。"),
    "数学主要问题：",
    formatList(parts.mainProblems),
    "错题类型：",
    formatList(parts.mistakeTypes),
    "数学下一步：",
    formatList(parts.nextSteps),
    `是否解锁：${parts.unlockDecision}`,
  ].join("\n");
}

export function createReportTools({ assignmentComputedState, routeData = {}, routeForNode, studentProfiles = {}, profileForStudent, nowIso = () => new Date().toISOString() }) {
  function buildWeeklyReport(db, studentId) {
    const progress = db.progressByStudent[studentId] || {};
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekLearned = [];
    const remediation = [];
    const inProgress = [];
    const assigned = [];
    for (const assignment of db.assignmentsByStudent?.[studentId] || []) {
      if ((assignment.status || "active") !== "active") continue;
      const state = assignmentComputedState(db, studentId, assignment);
      assigned.push(...state.pendingNodeIds);
    }
    for (const [nodeId, record] of Object.entries(progress)) {
      if (record.status === "mastered" && Date.parse(record.updatedAt || record.history?.at || 0) >= weekAgo) thisWeekLearned.push(nodeId);
      if (record.status === "forgotten") remediation.push(nodeId);
      if (record.status === "in_progress") inProgress.push(nodeId);
      const lastAttempt = (record.attempts || []).at(-1);
      if (lastAttempt && !lastAttempt.passed) remediation.push(...(lastAttempt.recommendations || []));
    }
    const nextWeekSuggestions = [...new Set([...assigned, ...inProgress, ...remediation])].slice(0, 8);
    return {
      thisWeekLearned: [...new Set(thisWeekLearned)].slice(-12),
      nextWeekSuggestions,
      assigned: [...new Set(assigned)].slice(0, 12),
      remediation: [...new Set(remediation)].slice(0, 8),
    };
  }

  function buildWeeklyDiagnosis(db, studentId, options = {}) {
    const student = db.students.find((item) => item.id === studentId);
    const progress = db.progressByStudent?.[studentId] || {};
    const attempts = latestAttempts(progress);
    const weekAttempts = attempts.filter((attempt) => Date.now() - Date.parse(attempt.at) <= 7 * 24 * 60 * 60 * 1000);
    const lastAttempt = attempts[0] || null;
    const profile = profileForStudent?.(student, studentProfiles) || null;
    const current = currentNodeSuggestion(db, studentId, routeData, routeForNode);
    const mistakeTypes = uniq([...mistakeTypeSummary(db, studentId), ...weakLayerSummary(weekAttempts)]).slice(0, 6);
    const strengths = uniq([
      ...strongLayerSummary(weekAttempts),
      ...(lastAttempt?.passed ? [`最近一次 ${lastAttempt.nodeId} 检测通过，说明当前节点已有可继续推进的基础。`] : []),
      ...profileStrengths(profile),
    ]).slice(0, 6);
    const failedLayers = uniq(lastAttempt?.failedLayers || []).map((layer) => ABILITY_LABELS[abilityForLayer(layer)] || layer);
    const remediation = uniq([
      ...(lastAttempt?.recommendations || []),
      ...(db.mistakesByStudent?.[studentId] || []).filter((item) => (item.status || "open") === "open").map((item) => item.nodeId),
    ]).slice(0, 6);
    const mainProblems = [];
    if (lastAttempt && !lastAttempt.passed) mainProblems.push(`最近一次 ${lastAttempt.nodeId} 检测为 ${lastAttempt.score}/${lastAttempt.total}，还没有达到 8/10 的通过线。`);
    if (failedLayers.length) mainProblems.push(`本次主要卡在：${failedLayers.join("、")}。`);
    if (mistakeTypes.length) mainProblems.push(`错题集中在：${mistakeTypes.slice(0, 3).join("；")}。`);
    if (!mainProblems.length && lastAttempt?.passed) mainProblems.push(`最近一次 ${lastAttempt.nodeId} 检测已通过，下一步重点是保持稳定和复盘错题。`);
    if (!mainProblems.length) mainProblems.push("本周暂无新的检测记录，先按当前路线位置继续观察。");

    const nextSteps = [];
    if (lastAttempt && !lastAttempt.passed) nextSteps.push(`先复盘 ${lastAttempt.nodeId} 的错题，再重测一次。`);
    if (remediation.length) nextSteps.push(`优先回补：${remediation.map((nodeId) => nodeLabel(routeForNode, nodeId)).join("、")}。`);
    if (current?.title) nextSteps.push(`本周主线：${current.title}。`);
    nextSteps.push("每次只做 2 道题后马上看反馈，错因说清楚再继续。");

    let weeklyConclusion = "本周暂无新的自动检测记录，建议从当前路线位置开始短练习。";
    if (lastAttempt) {
      const timeText = new Date(lastAttempt.at).toLocaleString("zh-CN", { hour12: false });
      weeklyConclusion = lastAttempt.passed
        ? `${timeText} 的 ${lastAttempt.nodeId} 检测已通过，第一次作答数据仍用于观察稳定性。`
        : `${timeText} 的 ${lastAttempt.nodeId} 检测未通过，需要先回补再继续。`;
    }
    if (weekAttempts.length > 1) weeklyConclusion += ` 最近 7 天共有 ${weekAttempts.length} 次检测记录。`;

    const hasConceptOrModelMistake = (db.mistakesByStudent?.[studentId] || []).some((item) => (item.status || "open") === "open" && ["concept", "model"].includes(abilityForLayer(item.layer)));
    const unlockDecision = !lastAttempt
      ? "需要老师根据课堂表现判断；系统建议先完成当前节点检测。"
      : lastAttempt.passed && !hasConceptOrModelMistake
        ? "建议解锁下一关。"
        : lastAttempt.passed
          ? "可以进入下一关，但先用 5 分钟复盘概念/模型错题。"
          : "暂不解锁，先复盘错题并重测当前节点。";

    const parts = {
      weeklyConclusion,
      todayConclusion: weeklyConclusion,
      strengths,
      mainProblems,
      mistakeTypes,
      nextSteps,
      unlockDecision,
    };
    return {
      id: options.id || `${studentId}-${weekKey(options.generatedAt || nowIso())}`,
      studentId,
      studentName: student?.name || studentId,
      generatedAt: options.generatedAt || nowIso(),
      source: options.source || "auto",
      profileFiles: profile?.files || [],
      profileHint: profileHint(profile),
      evidence: {
        lastAttempt: lastAttempt ? { nodeId: lastAttempt.nodeId, score: lastAttempt.score, total: lastAttempt.total, passed: lastAttempt.passed, at: lastAttempt.at } : null,
        weekAttemptCount: weekAttempts.length,
        openMistakeCount: (db.mistakesByStudent?.[studentId] || []).filter((item) => (item.status || "open") === "open").length,
        currentNode: current,
      },
      ...parts,
      text: fixedFormatDiagnosis(parts),
    };
  }

  function saveWeeklyDiagnosis(db, studentId, diagnosis) {
    db.weeklyDiagnosticsByStudent ||= {};
    const currentWeekKey = weekKey(diagnosis.generatedAt);
    const existing = db.weeklyDiagnosticsByStudent[studentId] || [];
    const next = existing.filter((item) => weekKey(item.generatedAt || item.id || "") !== currentWeekKey);
    next.push(diagnosis);
    db.weeklyDiagnosticsByStudent[studentId] = next.sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt)).slice(0, 52);
    return diagnosis;
  }

  function generateWeeklyDiagnostics(db, studentIds = []) {
    const ids = studentIds.length ? studentIds : db.students.map((student) => student.id);
    return ids
      .filter((studentId) => db.students.some((student) => student.id === studentId))
      .map((studentId) => saveWeeklyDiagnosis(db, studentId, buildWeeklyDiagnosis(db, studentId)));
  }

  return {
    buildWeeklyReport,
    buildWeeklyDiagnosis,
    generateWeeklyDiagnostics,
    saveWeeklyDiagnosis,
    buildDailyDiagnosis: buildWeeklyDiagnosis,
    generateDailyDiagnostics: generateWeeklyDiagnostics,
    saveDailyDiagnosis: saveWeeklyDiagnosis,
  };
}
