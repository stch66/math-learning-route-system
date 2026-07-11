#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverPath = path.join(rootDir, "math_multiuser_server.mjs");
const uiPagePath = path.join(rootDir, "server", "uiPage.mjs");
const publicDir = path.join(rootDir, "public");
const cssPath = path.join(publicDir, "style.css");
const jsPath = path.join(publicDir, "shared.js");

function requiredIndex(text, needle, fromIndex = 0) {
  const index = text.indexOf(needle, fromIndex);
  if (index < 0) throw new Error(`Could not find marker: ${needle}`);
  return index;
}

let text = await fs.readFile(serverPath, "utf8");
let appPageIndex = text.indexOf("function appPage() {");
if (appPageIndex < 0) {
  text = await fs.readFile(uiPagePath, "utf8");
  appPageIndex = requiredIndex(text, "function appPage() {");
}

const styleOpenMarker = "  <style>\n";
const styleCloseMarker = "  </style>";
const styleOpen = text.indexOf(styleOpenMarker, appPageIndex);
if (styleOpen < 0) {
  await fs.access(cssPath);
  await fs.access(jsPath);
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "appPage already uses extracted frontend assets",
    cssPath: path.relative(rootDir, cssPath),
    jsPath: path.relative(rootDir, jsPath),
  }, null, 2));
  process.exit(0);
}
const styleClose = requiredIndex(text, styleCloseMarker, styleOpen);
const css = text.slice(styleOpen + styleOpenMarker.length, styleClose);

const scriptOpenMarker = "  <script>\n    const ROUTES = ${safeJsonForHtml({";
const routeMetaMarker = "    const ROUTE_META = {";
const scriptCloseMarker = "  </script>";
const scriptOpen = requiredIndex(text, scriptOpenMarker, styleClose);
const routeMetaStart = requiredIndex(text, routeMetaMarker, scriptOpen);
const scriptClose = requiredIndex(text, scriptCloseMarker, routeMetaStart);
const jsBody = text.slice(routeMetaStart, scriptClose);

const appCss = `/* Extracted from math_multiuser_server.mjs appPage().\n   Login-page CSS intentionally remains inline in the server template. */\n${css.trim()}\n`;

const appJs = `/* Extracted from math_multiuser_server.mjs appPage(). */\n(() => {\n  const BOOTSTRAP = window.MATH_APP_DATA || {};\n  const ROUTES = BOOTSTRAP.routes || {};\n  const QUESTION_MODULES = BOOTSTRAP.questionModules || {};\n${jsBody}\n})();\n`;

const styleReplacement = '  <link rel="stylesheet" href="/public/style.css" />';
const scriptReplacement = `  <script>\n    window.MATH_APP_DATA = ${"${safeJsonForHtml({"}\n      routes: {\n        primary: routeData.primary.data,\n        middle: routeData.middle.data,\n      },\n      questionModules: {\n        primary: routeData.primary.questionModules,\n        middle: routeData.middle.questionModules,\n      },\n    })};\n  </script>\n  <script src="/public/shared.js" defer></script>\n  <script src="/public/admin.js" defer></script>\n  <script src="/public/student.js" defer></script>`;

let nextText = text.slice(0, styleOpen)
  + styleReplacement
  + text.slice(styleClose + styleCloseMarker.length, scriptOpen)
  + scriptReplacement
  + text.slice(scriptClose + scriptCloseMarker.length);

await fs.mkdir(publicDir, { recursive: true });
await fs.writeFile(cssPath, appCss, "utf8");
await fs.writeFile(jsPath, appJs, "utf8");
await fs.writeFile(serverPath, nextText, "utf8");

console.log(JSON.stringify({
  ok: true,
  cssBytes: Buffer.byteLength(appCss),
  jsBytes: Buffer.byteLength(appJs),
  serverBytes: Buffer.byteLength(nextText),
}, null, 2));
