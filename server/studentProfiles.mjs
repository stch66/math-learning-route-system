import fs from "node:fs";
import path from "node:path";

function canonicalName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[｜|].*$/g, "")
    .trim();
}

function studentNameFromFile(fileName) {
  return path.basename(fileName, ".md")
    .replace(/\s*-\s*学业追踪$/u, "")
    .replace(/\s*数学画像$/u, "")
    .replace(/\s*数学$/u, "")
    .trim();
}

function interestingLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("|") && !/^[-:]+$/.test(line))
    .filter((line) => /优势|强项|弱项|薄弱|风险|注意|策略|适合|不适合|目标|判断|能力|习惯|表达|计算|应用|模型|自主|困难|退缩|结构/u.test(line))
    .slice(0, 28);
}

function compactText(text, maxLength = 1800) {
  const lines = interestingLines(text);
  const compact = lines.length ? lines.join("\n") : text.slice(0, maxLength);
  return compact.length > maxLength ? compact.slice(0, maxLength) + "\n..." : compact;
}

export function loadStudentProfiles(rootDir) {
  const dir = path.join(rootDir, "studentspic");
  const profiles = {};
  if (!fs.existsSync(dir)) return profiles;
  for (const fileName of fs.readdirSync(dir)) {
    if (!fileName.endsWith(".md")) continue;
    const name = studentNameFromFile(fileName);
    if (!name) continue;
    const key = canonicalName(name);
    const filePath = path.join(dir, fileName);
    const text = fs.readFileSync(filePath, "utf8");
    profiles[key] ||= { name, files: [], text: "", summary: "" };
    profiles[key].files.push(fileName);
    profiles[key].text += (profiles[key].text ? "\n\n" : "") + text;
  }
  for (const profile of Object.values(profiles)) {
    profile.summary = compactText(profile.text);
  }
  return profiles;
}

export function profileForStudent(student, profiles = {}) {
  if (!student) return null;
  return profiles[canonicalName(student.name)] || profiles[canonicalName(student.username)] || null;
}
