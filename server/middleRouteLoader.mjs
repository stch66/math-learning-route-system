import fs from "node:fs/promises";

export function createMiddleRouteLoader({ middleMdPath, middleDagPath, middleChecksPath, parsePracticeQuestionMarkdown, practiceMarkdownFileMap }) {
function parseMiddleModuleTitles(markdown) {
  const titles = {};
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^##\s+([A-Z]\d+)\.\s+(.+)$/);
    if (match) titles[match[1]] = match[2].trim();
  }
  return titles;
}

function normalizeOpenQuestions(check) {
  const questions = [];
  let index = 1;
  for (const [layer, prompts] of Object.entries(check.questions || {})) {
    for (const prompt of prompts || []) {
      questions.push({
        id: `${check.id}-q${index++}`,
        layer,
        prompt,
        open: true,
        status: "vetted",
        source: "middle-math-mastery-10q-checks",
        quality: {
          topic: `${check.id} ${layer}`,
          answerReason: "开放检测题：由学生书写或口头说明，老师根据表现记录掌握情况。",
          distractorDiagnostics: [],
          reviewerNote: "中学路线开放题默认对学生显示，不参与自动批改。",
        },
      });
    }
  }
  return questions;
}

async function loadMiddleRouteData() {
  const [markdown, dagText, checksText] = await Promise.all([
    fs.readFile(middleMdPath, "utf8"),
    fs.readFile(middleDagPath, "utf8"),
    fs.readFile(middleChecksPath, "utf8"),
  ]);
  const moduleTitles = parseMiddleModuleTitles(markdown);
  const dag = JSON.parse(dagText);
  const checks = JSON.parse(checksText);
  const checksById = Object.fromEntries(checks.map((item) => [item.id, item]));
  const practiceMarkdownById = await practiceMarkdownFileMap();
  const grouped = new Map();
  const practiceById = {};
  const questionModules = {};

  for (const item of dag) {
    const moduleCode = item.id.split("-")[0];
    if (!grouped.has(moduleCode)) grouped.set(moduleCode, []);
    const check = checksById[item.id] || {};
    const markdownPath = practiceMarkdownById.get(item.id);
    const questions = markdownPath
      ? parsePracticeQuestionMarkdown(item.id, await fs.readFile(markdownPath, "utf8"))
      : normalizeOpenQuestions(check);
    grouped.get(moduleCode).push({
      code: item.id,
      skill: item.title,
      prereq: item.prerequisites?.length ? item.prerequisites.join("、") : "无",
      source: check.risk_tags?.join("、") || "",
      mastery: item.mastery_check || "",
    });
    practiceById[item.id] = {
      title: item.title,
      module: item.module,
      moduleCode,
      type: item.type,
      high_risk_refined: Boolean(check.high_risk),
      high_risk_reason: check.risk_tags?.join("、") || "",
      prerequisites: item.prerequisites || [],
      supports: item.supports || [],
      parallel_with: item.parallel_with || [],
      pass_score: 8,
      total_questions: questions.length || check.question_count || 10,
    };
    questionModules[moduleCode] ||= {};
    questionModules[moduleCode][item.id] = questions;
  }

  const modules = [...grouped.entries()].map(([code, nodes]) => ({
    code,
    title: moduleTitles[code] || nodes[0]?.skill || code,
    line: code.slice(0, 1),
    nodes,
  }));

  return {
    data: {
      title: "中学数学路线",
      teacherMode: false,
      modules,
      practice: {
        policy: {
          pass_score: 8,
          total_questions: 10,
          note: "中学题库当前为开放题文本，先用于学习检测与老师记录；选择题答案版加入后可自动批改。",
        },
        byId: practiceById,
      },
    },
    questionModules,
  };
}

  return { loadMiddleRouteData };
}
