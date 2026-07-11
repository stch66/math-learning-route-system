function safeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function createUiPages({ routeData }) {
function loginPage(message = "") {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>数学学习路线 · 登录</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      background:
        linear-gradient(90deg, rgba(49, 135, 200, .08) 1px, transparent 1px),
        linear-gradient(rgba(49, 135, 200, .08) 1px, transparent 1px),
        linear-gradient(135deg, #fff4cd 0%, #eaf7ff 46%, #fff0df 100%);
      background-size: 32px 32px, 32px 32px, auto;
      padding: clamp(18px, 4vw, 48px);
      color: #1f2a37;
      overflow-x: hidden;
    }
    .login-shell {
      width: min(1100px, 100%);
      min-height: calc(100vh - clamp(36px, 8vw, 96px));
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(360px, .82fr);
      gap: clamp(20px, 4vw, 44px);
      align-items: center;
    }
    .math-stage {
      position: relative;
      min-height: 560px;
      border: 2px solid rgba(255, 255, 255, .82);
      border-radius: 28px;
      overflow: hidden;
      background:
        linear-gradient(90deg, rgba(23, 32, 51, .05) 1px, transparent 1px),
        linear-gradient(rgba(23, 32, 51, .05) 1px, transparent 1px),
        linear-gradient(135deg, rgba(255,255,255,.82), rgba(239,247,255,.76));
      background-size: 38px 38px, 38px 38px, auto;
      box-shadow: 0 28px 80px rgba(32, 83, 120, .18);
      padding: clamp(24px, 4vw, 44px);
      display: grid;
      align-content: space-between;
      gap: 24px;
    }
    .math-stage::before {
      content: "";
      position: absolute;
      left: 10%;
      right: 10%;
      top: 53%;
      height: 18px;
      border-radius: 999px;
      background: linear-gradient(90deg, #ef7d1a, #3187c8, #168060, #8a64ba);
      opacity: .24;
      transform: rotate(-6deg);
    }
    .stage-copy { position: relative; z-index: 1; display: grid; gap: 14px; max-width: 560px; }
    .stage-kicker {
      width: max-content;
      max-width: 100%;
      border: 1px solid #b9d9f0;
      border-radius: 999px;
      background: rgba(255,255,255,.78);
      padding: 7px 12px;
      color: #2b74b7;
      font-size: 12px;
      font-weight: 950;
    }
    .stage-title {
      font-size: clamp(38px, 6vw, 76px);
      line-height: .98;
      font-weight: 1000;
      color: #172033;
      letter-spacing: 0;
    }
    .stage-title span { color: #ef7d1a; }
    .stage-text { color: #4d6175; font-size: clamp(15px, 1.7vw, 18px); line-height: 1.65; font-weight: 850; }
    .stage-panel {
      position: relative;
      z-index: 1;
      width: min(520px, 100%);
      border: 1px solid rgba(49, 135, 200, .18);
      border-radius: 22px;
      background: rgba(255,255,255,.82);
      box-shadow: 0 18px 42px rgba(32,83,120,.12);
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .stage-panel-title { color:#172033; font-size:14px; font-weight:950; }
    .stage-flow {
      position: relative;
      min-height: 72px;
      border-radius: 16px;
      background: linear-gradient(180deg,#f8fbff,#fffaf0);
      overflow: hidden;
    }
    .stage-flow::before {
      content: "";
      position: absolute;
      left: 16px;
      right: 16px;
      top: 32px;
      height: 12px;
      border-radius: 999px;
      background: linear-gradient(90deg,#ef7d1a,#3187c8,#168060,#f5a331,#8a64ba);
      opacity: .46;
    }
    .stage-flow span {
      position: absolute;
      top: 22px;
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: #fff;
      border: 1px solid #dbe7f3;
      color: #172033;
      font-weight: 1000;
      box-shadow: 0 8px 18px rgba(32,83,120,.10);
    }
    .stage-flow span:nth-child(1) { left: 10%; }
    .stage-flow span:nth-child(2) { left: 29%; }
    .stage-flow span:nth-child(3) { left: 48%; }
    .stage-flow span:nth-child(4) { left: 67%; }
    .stage-flow span:nth-child(5) { left: 86%; transform: translateX(-100%); }
    .stage-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .stage-stat {
      min-height: 68px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
      padding: 10px;
      display: grid;
      align-content: center;
      gap: 2px;
    }
    .stage-stat strong { color:#0f5f9f; font-size:22px; line-height:1; font-weight:1000; }
    .stage-stat span { color:#64748b; font-size:12px; font-weight:850; }
    .route-strip {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      align-items: stretch;
    }
    .route-tile {
      min-height: 98px;
      border: 2px solid rgba(255,255,255,.86);
      border-top-width: 8px;
      border-radius: 18px;
      background: rgba(255,255,255,.82);
      padding: 12px 10px;
      display: grid;
      align-content: center;
      gap: 4px;
      box-shadow: 0 12px 24px rgba(32,83,120,.10);
    }
    .route-tile strong { font-size: 34px; line-height: 1; font-weight: 1000; }
    .route-tile span { color: #52616f; font-size: 12px; font-weight: 900; line-height: 1.25; }
    .route-a { border-top-color:#ef7d1a; }
    .route-b { border-top-color:#3187c8; }
    .route-c { border-top-color:#168060; }
    .route-d { border-top-color:#f5a331; }
    .route-e { border-top-color:#8a64ba; }
    .card {
      width: min(440px, 100%);
      position: relative;
      z-index: 1;
      background: rgba(255,255,255,.94);
      border: 2px solid rgba(255, 255, 255, .95);
      border-radius: 24px;
      padding: clamp(26px, 4vw, 36px);
      box-shadow: 0 24px 70px rgba(32, 83, 120, .18);
      display: grid;
      gap: 20px;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 8px;
      border-radius: 24px 24px 0 0;
      background: linear-gradient(90deg, #ef7d1a, #3187c8, #168060, #8a64ba);
    }
    .brand { display:grid; gap:8px; text-align:left; }
    .eyebrow { color:#2f80bf; font-size:12px; font-weight:900; letter-spacing:.08em; }
    h1 { color:#21313f; font-size:31px; line-height:1.12; font-weight:950; }
    .subtitle { color:#52616f; font-size:15px; line-height:1.7; font-weight:760; }
    form { display:grid; gap:14px; }
    label { display: grid; gap: 7px; font-weight: 780; font-size: 13px; color: #334155; }
    input {
      min-height: 48px; border: 2px solid #d9e2ea; border-radius: 12px;
      padding: 0 16px; font-size: 15px; font-family: inherit;
      background: #fff; color: #1f2937; font-weight: 600;
      transition: border-color 0.2s, box-shadow 0.2s; outline: none;
    }
    input:focus { border-color: #3187c8; box-shadow: 0 0 0 4px rgba(49, 135, 200, 0.12); }
    input::placeholder { color: #94a3b8; }
    button {
      min-height: 50px; border: 0; border-radius: 12px;
      background: linear-gradient(135deg, #ef7d1a, #e65a26);
      color: white; font-size: 16px; font-weight: 800; font-family: inherit;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(230, 90, 38, 0.22); }
    .message {
      background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px;
      padding: 12px 14px; font-size: 13px; color: #be123c; font-weight: 700;
    }
    .demo {
      background: #f8fbff; border: 1px solid #dbe7f3; border-radius: 12px;
      padding: 12px 14px; font-size: 13px; color: #64748b; line-height: 1.7;
    }
    .demo strong { color: #334155; }
    .hint { font-size: 12px; color: #64748b; }
    body {
      background:
        radial-gradient(circle at 18% 12%, rgba(255,209,102,.22), transparent 26%),
        radial-gradient(circle at 86% 22%, rgba(106,200,255,.22), transparent 28%),
        linear-gradient(180deg, rgba(5,12,35,.30), rgba(4,10,30,.88)),
        url("/assets/student-starry-bg.png") center top / cover fixed,
        #07143d;
      color: #f8fbff;
    }
    .math-stage {
      border: 1px solid rgba(147,197,253,.24);
      background:
        linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px),
        linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
        linear-gradient(145deg, rgba(12,27,72,.74), rgba(6,18,56,.60));
      background-size: 42px 42px, 42px 42px, auto;
      box-shadow: 0 28px 90px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.08);
      backdrop-filter: blur(18px);
    }
    .math-stage::before {
      height: 12px;
      background: linear-gradient(90deg, #ffd166, #6ac8ff, #72e2ad, #caa8ff);
      opacity: .38;
      box-shadow: 0 0 26px rgba(106,200,255,.30);
    }
    .math-stage::after {
      content: "";
      position: absolute;
      right: -72px;
      top: 70px;
      width: 260px;
      height: 260px;
      border-radius: 50%;
      border: 30px solid rgba(255,255,255,.055);
      transform: rotate(-18deg);
    }
    .stage-kicker {
      border-color: rgba(255,209,102,.32);
      background: rgba(255,209,102,.12);
      color: #ffe9a8;
    }
    .stage-title {
      color: #f8fbff;
      text-shadow: 0 10px 32px rgba(0,0,0,.25);
    }
    .stage-title span { color: #ffd166; }
    .stage-text { color: #c9d8ee; }
    .stage-panel {
      border-color: rgba(147,197,253,.24);
      background: rgba(8,22,62,.70);
      box-shadow: 0 22px 54px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .stage-panel-title { color:#f8fbff; }
    .stage-flow {
      background: rgba(3,12,35,.42);
      border: 1px solid rgba(147,197,253,.20);
    }
    .stage-flow::before {
      background: linear-gradient(90deg,#ffd166,#6ac8ff,#72e2ad,#caa8ff);
      opacity: .58;
    }
    .stage-flow span {
      border-color: rgba(255,255,255,.26);
      background: rgba(248,251,255,.95);
      color: #0c1b48;
      border-radius: 50%;
    }
    .stage-stat,
    .route-tile {
      border-color: rgba(147,197,253,.22);
      background: rgba(248,251,255,.95);
      box-shadow: 0 14px 30px rgba(0,0,0,.18);
    }
    .route-tile {
      position: relative;
      overflow: hidden;
      border-top-width: 0;
      border-radius: 22px;
    }
    .route-tile::after {
      content: "";
      position: absolute;
      right: -18px;
      top: -18px;
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: rgba(49,135,200,.10);
    }
    .route-a::after { background: rgba(239,125,26,.16); }
    .route-b::after { background: rgba(49,135,200,.16); }
    .route-c::after { background: rgba(22,128,96,.16); }
    .route-d::after { background: rgba(245,163,49,.16); }
    .route-e::after { background: rgba(138,100,186,.16); }
    .route-tile strong,
    .route-tile span,
    .stage-stat strong,
    .stage-stat span { position: relative; z-index: 1; }
    .card {
      border: 1px solid rgba(147,197,253,.24);
      background: rgba(248,251,255,.96);
      box-shadow: 0 28px 90px rgba(0,0,0,.32);
    }
    .card::before {
      background: linear-gradient(90deg, #ffd166, #6ac8ff, #72e2ad, #caa8ff);
    }
    .eyebrow { color:#155fad; letter-spacing:0; }
    button {
      background: linear-gradient(135deg, #ffd166, #ff7a59);
      color: #1f1331;
      font-weight: 950;
      box-shadow: 0 12px 28px rgba(255,122,89,.22);
    }
    .foot-chip {
      background: linear-gradient(145deg,#fff,#eef7ff);
      color: #155fad;
    }
    .login-foot {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .foot-chip {
      min-height: 54px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
      display: grid;
      place-items: center;
      color: #52616f;
      font-size: 12px;
      font-weight: 900;
      text-align: center;
      padding: 8px;
    }
    @media (max-width: 640px) {
      body { padding: 16px; }
      .login-shell { grid-template-columns: 1fr; min-height: auto; }
      .math-stage { min-height: 320px; padding: 20px; border-radius: 22px; }
      .stage-title { font-size: 42px; }
      .route-strip { grid-template-columns: repeat(5, 1fr); gap: 6px; }
      .route-tile { min-height: 66px; border-radius: 14px; padding: 8px 4px; }
      .route-tile strong { font-size: 24px; }
      .route-tile span { display: none; }
      .stage-panel { padding: 12px; }
      .stage-stats { grid-template-columns: 1fr; }
      .card { padding: 26px 22px; }
      .login-foot { grid-template-columns: 1fr; }
    }
    @media (min-width: 641px) and (max-width: 920px) {
      .login-shell { grid-template-columns: 1fr; max-width: 620px; }
      .math-stage { min-height: 430px; }
      .card { justify-self: center; }
    }
  </style>
</head>
<body>
  <main class="login-shell">
    <section class="math-stage" aria-label="数学学习路线图">
      <div class="stage-copy">
        <div class="stage-kicker">MATH ROUTE</div>
        <div class="stage-title">把数学<br /><span>走成地图</span></div>
        <p class="stage-text">教的越少，学的越多。先搭框架，再添砖瓦。</p>
      </div>
      <div class="stage-panel" aria-hidden="true">
        <div class="stage-panel-title">从当前节点出发，一步步点亮路线</div>
        <div class="stage-flow"><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span></div>
        <div class="stage-stats">
          <div class="stage-stat"><strong>5</strong><span>小学路线</span></div>
          <div class="stage-stat"><strong>10</strong><span>每节点检测题</span></div>
          <div class="stage-stat"><strong>5</strong><span>进度状态</span></div>
        </div>
      </div>
      <div class="route-strip" aria-hidden="true">
        <div class="route-tile route-a"><strong>A</strong><span>数与式</span></div>
        <div class="route-tile route-b"><strong>B</strong><span>测量</span></div>
        <div class="route-tile route-c"><strong>C</strong><span>几何</span></div>
        <div class="route-tile route-d"><strong>D</strong><span>生活</span></div>
        <div class="route-tile route-e"><strong>E</strong><span>综合</span></div>
      </div>
    </section>
    <section class="card">
      <div class="brand">
        <div class="eyebrow">STUDENT LOGIN</div>
        <h1>数学学习路线</h1>
        <p class="subtitle">进入自己的学习地图，查看进度、打开节点、完成检测。</p>
      </div>
      ${message ? `<div class="message">${escapeHtml(message)}</div>` : ""}
      <form method="post" action="/login">
        <label>用户名<input name="username" autocomplete="username" required placeholder="输入用户名" /></label>
        <label>密码<input name="password" type="password" autocomplete="current-password" required placeholder="输入密码" /></label>
        <button type="submit">进入路线</button>
      </form>
      <div class="login-foot">
        <div class="foot-chip">看进度</div>
        <div class="foot-chip">做检测</div>
        <div class="foot-chip">走路线</div>
      </div>
      <div class="demo">
        <strong>学生账号：</strong>用自己的英文名作为用户名和初始密码，登录后请立刻修改密码并记住<br />
        <strong>访客账号：</strong>guest&nbsp;/&nbsp;guest（只读预览）
      </div>
      <p class="hint">学生和家长只能查看自己的进度</p>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function appPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>数学学习路线</title>
  <link rel="manifest" href="/public/manifest.webmanifest" />
  <meta name="theme-color" content="#2f7df6" />
  <link rel="stylesheet" href="/public/style.css" />
</head>
<body>
  <header>
    <div class="top">
      <div>
        <h1><b>数学学习路线</b></h1>
        <div class="sub">登录后选择小学或中学，再进入系列、节点学习和做题。</div>
        <nav class="student-game-menu" id="studentMainNav" aria-label="学生学习导航">
          <button type="button" class="active" data-student-screen="today">今天</button>
          <button type="button" data-student-screen="map">学习地图</button>
          <button type="button" data-student-screen="tasks">任务仓</button>
          <button type="button" data-student-screen="growth">成长</button>
        </nav>
      </div>
      <div class="userbar">
        <span id="who"></span>
        <button id="openPassword" type="button">修改密码</button>
        <a href="/logout"><button type="button">退出</button></a>
      </div>
    </div>
  </header>
  <main>
    <section class="panel controls" id="controlsPanel">
      <button id="toggleStudentTools" class="student-tool-toggle" type="button" aria-expanded="false">搜索与筛选</button>
      <div class="control-row">
        <select id="routeSelect">
          <option value="primary">小学数学路线</option>
          <option value="middle">中学数学路线</option>
        </select>
        <select id="studentSelect"></select>
        <input id="search" type="search" placeholder="搜索节点、模块、前置能力" />
        <select id="statusFilter">
          <option value="unfinished">未完成</option>
          <option value="all">全部状态</option>
          <option value="not_started">未开始</option>
          <option value="in_progress">进行中</option>
          <option value="mastered">已掌握</option>
          <option value="forgotten">已遗忘</option>
          <option value="skipped">跳过</option>
          <option value="unlocked">已解锁</option>
        </select>
        <button id="expandAll" type="button">展开全部</button>
        <button id="collapseAll" type="button">折叠全部</button>
      </div>
      <form id="createStudent" class="teacher-create">
        <input name="name" placeholder="学生姓名" required />
        <input name="username" placeholder="学生用户名" required />
        <input name="password" placeholder="学生初始密码" required />
        <input name="level" placeholder="级别/备注" />
        <button class="primary" type="submit">添加学生账号</button>
      </form>
      <section class="teacher-tools teacher-wide" id="teacherTools">
        <div class="tool-card">
          <h3>布置指定作业</h3>
          <div id="assignmentAlerts" class="assignment-alerts"></div>
          <div class="assignment-student-picker" id="assignmentStudents"></div>
          <div class="assignment-form">
            <div class="control-row">
              <input id="assignmentTitle" placeholder="作业标题，可留空" />
              <input id="assignmentNodes" placeholder="节点，如 A9-1 A9-2" />
              <input id="assignmentDueDate" type="date" />
            </div>
            <input id="assignmentNote" placeholder="给学生看的备注，例如：先做这两关，不急着往后跳" />
            <div class="control-row">
              <button id="createAssignment" class="primary" type="button">布置作业</button>
              <button id="fillCurrentNodeAssignment" type="button">填入当前查看节点</button>
            </div>
          </div>
          <div id="assignmentMessage" class="message-line"></div>
          <div id="assignmentList" class="assignment-list"></div>
        </div>
        <div class="tool-card">
          <h3>批量管理进度</h3>
          <div class="student-checks" id="batchStudents"></div>
          <div class="control-row">
            <input id="batchNode" placeholder="节点，如 A9-1" />
            <select id="batchStatus">
              <option value="in_progress">进行中</option>
              <option value="mastered">已掌握</option>
              <option value="forgotten">已遗忘</option>
              <option value="skipped">跳过</option>
              <option value="not_started">未开始</option>
            </select>
            <label><input id="batchPrevious" type="checkbox" checked /> 前面节点设为已掌握</label>
            <button id="applyBatch" class="primary" type="button">批量应用</button>
          </div>
          <div id="batchMessage" class="message-line"></div>
        </div>
        <div class="tool-card">
          <h3>每周报告 / 回滚</h3>
          <div id="weeklyReport" class="weekly-report"></div>
          <div class="control-row">
            <button id="refreshReport" type="button">刷新报告</button>
            <button id="generateWeeklyDiagnosis" type="button">生成每周诊断</button>
            <button id="rollbackLast" class="danger" type="button">回滚该学生最近一次进度操作</button>
          </div>
          <div id="rollbackMessage" class="message-line"></div>
        </div>
        <div class="tool-card">
          <h3>小学解锁规则</h3>
          <div class="weekly-report">
            <div><strong>当前学生：</strong><span id="unlockStudentName">-</span></div>
            <div><strong>默认：</strong>逐节点解锁，过一关再开下一关。</div>
          </div>
          <label>整体规则
            <select id="primaryGlobalUnlockMode">
              <option value="sequential">按 ABCDE 各自规则</option>
              <option value="all_free">全小学路线自由选择</option>
            </select>
          </label>
          <div class="unlock-series-grid" id="primarySeriesUnlocks"></div>
          <div class="control-row">
            <button id="saveUnlockPolicy" class="primary" type="button">保存解锁规则</button>
          </div>
          <div id="unlockPolicyMessage" class="message-line"></div>
        </div>
        <div class="tool-card">
          <h3>登录记录查询</h3>
          <div class="control-row">
            <input id="loginLogUsername" placeholder="用户名，可留空" />
            <select id="loginLogLimit">
              <option value="100">最近100条</option>
              <option value="300">最近300条</option>
              <option value="1000">最近1000条</option>
            </select>
            <button id="refreshLoginLog" type="button">查询</button>
          </div>
          <div id="loginLogMessage" class="message-line"></div>
          <div id="loginLogTable" class="log-table"></div>
        </div>
      </section>
    </section>
    <section class="student-focus panel" id="studentFocus"></section>
    <section class="metrics" id="metrics"></section>
    <section class="panel" id="familyReportPanel">
      <div class="section-title">
        <div>
          <h2>学习报告</h2>
          <p>每周诊断、本周已学和下周建议会根据当前进度自动生成。</p>
        </div>
      </div>
      <div id="familyReport" class="weekly-report"></div>
    </section>
    <section class="panel" id="mistakeBookPanel">
      <div class="section-title">
        <div>
          <h2 id="mistakeBookTitle">错题本</h2>
          <p id="mistakeBookHint">检测中做错的题会自动记录在这里。</p>
        </div>
      </div>
      <div id="mistakeBook" class="mistake-book"></div>
    </section>
    <section class="map-shell" id="mapPanel">
      <div class="hero">
        <h2 id="routeTitle">小学数学路线</h2>
        <p id="routeSubtitle">每一块都是一片学习大陆，点进去就能看到下一站。</p>
        <div class="legend"><span>拼图块大小 ≈ 节点数量</span><span>颜色 = 学习系列</span><span>绿色标签 = 已掌握</span></div>
      </div>
      <div class="puzzle-map" id="puzzleMap"></div>
      <div class="series-cards" id="seriesCards"></div>
    </section>
    <section class="panel" id="routeNavPanel">
      <div class="section-title">
        <div>
          <h2 id="modulesTitle">全部路线模块</h2>
          <p id="modulesHint">也可以直接从下面打开模块。</p>
        </div>
        <button id="showOverview" type="button">回到当前路线</button>
      </div>
      <div class="series-tabs" id="seriesTabs"></div>
    </section>
    <section class="modules" id="modules"></section>
    <div class="empty hidden" id="empty">没有匹配的节点。</div>
  </main>
  <dialog id="nodeDialog">
    <div class="dialog-body">
      <div class="dialog-top">
        <h2 class="dialog-title" id="dialogTitle"></h2>
        <button id="closeDialog" type="button">关闭</button>
      </div>
      <div class="detail-grid" id="details"></div>
      <div>
        <strong>学习进展</strong>
        <div class="progress-actions" id="progressActions"></div>
        <div class="history" id="history"></div>
      </div>
      <div id="practice"></div>
    </div>
  </dialog>
  <dialog id="passwordDialog" class="password-dialog">
    <div class="dialog-body">
      <div class="dialog-top">
        <h2 class="dialog-title">修改密码</h2>
        <button id="closePassword" type="button">关闭</button>
      </div>
      <form id="passwordForm" class="password-form">
        <label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required /></label>
        <label>新密码<input name="newPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
        <label>确认新密码<input name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required /></label>
        <button class="primary" type="submit">保存新密码</button>
        <div id="passwordMessage" class="message-line"></div>
      </form>
    </div>
  </dialog>
  <script>
    window.MATH_APP_DATA = ${safeJsonForHtml({
      routes: {
        primary: routeData.primary.data,
        middle: routeData.middle.data,
      },
      questionModules: {
        primary: routeData.primary.questionModules,
        middle: routeData.middle.questionModules,
      },
    })};
  </script>
  <script src="/public/shared.js" defer></script>
  <script src="/public/admin.js" defer></script>
  <script src="/public/student.js" defer></script>
  <script src="/public/pwa.js" defer></script>
</body>
</html>`;
}

return { loginPage, appPage };
}
