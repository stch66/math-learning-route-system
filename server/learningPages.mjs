import fs from "node:fs/promises";
import path from "node:path";

export function createLearningPageTools({ rootDir }) {
const learningPagePaths = {
  "A5-1": path.join(rootDir, "mathteacher", "A5-1-understand-take-away.html"),
  "A5-2": path.join(rootDir, "mathteacher", "A5-2-understand-separation.html"),
  "A5-3": path.join(rootDir, "mathteacher", "A5-3-understand-difference.html"),
  "A5-4": path.join(rootDir, "mathteacher", "A5-4-subtraction-sign.html"),
  "A5-5": path.join(rootDir, "mathteacher", "A5-5-subtraction-equation.html"),
  "A5-6": path.join(rootDir, "mathteacher", "A5-6-explaining-difference.html"),
  "A5-7": path.join(rootDir, "mathteacher", "A5-7-subtraction-within-5.html"),
  "A5-8": path.join(rootDir, "mathteacher", "A5-8-subtraction-within-10.html"),
  "A5-9": path.join(rootDir, "mathteacher", "A5-9-subtract-zero.html"),
  "A5-10": path.join(rootDir, "mathteacher", "A5-10-number-minus-itself.html"),
  "A5-11": path.join(rootDir, "mathteacher", "A5-11-find-difference-with-pictures.html"),
  "A5-12": path.join(rootDir, "mathteacher", "A5-12-verify-subtraction-with-addition.html"),
  "A5-13": path.join(rootDir, "mathteacher", "A5-13-missing-addend.html"),
  "A5-14": path.join(rootDir, "mathteacher", "A5-14-fact-family.html"),
  "A5-15": path.join(rootDir, "mathteacher", "A5-15-subtract-two-additions-two-subtractions.html"),
  "A5-16": path.join(rootDir, "mathteacher", "A5-16-subtraction-within-20-no-borrow.html"),
  "A5-17": path.join(rootDir, "mathteacher", "A5-17-subtraction-within-20-borrow.html"),
  "A5-18": path.join(rootDir, "mathteacher", "A5-18-subtract-to-10.html"),
  "A5-19": path.join(rootDir, "mathteacher", "A5-19-use-addition-to-subtract.html"),
  "A5-20": path.join(rootDir, "mathteacher", "A5-20-subtraction-mental-strategies.html"),
  "A11-1": path.join(rootDir, "mathteacher", "A11-1-chocolate-half.html"),
  "A11-2": path.join(rootDir, "mathteacher", "A11-2-ribbon-thirds.html"),
  "A11-3": path.join(rootDir, "mathteacher", "A11-3-vote-quarters.html"),
  "A11-4": path.join(rootDir, "mathteacher", "A11-4-numerator-understanding.html"),
  "A11-5": path.join(rootDir, "mathteacher", "A11-5-denominator-understanding.html"),
  "A11-6": path.join(rootDir, "mathteacher", "A11-6-fraction-whole-part.html"),
  "A11-7": path.join(rootDir, "mathteacher", "A11-7-area-model.html"),
  "A11-8": path.join(rootDir, "mathteacher", "A11-8-set-model.html"),
  "A11-9": path.join(rootDir, "mathteacher", "A11-9-number-line-model.html"),
  "A11-10": path.join(rootDir, "mathteacher", "A11-10-unit-fraction.html"),
  "A11-11": path.join(rootDir, "mathteacher", "A11-11-non-unit-fraction.html"),
};
const learningPageTitles = {
  "A5-1": "位值王国探险记：理解拿走",
  "A5-2": "位值王国探险记：理解分离",
  "A5-3": "位值王国探险记：理解比较差",
  "A5-4": "位值王国探险记：减号的意义",
  "A5-5": "位值王国探险记：减法算式",
  "A5-6": "位值王国探险记：解释差的含义",
  "A5-7": "位值王国探险记：5以内减法",
  "A5-8": "位值王国探险记：10以内减法",
  "A5-9": "位值王国探险记：减0",
  "A5-10": "位值王国探险记：一个数减自己",
  "A5-11": "位值王国探险记：用图求差",
  "A5-12": "位值王国探险记：用加法检查减法",
  "A5-13": "位值王国探险记：解决缺失加数问题",
  "A5-14": "位值王国探险记：认识事实族",
  "A5-15": "位值王国探险记：一图四式",
  "A5-16": "剧场管理员：20以内不退位减法",
  "A5-17": "图书管理员的整理术：20以内退位减法",
  "A5-18": "贴纸收藏家的秘密：先减到10",
  "A5-19": "糖果师傅：用加法想减法",
  "A5-20": "心算大师：减法心算策略",
  "A11-1": "巧克力王国探险记：认识一半",
  "A11-2": "彩带王国探险记：认识三等分",
  "A11-3": "投票王国探险记：认识四等分",
  "A11-4": "披萨王国探险记：理解分子",
  "A11-5": "蛋糕王国探险记：理解分母",
  "A11-6": "彩带王国探险记：理解分数表示整体的部分",
  "A11-7": "面积模型王国探险记：分数模型技能1",
  "A11-8": "披萨公平分王国：分数模型技能2",
  "A11-9": "巧克力数轴王国探险记：分数模型技能3",
  "A11-10": "单位分数巧克力王国：认识单位分数",
  "A11-11": "彩带分数王国探险记：认识非单位分数",
};

async function discoverLearningPagePaths() {
  const discovered = {};
  try {
    const files = await fs.readdir(path.join(rootDir, "mathteacher"));
    for (const file of files) {
      const match = file.match(/^([A-Z]\d+-\d+)(?:[-.].*)?\.html$/);
      if (!match) continue;
      const nodeId = match[1];
      discovered[nodeId] ||= path.join(rootDir, "mathteacher", file);
    }
  } catch {
    // Learning pages are optional assets; missing folder should not stop the app.
  }
  return { ...discovered, ...learningPagePaths };
}

function titleFromLearningFile(filePath, nodeId) {
  const base = path.basename(filePath, ".html").replace(`${nodeId}-`, "");
  return learningPageTitles[nodeId] || (base ? base.replace(/[-_]+/g, " ") : "学习活动");
}

  return { learningPagePaths, discoverLearningPagePaths, titleFromLearningFile };
}
