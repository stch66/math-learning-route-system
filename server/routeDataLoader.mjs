import path from "node:path";
import { createLearningPageTools } from "./learningPages.mjs";
import { createMiddleRouteLoader } from "./middleRouteLoader.mjs";
import { createPrimaryRouteLoader } from "./primaryRouteLoader.mjs";
import { createQuestionBankTools } from "./questionBank.mjs";

export function createRouteDataLoader({ rootDir }) {
  const htmlPath = path.join(rootDir, "小学数学能力依赖路线图-干流支流图-老师全解锁版.html");
  const middleMdPath = path.join(rootDir, "中学数学学习路线图-超细优化版.md");
  const middleDagPath = path.join(rootDir, "middle-math-mastery-dag.json");
  const middleChecksPath = path.join(rootDir, "middle-math-mastery-10q-checks.json");
  const a11WrittenTestsDir = path.join(rootDir, "02A 系列书面测试html");
  const practiceQuestionNodesDir = path.join(rootDir, "practice-question-nodes");

  const { learningPagePaths, discoverLearningPagePaths, titleFromLearningFile } = createLearningPageTools({ rootDir });
  const { customPrimaryQuestions, parsePracticeQuestionMarkdown, practiceMarkdownFileMap } = createQuestionBankTools({
    a11WrittenTestsDir,
    practiceQuestionNodesDir,
  });
  const { loadRouteData } = createPrimaryRouteLoader({
    htmlPath,
    learningPagePaths,
    discoverLearningPagePaths,
    customPrimaryQuestions,
  });
  const { loadMiddleRouteData } = createMiddleRouteLoader({
    middleMdPath,
    middleDagPath,
    middleChecksPath,
    parsePracticeQuestionMarkdown,
    practiceMarkdownFileMap,
  });

  return { learningPagePaths, titleFromLearningFile, loadRouteData, loadMiddleRouteData };
}
