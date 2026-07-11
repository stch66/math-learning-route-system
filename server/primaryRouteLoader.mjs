import fs from "node:fs/promises";

export function createPrimaryRouteLoader({ htmlPath, learningPagePaths, discoverLearningPagePaths, customPrimaryQuestions }) {
async function loadRouteData() {
  const html = await fs.readFile(htmlPath, "utf8");
  const dataMatch = html.match(/const DATA = (.*?);\n/);
  if (!dataMatch) throw new Error("无法从老师全解锁版 HTML 中读取 DATA。");
  const data = JSON.parse(dataMatch[1]);
  const questionModules = {};
  const scriptRegex = /<script type="application\/json" id="practice-module-([^"]+)">(.*?)<\/script>/gs;
  for (const match of html.matchAll(scriptRegex)) {
    questionModules[match[1]] = JSON.parse(match[2]);
  }
  const customQuestions = await customPrimaryQuestions(new Set(Object.keys(data.practice.byId)));
  for (const [nodeId, questions] of Object.entries(customQuestions)) {
    const moduleCode = nodeId.split("-")[0];
    questionModules[moduleCode] ||= {};
    questionModules[moduleCode][nodeId] = questions;
  }
  const discoveredLearningPages = await discoverLearningPagePaths();
  Object.assign(learningPagePaths, discoveredLearningPages);
  for (const nodeId of Object.keys(discoveredLearningPages)) {
    if (!data.practice.byId[nodeId]) continue;
    data.practice.byId[nodeId] = {
      ...data.practice.byId[nodeId],
      pass_score: data.practice.byId[nodeId].pass_score ?? 8,
      total_questions: data.practice.byId[nodeId].total_questions ?? 10,
    };
  }
  data.teacherMode = false;
  return { data, questionModules };
}

  return { loadRouteData };
}
