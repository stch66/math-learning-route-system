import fs from "node:fs/promises";
import path from "node:path";

export function createQuestionBankTools({ a11WrittenTestsDir, practiceQuestionNodesDir }) {
function choice(id, layer, order, prompt, answer, wrongOptions, meta = {}) {
  return {
    id,
    layer,
    order,
    type: "choice",
    prompt,
    options: uniqueOptions(answer, wrongOptions),
    answer,
    status: meta.status || "draft",
    source: meta.source || "rule-generated",
    quality: {
      topic: meta.topic || "",
      answerReason: meta.answerReason || "待老师复核答案理由。",
      distractorDiagnostics: meta.distractorDiagnostics || uniqueOptions(answer, wrongOptions).filter((option) => option !== String(answer)).map((option) => `${option}：待补充错因。`),
      reviewerNote: meta.reviewerNote || "",
    },
  };
}

function a11Spec(nodeId, title) {
  const base = {
    title,
    denominator: 2,
    numerator: 1,
    unit: "1/2",
    context: "巧克力",
    whole: "一个整体",
    equalParts: "两份一样大",
  };
  const specs = {
    "A11-1": { ...base, denominator: 2, unit: "1/2", context: "巧克力", equalParts: "两份一样大" },
    "A11-2": { ...base, denominator: 3, unit: "1/3", context: "彩带", equalParts: "三份一样长" },
    "A11-3": { ...base, denominator: 4, unit: "1/4", context: "投票卡", equalParts: "四份一样大" },
    "A11-4": { ...base, focus: "numerator", numerator: 3, denominator: 5, unit: "3/5", context: "披萨" },
    "A11-5": { ...base, focus: "denominator", numerator: 2, denominator: 6, unit: "2/6", context: "蛋糕" },
    "A11-6": { ...base, focus: "partWhole", numerator: 3, denominator: 8, unit: "3/8", context: "彩带" },
    "A11-7": { ...base, focus: "area", numerator: 3, denominator: 4, unit: "3/4", context: "方格图" },
    "A11-8": { ...base, focus: "set", numerator: 4, denominator: 6, unit: "4/6", context: "一组物品" },
    "A11-9": { ...base, focus: "numberLine", numerator: 2, denominator: 5, unit: "2/5", context: "数轴" },
    "A11-10": { ...base, focus: "unitFraction", numerator: 1, denominator: 6, unit: "1/6", context: "巧克力" },
    "A11-11": { ...base, focus: "nonUnitFraction", numerator: 3, denominator: 7, unit: "3/7", context: "彩带" },
    "A11-12": { ...base, focus: "equivalentPic", numerator: 1, denominator: 2, unit: "1/2", equivalent: "2/4", context: "图形" },
    "A11-13": { ...base, focus: "equivalentMul", numerator: 2, denominator: 3, unit: "2/3", equivalent: "4/6", context: "分数卡" },
    "A11-14": { ...base, focus: "equivalentDiv", numerator: 4, denominator: 8, unit: "4/8", equivalent: "1/2", context: "分数卡" },
    "A11-15": { ...base, focus: "simplify", numerator: 6, denominator: 8, unit: "6/8", equivalent: "3/4", context: "分数卡" },
    "A11-16": { ...base, focus: "sameDenCompare", numerator: 3, denominator: 8, unit: "3/8", compare: "5/8", answerCompare: "5/8", context: "同分母分数" },
    "A11-17": { ...base, focus: "sameNumCompare", numerator: 3, denominator: 4, unit: "3/4", compare: "3/8", answerCompare: "3/4", context: "同分子分数" },
    "A11-18": { ...base, focus: "halfCompare", numerator: 3, denominator: 8, unit: "3/8", compare: "1/2", answerCompare: "小于 1/2", context: "基准数" },
    "A11-19": { ...base, focus: "commonDenCompare", numerator: 2, denominator: 3, unit: "2/3", compare: "3/5", answerCompare: "2/3", context: "通分比较" },
    "A11-20": { ...base, focus: "lineCompare", numerator: 3, denominator: 4, unit: "3/4", compare: "2/4", answerCompare: "3/4", context: "数轴" },
    "A11-21": { ...base, focus: "greaterThanOne", numerator: 5, denominator: 4, unit: "5/4", context: "大于1的分数" },
    "A11-22": { ...base, focus: "improperToMixed", numerator: 7, denominator: 3, unit: "7/3", equivalent: "2 1/3", context: "假分数" },
    "A11-23": { ...base, focus: "mixedToImproper", numerator: 2, denominator: 3, unit: "2 1/3", equivalent: "7/3", context: "带分数" },
    "A11-24": { ...base, focus: "mixedNumberLine", numerator: 1, denominator: 4, unit: "1 1/4", context: "数轴上的带分数" },
  };
  return specs[nodeId] || base;
}

async function customPrimaryQuestions(routeNodeIds = null) {
  const shouldLoadNode = (nodeId) => !routeNodeIds || routeNodeIds.has(nodeId);
  const result = {};
  async function loadWrittenNode(nodeId) {
    if (!shouldLoadNode(nodeId)) return;
    const filePath = path.join(a11WrittenTestsDir, `${nodeId}七层书面测试15min打印版.html`);
    try {
      result[nodeId] = buildQuestionsFromWrittenHtml(nodeId, await fs.readFile(filePath, "utf8"));
    } catch (error) {
      // Older written-test exports are optional: the reviewed practice-node bank can replace them.
      if (error?.code !== "ENOENT") throw error;
    }
  }
  for (let index = 1; index <= 33; index += 1) {
    await loadWrittenNode(`A5-${index}`);
  }
  for (let index = 1; index <= 11; index += 1) {
    await loadWrittenNode(`A6-${index}`);
  }
  for (let index = 1; index <= 30; index += 1) {
    await loadWrittenNode(`A7-${index}`);
  }
  for (let index = 1; index <= 29; index += 1) {
    await loadWrittenNode(`A8-${index}`);
  }
  for (let index = 1; index <= 25; index += 1) {
    const nodeId = `A9-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 25; index += 1) {
    const nodeId = `A10-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 24; index += 1) {
    const nodeId = `A11-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 24; index += 1) {
    const nodeId = `A12-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 24; index += 1) {
    const nodeId = `A13-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 9; index += 1) {
    const nodeId = `A14-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 15; index += 1) {
    const nodeId = `A15-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 29; index += 1) {
    const nodeId = `A16-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 15; index += 1) {
    const nodeId = `A17-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (let index = 1; index <= 14; index += 1) {
    const nodeId = `A18-${index}`;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  for (const nodeId of await practiceNodeIdsForSeries(["A", "B", "C", "D", "E"])) {
    if (!shouldLoadNode(nodeId)) continue;
    result[nodeId] = await buildQuestionsFromPracticeMarkdown(nodeId);
  }
  return result;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractWrittenPrompts(html) {
  const layerByGate = {
    concept: "概念层",
    model: "模型层",
    mental: "快速反应层",
    written: "规范层",
    application: "应用层",
  };
  const prompts = [];
  const starts = [...html.matchAll(/<div class="task gate gate-(concept|model|mental|written|application)"/g)]
    .map((match) => ({ gate: match[1], index: match.index }));
  for (let i = 0; i < starts.length; i += 1) {
    const { gate, index } = starts[i];
    const nextIndex = starts[i + 1]?.index ?? html.length;
    const block = html.slice(index, nextIndex);
    const layer = layerByGate[gate];
    let order = 1;
    for (const pMatch of block.matchAll(/<p><strong>\d+\.<\/strong>\s*([\s\S]*?)<\/p>/g)) {
      prompts.push({ layer, layerKey: gate, order: order++, prompt: stripHtml(pMatch[1]) });
    }
  }
  return prompts;
}

function uniqueOptions(answer, wrongOptions) {
  const options = [];
  const fallback = ["不能判断", "只看一个数字", "需要重新读题", "随便猜"];
  for (const option of [answer, ...wrongOptions, ...fallback]) {
    const text = String(option);
    if (text && !options.includes(text)) options.push(text);
  }
  return options.slice(0, 4);
}

function rangeNodeIds(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

async function practiceNodeIdsForSeries(seriesPrefixes) {
  const prefixes = new Set(seriesPrefixes);
  const files = await fs.readdir(practiceQuestionNodesDir);
  return [...new Set(files
    .map((file) => practiceMarkdownNodeIdFromFile(file))
    .filter((nodeId) => nodeId && prefixes.has(nodeId[0])))]
    .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
}

const vettedPracticeNodeIds = new Set([
  ...rangeNodeIds("A9", 25),
  ...rangeNodeIds("A10", 25),
  ...rangeNodeIds("A11", 24),
  ...rangeNodeIds("A12", 24),
  ...rangeNodeIds("A13", 24),
  ...rangeNodeIds("A14", 9),
  ...rangeNodeIds("A15", 15),
  ...rangeNodeIds("A16", 29),
  ...rangeNodeIds("A17", 15),
  ...rangeNodeIds("A18", 14),
]);

function isVettedPracticeNode(nodeId) {
  return vettedPracticeNodeIds.has(nodeId) || /^[A-E]\d+-\d+(?:\.\d+)?$/.test(nodeId);
}

const vettedPrimaryModules = new Set(["A11"]);
const draftPrimaryModules = new Set(["A5", "A9", "A12"]);
const riskyAnswerPatterns = [
  /先读题/,
  /数量关系/,
  /图要对应/,
  /模型要表示/,
  /随便/,
  /不用读/,
  /只看第一个数字/,
];
const openTaskPatterns = [
  /^画/,
  /画.*图/,
  /说明/,
  /解释/,
  /给同桌/,
  /自己编/,
  /标出/,
  /写出.*理由/,
  /讲给/,
];

function baseQuestionStatus(nodeId, question) {
  const moduleCode = nodeId.split("-")[0];
  if (riskyAnswerPatterns.some((pattern) => pattern.test(String(question.answer || "")))) return "hidden";
  if (vettedPrimaryModules.has(moduleCode)) return "vetted";
  if (draftPrimaryModules.has(moduleCode)) return "draft";
  return "hidden";
}

function annotateQuestionQuality(nodeId, question, overrides = {}) {
  const originalPrompt = String(question.prompt || "");
  const rewrittenPrompt = openTaskPatterns.some((pattern) => pattern.test(originalPrompt))
    ? `做这题时，哪种做法是对的？（原题：${originalPrompt}）`
    : originalPrompt;
  const normalizedQuestion = { ...question, prompt: rewrittenPrompt };
  const wrongOptions = (question.options || []).filter((option) => String(option) !== String(question.answer));
  return {
    ...normalizedQuestion,
    status: overrides.status || baseQuestionStatus(nodeId, normalizedQuestion),
    source: overrides.source || question.source || "written-html-rule",
    quality: {
      topic: question.quality?.topic || `${nodeId} ${question.layer || ""}`,
      answerReason: question.quality?.answerReason || `正确答案是“${question.answer}”。老师复核时请确认题干、选项和答案唯一。`,
      distractorDiagnostics: question.quality?.distractorDiagnostics || wrongOptions.map((option) => `${option}：可能对应概念混淆、计算失误或审题错误。`),
      reviewerNote: question.quality?.reviewerNote || (rewrittenPrompt !== originalPrompt ? `已从开放任务改写为选择题。原题：${originalPrompt}` : ""),
    },
  };
}

function annotateQuestionSet(nodeId, questions, overrides = {}) {
  return questions.map((question) => annotateQuestionQuality(nodeId, question, overrides));
}

function expressionAnswers(prompt) {
  const answers = [];
  for (const match of prompt.matchAll(/(\d+)\s*([+\-])\s*(\d+)\s*=\s*[（(　_]*\s*[）)]?/g)) {
    const left = Number(match[1]);
    const right = Number(match[3]);
    answers.push(match[2] === "+" ? left + right : left - right);
  }
  return answers;
}

function arithmeticOptions(answer) {
  const n = Number(answer);
  if (!Number.isFinite(n)) return ["多 1", "少 1", "不能判断"];
  return [String(n + 1), String(Math.max(0, n - 1)), String(n + 2)];
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return String(Math.round(value * 1000) / 1000).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function numberOptions(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ["多算一步", "少算一步", "不能判断"];
  const step = Math.abs(n) >= 100 ? 10 : Math.abs(n) >= 10 ? 1 : 0.1;
  return [formatNumber(n + step), formatNumber(Math.max(0, n - step)), formatNumber(n + 2 * step)];
}

function evalSimpleExpression(prompt) {
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*([+\-×x÷])\s*(\d+(?:\.\d+)?)(?:\s*([+\-])\s*(\d+(?:\.\d+)?))?/i);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[3]);
  let value;
  if (match[2] === "+") value = a + b;
  else if (match[2] === "-") value = a - b;
  else if (match[2] === "×" || match[2].toLowerCase() === "x") value = a * b;
  else value = a / b;
  if (match[4] && match[5]) {
    const c = Number(match[5]);
    value = match[4] === "+" ? value + c : value - c;
  }
  return { value, op: match[2], a, b };
}

function estimateNumber(value) {
  const n = Number(value);
  if (n >= 100) return nearestHundred(n);
  if (n >= 10) return nearestTen(n);
  return Math.round(n);
}

function genericWrittenChoice(nodeId, layer, order, prompt) {
  let answer = "先读题，找数量关系，再选择合适方法";
  let wrong = ["只看第一个数字", "把所有数字随便相加", "不用检查"];
  const expr = evalSimpleExpression(prompt);
  const division = prompt.match(/(\d+)\s*÷\s*(\d+)/);

  if (/估|大约|≈|接近/.test(prompt) && expr) {
    const a = estimateNumber(expr.a);
    const b = estimateNumber(expr.b);
    let value;
    if (expr.op === "+") value = a + b;
    else if (expr.op === "-") value = a - b;
    else if (expr.op === "×" || String(expr.op).toLowerCase() === "x") value = a * b;
    else value = a / b;
    answer = `约 ${formatNumber(value)}`;
    wrong = [`约 ${formatNumber(value + 1)}`, `约 ${formatNumber(Math.max(0, value - 1))}`, `约 ${formatNumber(expr.a + expr.b)}`];
  } else if (expr && /[=（(]|快速算|口算|列式|规范写出|竖式|精确|结果/.test(prompt)) {
    answer = formatNumber(expr.value);
    wrong = numberOptions(expr.value);
  } else if (division && /余数/.test(prompt)) {
    const a = Number(division[1]);
    const b = Number(division[2]);
    answer = String(a % b);
    wrong = [String(b), String((a % b) + 1), "不能大于除数"];
  } else if (/数位对齐|相同位值|小数点对齐/.test(prompt)) {
    answer = "相同数位对齐";
    wrong = ["只把右边对齐", "只看小数点左边", "随便排整齐"];
  } else if (/加法|合起来|又来|新到|一共/.test(prompt) && /减法|拿走|借走|搬走|还剩/.test(prompt)) {
    answer = "变多用加法，变少用减法";
    wrong = ["所有题都用加法", "所有题都用减法", "只看数字大小"];
  } else if (/用加法检查|用减法检查|检查/.test(prompt)) {
    answer = "用逆运算检查结果是否合理";
    wrong = ["只看答案长短", "不用检查", "把答案再抄一遍"];
  } else if (/完整答句|单位/.test(prompt)) {
    answer = "写清结果和单位";
    wrong = ["只写数字", "只写单位", "不用答句"];
  }

  return choice(`${nodeId}-${layer}-${order}`.replace(/[^\w.-]+/g, "-"), layer, order, prompt, answer, uniqueOptions(answer, wrong));
}

function mathMcqRewriteChoice(nodeId, layer, order, prompt) {
  let answer = "先找题目中的数量关系，再选择对应的运算或模型";
  let wrong = ["只把出现的数字随便相加", "只看第一个数字", "不用读问题"];
  const expr = evalSimpleExpression(prompt);
  const multiplication = prompt.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i);
  const division = prompt.match(/(\d+(?:\.\d+)?)\s*÷\s*(\d+(?:\.\d+)?)/);
  const percentOf = prompt.match(/(\d+(?:\.\d+)?)\s*的\s*(\d+(?:\.\d+)?)%/);
  const percentFormula = prompt.match(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)%\s*×\s*(\d+(?:\.\d+)?)/);
  const ratio = prompt.match(/(\d+)\s*:\s*(\d+)/);

  if (/为什么|解释|理由/.test(prompt)) {
    if (/除法事实|倒推|3×（ ）=总数/.test(prompt)) {
      answer = "因为乘法和除法互为逆运算";
      wrong = ["因为乘法答案一定更大", "因为除法不用看总数", "因为 3 可以随便换"];
    } else if (/相同加数|写成.*×|乘法/.test(prompt)) {
      answer = "因为有相同的组，每组数量一样";
      wrong = ["因为只要有两个数字就能乘", "因为加法不能表示数量", "因为答案一定更大"];
    } else if (/平均分|每份一样/.test(prompt)) {
      answer = "每份必须一样多";
      wrong = ["每份可以不一样", "先分到的人可以多", "只要总数一样就行"];
    } else if (/余数/.test(prompt)) {
      answer = "余数必须小于除数，否则还能再分一组";
      wrong = ["余数可以大于除数", "余数必须等于除数", "余数不用检查"];
    } else if (/小数点|位值|2\.6 可以写成 2\.60/.test(prompt)) {
      answer = "因为 2.6 和 2.60 大小相同，便于数位对齐";
      wrong = ["因为 2.60 比 2.6 大", "因为小数点可以随便移动", "因为只算整数部分"];
    } else if (/百分数.*单位|百分数能不能/.test(prompt)) {
      answer = "不能直接带单位，百分数表示两个量的比率";
      wrong = ["能直接带单位，因为有数字", "只能带米，不能带个", "百分数表示具体个数"];
    } else if (/比表示关系|顺序换/.test(prompt)) {
      answer = "比表示两个量的对应关系，顺序改变意义会变";
      wrong = ["比一定表示总数", "顺序改变意义不变", "比只表示较大的数"];
    } else if (/速度乘时间得到路程/.test(prompt)) {
      answer = "每小时走的路程乘小时数，就是总路程";
      wrong = ["速度加时间就是路程", "速度除以时间就是路程", "只看时间就能知道路程"];
    }
  } else if (/几组.*每组|每组几个|这里有几组/.test(prompt)) {
    const groupMatch = prompt.match(/(\d+)\s*[张个本盒盘].*每[张个本盒盘]\s*(\d+)/);
    if (groupMatch) {
      answer = `${groupMatch[1]} 组，每组 ${groupMatch[2]} 个`;
      wrong = [`${groupMatch[2]} 组，每组 ${groupMatch[1]} 个`, `${Number(groupMatch[1]) + Number(groupMatch[2])} 组`, "不能判断组数"];
    } else {
      answer = "先找有几组，再找每组几个";
      wrong = ["先把两个数字相加", "只看总数", "不用找每组"];
    }
  } else if (/平均分给.*必须怎样|必须怎样才算平均分/.test(prompt)) {
    answer = "每个盘子分到的一样多";
    wrong = ["先分的盘子多一点", "最后一个盘子少一点", "只要总数是 12 就行"];
  } else if (/除以\s*5.*余数可以是\s*6|余数可以是 6/.test(prompt)) {
    answer = "不可以，余数必须小于 5";
    wrong = ["可以，因为 6 比 5 大", "可以，余数随便写", "不可以，余数必须等于 5"];
  } else if (/先增加，再减少|新到.*发给|先增加/.test(prompt)) {
    answer = "先加新到的，再减发出的";
    wrong = ["先减发出的，再不加", "只算新到的", "三个数直接相加"];
  } else if (/2:3 是在比较|顺序换成 3:2/.test(prompt)) {
    answer = "比较前一个量和后一个量，顺序换了意义会变";
    wrong = ["只表示一共有 5 份", "顺序换了意义完全一样", "只表示后一个量"];
  } else if (/画|数轴|位值表|条形图|比例表|方阵|流程图|数组|小棒|米尺/.test(prompt)) {
    if (/比例表|双数轴|对应/.test(prompt)) {
      answer = "模型要表示两个量的对应关系和倍数变化";
      wrong = ["只画一个数字", "把不对应的格子连起来", "不用标单位量"];
    } else if (/百分|100 格|0% 到 100%/.test(prompt)) {
      answer = "模型要把整体看成 100 份";
      wrong = ["模型只画 10 份", "随便涂几格", "不用表示整体"];
    } else if (/小数|十分|百分|数轴/.test(prompt)) {
      answer = "模型要表示小数所在的位值或位置";
      wrong = ["只画整数部分", "小数点可以不标", "不用平均分"];
    } else if (/平均分|每.*一组|每.*一份/.test(prompt)) {
      answer = "模型要表示每份一样多或每组一样多";
      wrong = ["每份可以不同", "只画总数不用分组", "不用检查剩下几个"];
    } else {
      answer = "图要对应题目中的数量和关系";
      wrong = ["只要图好看就行", "可以少画一个量", "不用标每份表示什么"];
    }
  } else if (/百分位|十分位|小数点右边/.test(prompt)) {
    answer = /百分位/.test(prompt) ? "小数点右边第二位" : "小数点右边第一位";
    wrong = /百分位/.test(prompt) ? ["小数点右边第一位", "小数点左边第一位", "任意一位"] : ["小数点右边第二位", "小数点左边第一位", "最后一位"];
  } else if (/10 个 0\.1/.test(prompt)) {
    answer = "1";
    wrong = ["0.10", "0.01", "10"];
  } else if (/0\.1 更接近 0 还是 1/.test(prompt)) {
    answer = "更接近 0";
    wrong = ["更接近 1", "正好一样近", "不能判断"];
  } else if (/35% 比一半/.test(prompt)) {
    answer = "小";
    wrong = ["大", "一样", "不能判断"];
  } else if (/35%.*分母是 100|35%.*分数/.test(prompt)) {
    answer = "35/100";
    wrong = ["35/10", "100/35", "0.35/100"];
  } else if (/35%.*小数/.test(prompt)) {
    answer = "0.35";
    wrong = ["3.5", "35", "0.035"];
  } else if (/35%.*取其中多少份|完成了 35%/.test(prompt)) {
    answer = "35 份";
    wrong = ["65 份", "100 份", "0.35 份"];
  } else if (percentFormula) {
    const value = Number(percentFormula[1]) * Number(percentFormula[2]) / 100 * Number(percentFormula[3]);
    answer = formatNumber(value);
    wrong = [formatNumber(value / Number(percentFormula[3])), formatNumber(Number(percentFormula[1]) + Number(percentFormula[2]) + Number(percentFormula[3])), formatNumber(value * 10)];
  } else if (percentOf) {
    const value = Number(percentOf[1]) * Number(percentOf[2]) / 100;
    answer = formatNumber(value);
    wrong = [formatNumber(Number(percentOf[1]) + Number(percentOf[2])), formatNumber(Number(percentOf[1]) * Number(percentOf[2])), formatNumber(value / 10)];
  } else if (/小于 80 还是大于 80/.test(prompt)) {
    answer = "小于 80";
    wrong = ["大于 80", "等于 80", "不能判断"];
  } else if (/本金、利率、时间/.test(prompt)) {
    answer = "本金 500 元，利率 4%，时间 2 年";
    wrong = ["本金 4%，利率 500 元，时间 2 年", "本金 500 元，利率 2%，时间 4 年", "本金 2 元，利率 4%，时间 500 年"];
  } else if (/本息一共/.test(prompt)) {
    answer = "540 元";
    wrong = ["40 元", "500 元", "504 元"];
  } else if (ratio && /橙汁变 4/.test(prompt)) {
    answer = "6 杯";
    wrong = ["5 杯", "4 杯", "8 杯"];
  } else if (/6:9 是否和 2:3/.test(prompt)) {
    answer = "是，6:9 化简后是 2:3";
    wrong = ["不是，因为数字不同", "不是，因为 6+9 不等于 2+3", "不能判断"];
  } else if (/每本书多少钱/.test(prompt)) {
    answer = "9 元";
    wrong = ["18 元", "5 元", "45 元"];
  } else if (/3 本书应是 27 元还是 30 元/.test(prompt)) {
    answer = "27 元";
    wrong = ["30 元", "23 元", "45 元"];
  } else if (/65 和 4 分别是什么/.test(prompt)) {
    answer = "65 是速度，4 是时间";
    wrong = ["65 是时间，4 是速度", "65 是路程，4 是速度", "65 和 4 都是路程"];
  } else if (/4 个 3|重复出现的加数|重复了几次/.test(prompt)) {
    answer = "重复加数是 3，重复了 4 次";
    wrong = ["重复加数是 4，重复了 3 次", "重复加数是 7，重复了 1 次", "没有相同加数"];
  } else if (/每次加几/.test(prompt) && /3、6、9、12/.test(prompt)) {
    answer = "每次加 3";
    wrong = ["每次加 4", "每次加 6", "每次加 12"];
  } else if (/每个.*8|3×8/.test(prompt) && /3\\+8/.test(prompt)) {
    answer = /两个答案一样吗/.test(prompt) ? "不一样，3×8=24，3+8=11" : "3×8";
    wrong = /两个答案一样吗/.test(prompt) ? ["一样，都是 11", "一样，都是 24", "不能计算"] : ["3+8", "8-3", "8÷3"];
  } else if (/每个|每盘|每张|每盒|每组/.test(prompt) && /通常要先想/.test(prompt)) {
    answer = "先想有几组、每组几个";
    wrong = ["先把两个数字相加", "先找最大的数", "先看题目长不长"];
  } else if (division && /余数范围应该是 0 到几/.test(prompt)) {
    const divisor = Number(division[2]);
    answer = `0 到 ${divisor - 1}`;
    wrong = [`0 到 ${divisor}`, `1 到 ${divisor}`, `0 到 ${divisor + 1}`];
  } else if (division && /余数|商|几组|每份|每个盘子/.test(prompt)) {
    const a = Number(division[1]);
    const b = Number(division[2]);
    const q = Math.floor(a / b);
    const r = a % b;
    answer = r ? `${q}……${r}` : String(q);
    wrong = r ? [`${q + 1}……${r}`, `${q}……${r + 1}`, String(q)] : numberOptions(q);
  } else if (expr && /估|大约|≈|接近/.test(prompt)) {
    const a = estimateNumber(expr.a);
    const b = estimateNumber(expr.b);
    let value;
    if (expr.op === "+") value = a + b;
    else if (expr.op === "-") value = a - b;
    else if (expr.op === "×" || String(expr.op).toLowerCase() === "x") value = a * b;
    else value = a / b;
    answer = `约 ${formatNumber(value)}`;
    wrong = [`约 ${formatNumber(value + 1)}`, `约 ${formatNumber(Math.max(0, value - 1))}`, `约 ${formatNumber(expr.a + expr.b)}`];
  } else if (expr) {
    answer = formatNumber(expr.value);
    wrong = numberOptions(expr.value);
  } else if (/加还是减|哪些题需要加，哪些题需要减/.test(prompt)) {
    answer = "合起来、又来、新到用加；拿走、搬走、借走用减";
    wrong = ["所有题都用加法", "所有题都用减法", "只看哪个数字大"];
  } else if (/标准量/.test(prompt)) {
    answer = "80 是标准量";
    wrong = ["80 是结果", "30% 是标准量", "没有标准量"];
  } else if (/30% 可以先写成什么小数/.test(prompt)) {
    answer = "0.3";
    wrong = ["3", "0.03", "30"];
  } else if (/单位量/.test(prompt)) {
    answer = "先找 1 份对应多少";
    wrong = ["先找最大数", "先把两个数相加", "不用看对应关系"];
  } else {
    return genericWrittenChoice(nodeId, layer, order, prompt);
  }

  return choice(`${nodeId}-${layer}-${order}`.replace(/[^\w.-]+/g, "-"), layer, order, prompt, answer, uniqueOptions(answer, wrong));
}

function a5PromptChoice(nodeId, layer, order, prompt) {
  let answer = "用减法表示拿走、分离或比较差";
  let wrong = ["用加法表示合起来", "随便猜一个数", "只看哪个数字大"];
  const values = expressionAnswers(prompt);
  const firstSub = prompt.match(/(\d+)\s*-\s*(\d+)/);
  const firstAdd = prompt.match(/(\d+)\s*\+\s*(\d+)/);

  if (/为什么.*不用每次都画|为什么.*慢慢记熟/.test(prompt)) {
    answer = "因为熟练后可以直接想减法事实";
    wrong = ["因为不用理解题意", "因为画图一定错", "因为只看第一个数"];
  } else if (values.length >= 2) {
    answer = values.join("，");
    wrong = [
      values.map((value) => value + 1).join("，"),
      values.map((value) => Math.max(0, value - 1)).join("，"),
      values.slice().reverse().join("，"),
    ];
  } else if (values.length === 1) {
    answer = String(values[0]);
    wrong = arithmeticOptions(values[0]);
  } else if (/这里的\s*9\s*表示/.test(prompt)) {
    answer = "原来一共有 9 块，吃掉 3 块，还剩 6 块";
    wrong = ["9 表示吃掉，3 表示还剩，6 表示原来", "9、3、6 都表示答案", "只需要知道 6"];
  } else if (/为什么叫“拿走”|拿走后问题通常问什么/.test(prompt)) {
    answer = "从原来的数量里去掉一部分，通常问还剩多少";
    wrong = ["把两部分合起来，通常问一共多少", "比较谁更高，通常问谁最大", "把东西平均分，通常问每份多少"];
  } else if (/为什么叫“分离”/.test(prompt)) {
    answer = "总数被分成两部分，知道一部分，求另一部分";
    wrong = ["两部分合起来求总数", "只比较大小", "只数颜色"];
  } else if (/比较差|相差/.test(prompt) && /为什么/.test(prompt)) {
    answer = "是在比较两个数量差多少";
    wrong = ["是在求一共有多少", "是在平均分", "是在找最大数"];
  } else if (/减号|表示什么/.test(prompt)) {
    answer = "减号表示去掉、分离或比较差";
    wrong = ["减号表示合起来", "减号表示平均分", "减号没有意义"];
  } else if (/拿走以后，结果会比原来大还是小/.test(prompt)) {
    answer = "小，因为去掉了一部分";
    wrong = ["大，因为又增加了", "一样大，因为没变化", "不能判断"];
  } else if (/从\s*(\d+)\s*往回跳\s*(\d+)\s*步，落到哪里/.test(prompt)) {
    const match = prompt.match(/从\s*(\d+)\s*往回跳\s*(\d+)\s*步，落到哪里/);
    answer = String(Number(match[1]) - Number(match[2]));
    wrong = arithmeticOptions(answer);
  } else if (/划掉|圈出|画 .* 个|用手指|十格框|数轴|三角事实图|策略选择标记|脑中数轴/.test(prompt)) {
    const sub = firstSub ? Number(firstSub[1]) - Number(firstSub[2]) : null;
    answer = sub !== null ? `模型应表示结果 ${sub}` : "模型要表示原来、去掉和剩下";
    wrong = sub !== null ? [`模型应表示结果 ${sub + 1}`, "只画原来，不画去掉", "不用表示剩下"] : ["只画漂亮图案", "不用表示数量关系", "只写题号"];
  } else if (/最熟|记忆办法|互考|自己编|给同桌讲/.test(prompt)) {
    answer = "要说清楚算式、方法和答案";
    wrong = ["只写一个数字", "不用说方法", "不用检查"];
  } else if (/用加法检查|加法能倒回来检查|检查式|检查加不回原数/.test(prompt)) {
    if (firstSub) {
      const a = Number(firstSub[1]);
      const b = Number(firstSub[2]);
      const c = a - b;
      answer = `${c}+${b}=${a}`;
      wrong = [`${a}+${b}=${a + b}`, `${b}-${c}=${b - c}`, `${c}+${a}=${c + a}`];
    } else {
      answer = "差 + 减去的数 = 原来的总数";
      wrong = ["差 - 减去的数 = 原来的总数", "只看答案不用检查", "原数 + 差 = 减去的数"];
    }
  } else if (/事实族|两道加法和两道减法|一图四式/.test(prompt)) {
    answer = "用同三个数写相关的加法和减法";
    wrong = ["只写一道算式", "随便换数字", "只写乘法"];
  } else if (/缺失加数|需要多少才够/.test(prompt)) {
    answer = "想还差多少，可以用减法或想加法";
    wrong = ["只把两个数相加", "不用看问题", "只看第一个数"];
  } else if (/个位不够减|为什么要退位|拆一个十/.test(prompt)) {
    answer = "个位不够减，要把一个十拆成 10 个一";
    wrong = ["个位够减，不需要拆", "只把十位擦掉", "随便借一个数"];
  } else if (/含 0 的退位|0 不够减|从十位借/.test(prompt)) {
    answer = "从十位借 1 个十，换成 10 个一";
    wrong = ["0 可以直接减", "只把 0 改成 4", "不用向十位借"];
  } else if (/十几会变成 10 和几个/.test(prompt)) {
    answer = "变成 10 和个位上的几个";
    wrong = ["变成 1 和 0", "变成两个十", "不能拆开"];
  } else if (/先减到\s*10|先减到 10/.test(prompt)) {
    answer = "先减到 10，再减剩下的数";
    wrong = ["先加到 20", "只减个位", "不用分步"];
  } else if (/用加法想减法/.test(prompt)) {
    answer = "想几加减去的数等于原数";
    wrong = ["把两个数直接相加当答案", "只看原数", "不用检查"];
  } else if (/不同题可以选不同策略/.test(prompt)) {
    answer = "因为数字关系不同，合适的方法会不同";
    wrong = ["所有题必须同一种方法", "方法不重要", "只看题目长短"];
  } else if (/更快的一种|你选哪种|说出策略/.test(prompt)) {
    answer = "选择能又快又准确算出答案的方法";
    wrong = ["选择最长的方法", "选择不用算的方法", "选择看起来漂亮的方法"];
  } else if (/完整答句|单位/.test(prompt)) {
    if (firstSub) {
      answer = `还剩 ${Number(firstSub[1]) - Number(firstSub[2])} 个/块`;
      wrong = ["只写数字不写单位", "把拿走的数当答案", "把原来的数当答案"];
    } else {
      answer = "答句要写清结果和单位";
      wrong = ["只写数字", "只写单位", "不用答句"];
    }
  } else if (/还剩多少|还剩几/.test(prompt) && firstSub) {
    answer = String(Number(firstSub[1]) - Number(firstSub[2]));
    wrong = arithmeticOptions(answer);
  } else if (firstSub) {
    const value = Number(firstSub[1]) - Number(firstSub[2]);
    answer = String(value);
    wrong = arithmeticOptions(value);
  } else if (firstAdd) {
    const value = Number(firstAdd[1]) + Number(firstAdd[2]);
    answer = String(value);
    wrong = arithmeticOptions(value);
  }

  return choice(`${nodeId}-${layer}-${order}`.replace(/[^\w.-]+/g, "-"), layer, order, prompt, answer, uniqueOptions(answer, wrong));
}

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function simplifyFraction(numerator, denominator) {
  if (denominator < 0) return simplifyFraction(-numerator, -denominator);
  const factor = gcd(numerator, denominator);
  return { numerator: numerator / factor, denominator: denominator / factor };
}

function fractionText(numerator, denominator) {
  const f = simplifyFraction(numerator, denominator);
  if (f.denominator === 1) return String(f.numerator);
  return `${f.numerator}/${f.denominator}`;
}

function mixedText(numerator, denominator) {
  const f = simplifyFraction(numerator, denominator);
  if (f.numerator < f.denominator) return `${f.numerator}/${f.denominator}`;
  const whole = Math.floor(f.numerator / f.denominator);
  const rest = f.numerator % f.denominator;
  return rest ? `${whole} 又 ${rest}/${f.denominator}` : String(whole);
}

function fractionWrongOptions(answer) {
  if (/^\d+$/.test(answer)) {
    const n = Number(answer);
    return [String(n + 1), String(Math.max(0, n - 1)), `${n}/1`];
  }
  const match = answer.match(/^(\d+)\/(\d+)$/);
  if (!match) return ["分子分母直接相加", "只看分子", "不能判断"];
  const n = Number(match[1]);
  const d = Number(match[2]);
  return [`${d}/${n}`, `${n + 1}/${d}`, `${n}/${d + 1}`];
}

function nearestTen(value) {
  return Math.round(value / 10) * 10;
}

function nearestHundred(value) {
  return Math.round(value / 100) * 100;
}

function estimateFactor(value) {
  if (value >= 100) return nearestHundred(value);
  if (value >= 20) return nearestTen(value);
  return value;
}

function a9PromptChoice(nodeId, layer, order, prompt) {
  let answer = "先看数位关系，再选择乘法或除法";
  let wrong = ["只看最后一个数字", "随便选一个运算", "只写答案不用检查"];
  const multiplication = prompt.match(/(\d+)\s*[×x]\s*(\d+)/i);
  const division = prompt.match(/(\d+)\s*÷\s*(\d+)/);

  if (/拆成哪两部分/.test(prompt) && multiplication) {
    const left = Number(multiplication[1]);
    const right = Number(multiplication[2]);
    const tens = Math.floor(left / 10) * 10;
    const ones = left - tens;
    answer = `${tens}×${right} 和 ${ones}×${right}`;
    wrong = [`${left}×${tens} 和 ${left}×${ones}`, `${ones}×${right} 和 ${right}×${right}`, "不用拆分"];
  } else if (/不能只算\s*\d+\s*[×x]\s*\d+/.test(prompt)) {
    answer = "还要算十位或百位上的部分";
    wrong = ["个位算完就够了", "只看乘号", "不用看数位"];
  } else if (/部分积|第二行|错一位|对齐十位|实际表示乘多少/.test(prompt)) {
    answer = "十位上的乘数表示几十，部分积要对齐十位";
    wrong = ["第二行一定对齐个位", "十位只表示几个一", "部分积可以随便写"];
  } else if (/余数.*小于除数|为什么.*余数/.test(prompt)) {
    answer = "否则还能再分一组";
    wrong = ["余数可以比除数大", "余数必须等于除数", "余数不用检查"];
  } else if (/用乘法检查|检查除法|检查两位数除法/.test(prompt)) {
    answer = "商×除数，加上余数，应等于被除数";
    wrong = ["商+除数就是被除数", "只看余数", "除法不能检查"];
  } else if (/商的位置/.test(prompt)) {
    answer = "商要写在对应数位上";
    wrong = ["商都写在个位", "商随便写", "只写余数"];
  } else if (/先乘除后加减|四则混合/.test(prompt)) {
    answer = "先算乘除，再算加减";
    wrong = ["从右往左随便算", "先算加减", "只算第一个数"];
  } else if (/两步|多步|先后顺序|关系链/.test(prompt)) {
    answer = "先找第一步要解决什么，再列第二步";
    wrong = ["把所有数字直接相加", "只看最后一句", "不用写单位"];
  } else if (/太大还是太小/.test(prompt) && /398\s*[×x]\s*7/.test(prompt)) {
    answer = "太小";
    wrong = ["太大", "正好", "不能判断"];
  } else if (/可能是\s*286/.test(prompt) && /398\s*[×x]\s*7/.test(prompt)) {
    answer = "不可能，398×7 接近 2800";
    wrong = ["可能，因为 286 很接近", "一定等于 286", "不用估算"];
  } else if (/估|≈|大约|合理/.test(prompt) && multiplication) {
    const left = Number(multiplication[1]);
    const right = Number(multiplication[2]);
    const estimate = estimateFactor(left) * estimateFactor(right);
    answer = `约 ${estimate}`;
    wrong = [`约 ${left + right}`, `约 ${Math.max(0, estimate - right * 10)}`, `约 ${estimate + right * 10}`];
  } else if (/估|≈|大约/.test(prompt) && division) {
    const left = Number(division[1]);
    const right = Number(division[2]);
    const friendly = Math.round(left / right) * right;
    const estimate = Math.round(friendly / right);
    answer = `约 ${estimate}`;
    wrong = [`约 ${estimate + 10}`, `约 ${Math.max(1, estimate - 10)}`, `约 ${left + right}`];
  } else if (/最接近\s*\d+.*倍数/.test(prompt) && division) {
    const left = Number(division[1]);
    const right = Number(division[2]);
    const value = Math.floor(left / right) * right;
    answer = String(value);
    wrong = [String(value + right), String(Math.max(0, value - right)), String(left)];
  } else if (/商和余数|写\s*\d+\s*÷\s*\d+/.test(prompt) && division) {
    const left = Number(division[1]);
    const right = Number(division[2]);
    const quotient = Math.floor(left / right);
    const remainder = left % right;
    answer = `${quotient}……${remainder}`;
    wrong = [`${quotient + 1}……${remainder}`, `${quotient}……${remainder + 1}`, String(Math.round(left / right))];
  } else if (/能装几|还剩几个|每袋|每盒|平均/.test(prompt) && division) {
    const left = Number(division[1]);
    const right = Number(division[2]);
    const quotient = Math.floor(left / right);
    const remainder = left % right;
    answer = `${quotient} 袋，剩 ${remainder} 个`;
    wrong = [`${quotient + 1} 袋，剩 0 个`, `${quotient} 袋，剩 ${remainder + 1} 个`, `${left + right} 个`];
  } else if (prompt.match(/(\d+)\s*[×x]\s*\(\s*\)/i)) {
    answer = "选一个接近目标数的因数";
    wrong = ["随便填 1", "只填最大的数", "不用接近目标"];
  } else if (multiplication) {
    const left = Number(multiplication[1]);
    const right = Number(multiplication[2]);
    const value = left * right;
    answer = String(value);
    wrong = arithmeticOptions(value);
  } else if (division) {
    const left = Number(division[1]);
    const right = Number(division[2]);
    const quotient = Math.floor(left / right);
    const remainder = left % right;
    answer = remainder ? `${quotient}……${remainder}` : String(quotient);
    wrong = remainder ? [`${quotient + 1}……${remainder}`, `${quotient}……${remainder + 1}`, String(quotient)] : arithmeticOptions(quotient);
  }

  return choice(`${nodeId}-${layer}-${order}`.replace(/[^\w.-]+/g, "-"), layer, order, prompt, answer, uniqueOptions(answer, wrong));
}

function a12PromptChoice(nodeId, layer, order, prompt) {
  let answer = "先确定整体，再看分母是否相同";
  let wrong = ["只把分母相加", "只看哪个数字大", "不用看整体"];
  const sameDenominator = prompt.match(/(\d+)\s*\/\s*(\d+)\s*([+\-])\s*(\d+)\s*\/\s*\2/);
  const fractionOp = prompt.match(/(\d+)\s*\/\s*(\d+)\s*([+\-×x÷])\s*(\d+)\s*\/\s*(\d+)/i);
  const integerTimesFraction = prompt.match(/(\d+)\s*[×x]\s*(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)\s*[×x]\s*(\d+)/i);
  const fractionMatch = prompt.match(/(\d+)\s*\/\s*(\d+)/);

  if (/分母不变/.test(prompt)) {
    answer = "因为每份大小相同，只把取的份数相加或相减";
    wrong = ["因为分母要相加", "因为分子不重要", "因为不用平均分"];
  } else if (/分子相加|取的份数怎样变化/.test(prompt)) {
    answer = "取的份数变多";
    wrong = ["每份大小变大", "整体变成两个", "分母相加"];
  } else if (/公分母/.test(prompt) && /1\/3.*1\/4|3 和 4/.test(prompt)) {
    answer = /6 能不能/.test(prompt) ? "不能，6 不是 4 的倍数" : "12";
    wrong = /6 能不能/.test(prompt) ? ["能，因为 6 是 3 的倍数", "能，因为 6 比 4 大", "不能，因为只能用 7"] : ["7", "6", "3"];
  } else if (/改成十二分之几/.test(prompt) && /1\/3.*1\/4/.test(prompt)) {
    answer = "4/12 和 3/12";
    wrong = ["3/12 和 4/12", "1/12 和 1/12", "12/3 和 12/4"];
  } else if (/不能直接.*三等份.*四等份|为什么要通分/.test(prompt)) {
    answer = "因为每份大小不同，要先变成同样大小的份";
    wrong = ["因为分子一定相同", "因为分母要直接相加", "因为只看图形颜色"];
  } else if (/倒数/.test(prompt) && /0/.test(prompt)) {
    answer = "0 没有倒数";
    wrong = ["0 的倒数是 0", "0 的倒数是 1", "0 的倒数是 10"];
  } else if (/3\/4 的倒数/.test(prompt)) {
    answer = "4/3";
    wrong = ["3/4", "1/4", "7/4"];
  } else if (/5 的倒数/.test(prompt)) {
    answer = "1/5";
    wrong = ["5/1", "5", "0/5"];
  } else if (/1 的倒数/.test(prompt)) {
    answer = "1";
    wrong = ["0", "1/2", "没有倒数"];
  } else if (/为什么可以转成乘倒数/.test(prompt)) {
    answer = "因为除以一个分数，就是看里面有几个这样的分数";
    wrong = ["因为分子分母都相加", "因为除法不能算", "因为答案一定变小"];
  } else if (/表示.*里有几个/.test(prompt) && /÷/.test(prompt)) {
    answer = "表示用一个分数去量另一个分数";
    wrong = ["表示把分母相加", "表示只看整数", "表示答案一定小于1"];
  } else if (/比\s*5\/6\s*大还是小/.test(prompt) && /5\/6.*7\/8/.test(prompt)) {
    answer = "小";
    wrong = ["大", "一样大", "不能判断"];
  } else if (/小于\s*1/.test(prompt) && /5\/6.*7\/8/.test(prompt)) {
    answer = "小于 1";
    wrong = ["大于 1", "等于 1", "不能判断"];
  } else if (/接近\s*1\/2、3\/4\s*还是\s*1/.test(prompt)) {
    answer = "3/4";
    wrong = ["1/2", "1", "不能估计"];
  } else if (/7\/6.*超过\s*1|为什么表示超过\s*1/.test(prompt)) {
    answer = "因为 7 个六分之一超过 6 个六分之一";
    wrong = ["因为分母比1大", "因为 7/6 小于1", "因为不用看分子"];
  } else if (/7\/6.*等于几又几分之几|7\/6.*带分数|7\/6 米\s*=/.test(prompt)) {
    answer = "1 又 1/6";
    wrong = ["1 又 2/6", "6 又 1/7", "1/6"];
  } else if (/比\s*1\s*大多少/.test(prompt) && /7\/6/.test(prompt)) {
    answer = "1/6";
    wrong = ["1", "6/7", "7/6"];
  } else if (sameDenominator) {
    const left = Number(sameDenominator[1]);
    const denominator = Number(sameDenominator[2]);
    const right = Number(sameDenominator[4]);
    const numerator = sameDenominator[3] === "+" ? left + right : left - right;
    answer = fractionText(numerator, denominator);
    wrong = fractionWrongOptions(answer);
  } else if (fractionOp) {
    const a = Number(fractionOp[1]);
    const b = Number(fractionOp[2]);
    const op = fractionOp[3];
    const c = Number(fractionOp[4]);
    const d = Number(fractionOp[5]);
    if (op === "+" || op === "-") {
      answer = fractionText(op === "+" ? a * d + c * b : a * d - c * b, b * d);
    } else if (op === "×" || op.toLowerCase() === "x") {
      answer = fractionText(a * c, b * d);
    } else {
      answer = fractionText(a * d, b * c);
    }
    wrong = fractionWrongOptions(answer);
  } else if (integerTimesFraction) {
    const whole = Number(integerTimesFraction[1] || integerTimesFraction[6]);
    const n = Number(integerTimesFraction[2] || integerTimesFraction[4]);
    const d = Number(integerTimesFraction[3] || integerTimesFraction[5]);
    answer = fractionText(whole * n, d);
    wrong = fractionWrongOptions(answer);
  } else if (/求一个数的几分之几|约分后相乘|分数乘|整数乘分数/.test(prompt)) {
    answer = "用乘法，能约分先约分";
    wrong = ["直接把分母相加", "一定用除法", "只看整数"];
  } else if (/分数除法|整数除以分数|分数除以整数|分数除以分数/.test(prompt)) {
    answer = "把除以分数转成乘它的倒数";
    wrong = ["分子分母直接相减", "分母不变只减分子", "答案一定是整数"];
  } else if (/单位量/.test(prompt)) {
    answer = "先找题目里的 1 份或整体";
    wrong = ["只看最大数字", "只看最后一句", "不用找整体"];
  } else if (/画图建模/.test(prompt)) {
    answer = "画出整体、平均分和要求的部分";
    wrong = ["随便画一幅图", "只写答案", "只画颜色"];
  } else if (/结果比1大还是小/.test(prompt) && fractionMatch) {
    answer = Number(fractionMatch[1]) < Number(fractionMatch[2]) ? "小于 1" : "大于或等于 1";
    wrong = answer === "小于 1" ? ["大于 1", "等于 2", "不能判断"] : ["小于 1", "等于 0", "不能判断"];
  } else if (fractionMatch && /化简|最简/.test(prompt)) {
    answer = fractionText(Number(fractionMatch[1]), Number(fractionMatch[2]));
    wrong = fractionWrongOptions(answer);
  } else if (fractionMatch && /带分数/.test(prompt)) {
    answer = mixedText(Number(fractionMatch[1]), Number(fractionMatch[2]));
    wrong = fractionWrongOptions(fractionText(Number(fractionMatch[1]), Number(fractionMatch[2])));
  } else if (fractionMatch) {
    answer = `${fractionMatch[1]}/${fractionMatch[2]}`;
    wrong = [`${fractionMatch[2]}/${fractionMatch[1]}`, `1/${fractionMatch[2]}`, `${fractionMatch[2]}/${fractionMatch[2]}`];
  }

  return choice(`${nodeId}-${layer}-${order}`.replace(/[^\w.-]+/g, "-"), layer, order, prompt, answer, uniqueOptions(answer, wrong));
}

function promptChoice(nodeId, layer, order, prompt) {
  if (nodeId.startsWith("A5-")) return a5PromptChoice(nodeId, layer, order, prompt);
  if (/^(A6|A7|A8|A13|A14|A15)-/.test(nodeId)) return mathMcqRewriteChoice(nodeId, layer, order, prompt);
  if (nodeId.startsWith("A9-")) return a9PromptChoice(nodeId, layer, order, prompt);
  if (nodeId.startsWith("A12-")) return a12PromptChoice(nodeId, layer, order, prompt);
  const spec = a11Spec(nodeId, "");
  const lower = prompt.toLowerCase();
  let answer = "先找整体，再看是否平均分";
  let wrong = ["只看颜色", "随便猜一个答案", "只看哪个数字大"];

  const fillMatch = prompt.match(/平均分成\s*(\d+)\s*份，取\s*(\d+)\s*份/);
  const fractionMatch = prompt.match(/(\d+)\s*\/\s*(\d+)/);
  const mixedMatch = prompt.match(/(\d+)\s*又\s*(\d+)\s*\/\s*(\d+)/);

  if (/每份必须怎样才公平/.test(prompt)) {
    const unit = /彩带|段|长/.test(prompt) ? "一样长" : "一样大";
    answer = unit;
    wrong = ["一份大一份小", "谁先拿谁多", "随便分就行"];
  } else if (fillMatch) {
    answer = `${fillMatch[2]}/${fillMatch[1]}`;
    wrong = [`${fillMatch[1]}/${fillMatch[2]}`, `1/${Number(fillMatch[1]) + 1}`, `${fillMatch[1]}/${fillMatch[1]}`];
  } else if (/画一个整体/.test(prompt) && /平均分成/.test(prompt)) {
    answer = "画出平均分，并涂出题目要求的份数";
    wrong = ["随便画一条线", "只涂颜色不用平均分", "只写答案不画图"];
  } else if (/没有平均分|不能表示/.test(prompt)) {
    answer = "因为没有平均分";
    wrong = ["因为颜色不好看", "因为图太小", "因为没有写姓名"];
  } else if (/比\s*1\s*大还是小/.test(prompt)) {
    answer = "小";
    wrong = ["大", "一样大", "不能判断"];
  } else if (/合起来是几个整体/.test(prompt)) {
    answer = "1 个整体";
    wrong = ["半个整体", "2 个整体", "0 个整体"];
  } else if (/规范写出/.test(prompt) && fractionMatch) {
    answer = "分子写在上面，分母写在下面";
    wrong = ["分母写在上面，分子写在下面", "只写分母", "只写分子"];
  } else if (/写一句话/.test(prompt) && fractionMatch) {
    answer = `把整体平均分成 ${fractionMatch[2]} 份，取 ${fractionMatch[1]} 份`;
    wrong = [`把整体平均分成 ${fractionMatch[1]} 份`, "没有平均分也可以", "只表示一个数字"];
  } else if (/每人得到整体的几分之几/.test(prompt)) {
    const n = (prompt.match(/平均分(?:给|成)\s*(\d+)/) || [])[1] || spec.denominator;
    answer = `1/${n}`;
    wrong = [`${n}/1`, `1/${Number(n) + 1}`, `${n}/${n}`];
  } else if (/自己编/.test(prompt)) {
    answer = "题目里要有整体、平均分和取几份";
    wrong = ["只写一个数字", "不用平均分", "不用说明整体"];
  } else if (/等值分数|大小不变|涂色面积没有变|覆盖同样面积/.test(prompt)) {
    answer = "整体中的大小没有变，只是分得更细";
    wrong = ["分子变大所以一定变大", "分母变大所以一定变小", "颜色变了所以大小变了"];
  } else if (/同时乘\s*3/.test(prompt)) {
    answer = "大小不变";
    wrong = ["变大", "变小", "不能判断"];
  } else if (/同时乘\s*2/.test(prompt)) {
    answer = "分子分母同时乘 2";
    wrong = ["只乘分子", "只乘分母", "同时加 2"];
  } else if (/同时乘|同时除/.test(prompt)) {
    answer = "分子和分母同时乘或除以同一个非0数";
    wrong = ["只改分子", "只改分母", "随便改一个数"];
  } else if (/谁大|谁更大|哪个更大/.test(prompt)) {
    if (/3\/8.*5\/8/.test(prompt)) answer = "5/8";
    else if (/3\/4.*3\/8/.test(prompt)) answer = "3/4";
    else if (/1\/4.*1\/2/.test(prompt)) answer = "1/2";
    else answer = spec.answerCompare || "靠右或取份更多的分数";
    wrong = [spec.compare || spec.unit || "另一个分数", "一样大", "不能比较"];
  } else if (/同分母/.test(prompt) && /比分子|为什么/.test(prompt)) {
    answer = "每份大小一样，所以比较取了几份";
    wrong = ["因为分母越大越大", "因为分子相同", "不用看整体"];
  } else if (/同分子/.test(prompt)) {
    answer = "分子相同，分母越小，每份越大";
    wrong = ["分母越大一定越大", "只看分子", "不能比较"];
  } else if (/7\/4.*大于\s*1|为什么大于\s*1/.test(prompt)) {
    answer = "7 个四分之一超过 1 个整体";
    wrong = ["因为 4 比 7 小所以不用看整体", "因为它小于1", "因为分母是4"];
  } else if (/超过几个完整整体/.test(prompt)) {
    answer = "超过 1 个完整整体";
    wrong = ["没有超过完整整体", "超过 4 个完整整体", "正好 1 个整体"];
  } else if (/7\/4.*1 和 2 之间/.test(prompt)) {
    answer = "是";
    wrong = ["不是", "正好等于1", "正好等于2"];
  } else if (/等于几又几分之几|转成带分数/.test(prompt) && /7\/4/.test(prompt)) {
    answer = "1 又 3/4";
    wrong = ["1 又 1/4", "2 又 3/4", "3 又 1/4"];
  } else if (/1 又 2\/3.*应该在 1 和 2 之间哪里/.test(prompt)) {
    answer = "在 1 和 2 之间，靠近 2";
    wrong = ["在 0 和 1 之间", "正好在 1 上", "正好在 2 上"];
  } else if (/1 又 2\/3.*假分数|对应的假分数/.test(prompt)) {
    answer = "5/3";
    wrong = ["3/5", "4/3", "2/3"];
  } else if (/1 又 2\/3.*接近 1 还是 2/.test(prompt)) {
    answer = "更接近 2";
    wrong = ["更接近 1", "正好在中间", "不能判断"];
  } else if (/不能标在 0 到 1 之间/.test(prompt)) {
    answer = "因为它大于 1";
    wrong = ["因为它小于 1", "因为没有分母", "因为不能用数轴"];
  } else if (/标出|定位/.test(prompt) && /数轴/.test(prompt)) {
    answer = "先找完整数，再按分数部分继续走";
    wrong = ["从0到1随便点", "只看分子", "只看颜色"];
  } else if (/分子/.test(prompt) && /表示|什么/.test(prompt)) {
    answer = "取了几份";
    wrong = ["平均分成几份", "有几个整体", "单位名称"];
  } else if (/分母/.test(prompt) && /表示|什么/.test(prompt)) {
    answer = "整体平均分成几份";
    wrong = ["取了几份", "有几个整体", "单位名称"];
  } else if (fractionMatch && /最简|约分/.test(prompt)) {
    answer = spec.equivalent || "不能再约分";
    wrong = [spec.unit || `${fractionMatch[1]}/${fractionMatch[2]}`, `${fractionMatch[2]}/${fractionMatch[1]}`, "只约分子"];
  } else if (fractionMatch && /转成假分数/.test(prompt) && mixedMatch) {
    answer = `${Number(mixedMatch[1]) * Number(mixedMatch[3]) + Number(mixedMatch[2])}/${mixedMatch[3]}`;
    wrong = [`${Number(mixedMatch[1]) + Number(mixedMatch[2])}/${mixedMatch[3]}`, `${mixedMatch[2]}/${mixedMatch[3]}`, `${mixedMatch[3]}/${mixedMatch[2]}`];
  } else if (/改错|错在哪里/.test(prompt)) {
    answer = "要说明具体关系，不能只看一个数字";
    wrong = ["只要答案长就对", "不用写理由", "只看分母就够"];
  } else if (/检查/.test(prompt)) {
    answer = "检查整体、平均分、取几份和答案是否合理";
    wrong = ["只检查颜色", "只检查字大不大", "不用检查"];
  } else if (fractionMatch) {
    answer = `${fractionMatch[1]}/${fractionMatch[2]}`;
    wrong = [`${fractionMatch[2]}/${fractionMatch[1]}`, `1/${fractionMatch[2]}`, `${fractionMatch[2]}/${fractionMatch[2]}`];
  }

  return choice(`${nodeId}-${layer}-${order}`.replace(/[^\w.-]+/g, "-"), layer, order, prompt, answer, uniqueOptions(answer, wrong));
}

function buildQuestionsFromWrittenHtml(nodeId, html) {
  const questions = extractWrittenPrompts(html).map(({ layer, layerKey, order, prompt }) => ({
    ...promptChoice(nodeId, layer, order, prompt),
    id: `${nodeId}-${layerKey}-${order}`,
  }));
  return annotateQuestionSet(nodeId, questions);
}

function parseDiagnosisTable(markdown) {
  const diagnostics = {};
  const section = markdown.split(/##\s+干扰项诊断/)[1] || "";
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length !== 5 || !/^\d+$/.test(cells[0])) continue;
    diagnostics[Number(cells[0])] = { A: cells[1], B: cells[2], C: cells[3], D: cells[4] };
  }
  return diagnostics;
}

function cleanPracticeOptionText(text) {
  return String(text || "")
    .replace(/[（(]\s*(?:对|错)\s*[:：][^）)]*[）)]\s*$/g, "")
    .replace(/[（(]\s*(?:对|错)[）)]\s*$/g, "")
    .trim();
}

function parsePracticeOptionMeta(text) {
  const raw = String(text || "").trim();
  const mark = raw.match(/[（(]\s*(对|错)\s*[:：]?([^）)]*)[）)]\s*$/);
  return {
    text: cleanPracticeOptionText(raw),
    mark: mark?.[1] || "",
    reason: (mark?.[2] || "").trim(),
  };
}

function parsePracticeQuestionMarkdown(nodeId, markdown) {
  const layerByHeading = {
    Concept: "概念层",
    Model: "模型层",
    Mental: "快速反应层",
    Written: "规范层",
    Application: "应用层",
    "概念层": "概念层",
    "模型层": "模型层",
    "口算层": "快速反应层",
    "快速反应层": "快速反应层",
    "笔算层": "规范层",
    "规范层": "规范层",
    "应用层": "应用层",
  };
  const layerKeyByHeading = {
    Concept: "concept",
    Model: "model",
    Mental: "mental",
    Written: "written",
    Application: "application",
    "概念层": "concept",
    "模型层": "model",
    "口算层": "mental",
    "快速反应层": "mental",
    "笔算层": "written",
    "规范层": "written",
    "应用层": "application",
  };
  const diagnostics = parseDiagnosisTable(markdown);
  const lines = markdown.split(/\r?\n/);
  let layer = "";
  let layerKey = "";
  const questions = [];

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const key = heading[1].replace(/（.*$/, "").trim();
      layer = layerByHeading[key] || key;
      layerKey = layerKeyByHeading[key] || key.toLowerCase();
      continue;
    }
    const questionMatch = lines[index].match(/^\*\*(?:第)?(\d+)题(?:\*\*)?\s*[:：]\s*(.*?)\s*$/)
      || lines[index].match(/^\*\*(\d+)\.\s*(.*?)\*\*\s*$/);
    if (!questionMatch) continue;
    const order = Number(questionMatch[1]);
    const prompt = questionMatch[2].replace(/\*\*\s*$/, "").trim();
    const optionsByLetter = {};
    const optionMetaByLetter = {};
    let answerLetter = "";
    for (let scan = index + 1; scan < Math.min(lines.length, index + 18); scan += 1) {
      const optionMatch = lines[scan].match(/^-?\s*([A-D])\.\s*(.+?)\s*$/);
      if (optionMatch) {
        const meta = parsePracticeOptionMeta(optionMatch[2]);
        optionsByLetter[optionMatch[1]] = meta.text;
        optionMetaByLetter[optionMatch[1]] = meta;
      }
      const answerMatch = lines[scan].match(/^\*?\*?答案[:：]\s*([A-D])\*?\*?\s*$/);
      if (answerMatch) {
        answerLetter = answerMatch[1];
        break;
      }
    }
    const answer = optionsByLetter[answerLetter] || "";
    const wrong = Object.entries(optionsByLetter)
      .filter(([letter]) => letter !== answerLetter)
      .map(([, text]) => text);
    const diag = diagnostics[order] || {};
    const status = isVettedPracticeNode(nodeId) ? "vetted" : "hidden";
    questions.push(choice(`${nodeId}-${layerKey}-${order}`, layer, order, prompt, answer, wrong, {
      status,
      source: "practice-question-nodes",
      topic: `${nodeId} ${layer}`,
      answerReason: optionMetaByLetter[answerLetter]?.reason
        ? `${answerLetter}：${optionMetaByLetter[answerLetter].reason}`
        : diag[answerLetter] ? `${answerLetter}：${diag[answerLetter]}` : `正确答案是“${answer}”。`,
      distractorDiagnostics: Object.entries(optionsByLetter)
        .filter(([letter]) => letter !== answerLetter)
        .map(([letter, text]) => `${letter}. ${text}：${optionMetaByLetter[letter]?.reason || diag[letter] || "干扰项"}`),
    }));
  }

  return questions;
}

async function practiceMarkdownPathForNode(nodeId) {
  const exactPath = path.join(practiceQuestionNodesDir, `${nodeId}.md`);
  try {
    await fs.access(exactPath);
    return exactPath;
  } catch {}
  const files = await fs.readdir(practiceQuestionNodesDir);
  const match = files
    .filter((file) => file.startsWith(`${nodeId}-`) && file.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }))[0];
  if (!match) throw new Error(`Missing practice question markdown for ${nodeId}`);
  return path.join(practiceQuestionNodesDir, match);
}

async function buildQuestionsFromPracticeMarkdown(nodeId) {
  const markdown = await fs.readFile(await practiceMarkdownPathForNode(nodeId), "utf8");
  return parsePracticeQuestionMarkdown(nodeId, markdown);
}

function practiceMarkdownNodeIdFromFile(file) {
  return file.match(/^([A-E]\d+-\d+(?:\.\d+)?)(?:-|\.md$)/)?.[1] || "";
}

async function practiceMarkdownFileMap() {
  const files = await fs.readdir(practiceQuestionNodesDir);
  const map = new Map();
  for (const file of files.sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }))) {
    const nodeId = practiceMarkdownNodeIdFromFile(file);
    if (nodeId && !map.has(nodeId)) map.set(nodeId, path.join(practiceQuestionNodesDir, file));
  }
  return map;
}


  return { customPrimaryQuestions, parsePracticeQuestionMarkdown, practiceMarkdownFileMap };
}
