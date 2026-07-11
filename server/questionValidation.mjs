export function validateAutoGradableQuestions(nodeId, questions = []) {
  const issues = [];
  const warnings = [];
  if (!questions.length) {
    issues.push("学生端没有可见题目");
    return { issues, warnings };
  }
  const ids = new Set();
  for (const question of questions) {
    const id = String(question.id || "").trim();
    const label = id || `${nodeId} 未命名题目`;
    if (!id) issues.push(`${label} 缺少题目 ID`);
    if (id && ids.has(id)) issues.push(`${label} 题目 ID 重复`);
    if (id) ids.add(id);
    if (!String(question.prompt || "").trim()) issues.push(`${label} 缺少题干`);
    if (!Array.isArray(question.options) || question.options.length < 2) {
      issues.push(`${label} 不是可自动批改的选择题`);
      continue;
    }
    const options = question.options.map((option) => String(option || "").trim());
    if (options.some((option) => !option)) issues.push(`${label} 存在空选项`);
    if (options.length !== 4) warnings.push(`${label} 选项数不是 4 个`);
    if (new Set(options).size !== options.length) issues.push(`${label} 存在重复选项`);
    const answer = String(question.answer || "").trim();
    if (!answer) issues.push(`${label} 缺少正确答案`);
    else if (!options.includes(answer)) issues.push(`${label} 正确答案不在选项中`);
  }
  return { issues, warnings };
}
