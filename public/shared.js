/* Extracted from math_multiuser_server.mjs appPage(). */
(() => {
  const BOOTSTRAP = window.MATH_APP_DATA || {};
  const ROUTES = BOOTSTRAP.routes || {};
  const QUESTION_MODULES = BOOTSTRAP.questionModules || {};
    const ROUTE_META = {
      primary: { label: "小学数学路线", subtitle: "从数感、四则运算、分数小数到应用题，一步步打基础。" },
      middle: { label: "中学数学路线", subtitle: "从有理数、代数、函数、几何到建模，按依赖顺序推进。" },
    };
    const ABILITY_LAYERS = [
      { key: "concept", code: "概念", label: "概念", layer: "概念层" },
      { key: "model", code: "模型", label: "模型", layer: "模型层" },
      { key: "mental", code: "心算", label: "心算", layer: "快速反应层" },
      { key: "standard", code: "规范", label: "规范", layer: "规范层" },
      { key: "application", code: "应用", label: "应用", layer: "应用层" },
    ];
    const SERIES = {
      A: { code: "A", name: "数与式基础核心", short: "数感、加减乘除、分数小数", className: "puzzle-a" },
      B: { code: "B", name: "单位与测量系统", short: "长度、面积、体积和单位换算", className: "puzzle-b" },
      C: { code: "C", name: "几何与空间系统", short: "图形、角、空间想象", className: "puzzle-c" },
      D: { code: "D", name: "生活应用与时间系统", short: "时间、钱币、日常问题", className: "puzzle-d" },
      E: { code: "E", name: "综合应用与关系系统", short: "应用题、比例、数据与关系", className: "puzzle-e" },
    };
    const progressMeta = {
      not_started: { label: "未开始", className: "status-not_started" },
      in_progress: { label: "进行中", className: "status-in_progress" },
      mastered: { label: "已掌握", className: "status-mastered" },
      forgotten: { label: "已遗忘", className: "status-forgotten" },
      skipped: { label: "跳过", className: "status-skipped" },
    };
    const reviewMeta = {
      vetted: { label: "已复核", className: "review-vetted" },
      draft: { label: "草稿", className: "review-draft" },
      hidden: { label: "已隐藏", className: "review-hidden" },
    };
    const state = { me: null, students: [], activeStudentId: "", progress: {}, assignments: [], assignmentAlerts: [], mistakes: [], query: "", status: "unfinished", routeKey: "primary", activeSeries: "all", studentViewMode: "today", studentScreen: "today", studentToolsOpen: false, studentReportOpen: false, collapsed: new Set(), currentNode: null, report: null, weeklyDiagnosis: null, questionReviewSummary: {}, unlockPoliciesByStudent: {}, abilityRadarResetAtByStudent: {}, loginLogs: [] };
    const byId = (id) => document.getElementById(id);
    const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
    const OFFLINE_CACHE_PREFIX = "mathRoute.apiCache:";
    const OFFLINE_ATTEMPT_QUEUE = "mathRoute.offlineAttemptQueue";
    const OFFLINE_LAST_USER = "mathRoute.lastUserId";
    const offlineJson = {
      read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return fallback; }
      },
      write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
      },
    };
    function cacheKeyForApi(url) {
      if (url === "/api/bootstrap") {
        const userId = state.me?.id || localStorage.getItem(OFFLINE_LAST_USER) || "anonymous";
        return OFFLINE_CACHE_PREFIX + "bootstrap:" + userId;
      }
      return OFFLINE_CACHE_PREFIX + url;
    }
    function cacheApiResponse(url, value) {
      if (!String(url).startsWith("/api/")) return;
      if (url === "/api/bootstrap" && value?.user?.id) {
        localStorage.setItem(OFFLINE_LAST_USER, value.user.id);
        offlineJson.write(OFFLINE_CACHE_PREFIX + "bootstrap:" + value.user.id, { cachedAt: new Date().toISOString(), value });
        return;
      }
      offlineJson.write(cacheKeyForApi(url), { cachedAt: new Date().toISOString(), value });
    }
    function readCachedApiResponse(url) {
      if (url === "/api/bootstrap") {
        const userId = localStorage.getItem(OFFLINE_LAST_USER) || "";
        return userId ? offlineJson.read(OFFLINE_CACHE_PREFIX + "bootstrap:" + userId, null)?.value || null : null;
      }
      return offlineJson.read(cacheKeyForApi(url), null)?.value || null;
    }
    function offlineQueueKey() {
      return OFFLINE_ATTEMPT_QUEUE + ":" + (state.activeStudentId || state.me?.studentId || localStorage.getItem(OFFLINE_LAST_USER) || "default");
    }
    function queuedOfflineAttempts() {
      return offlineJson.read(offlineQueueKey(), []);
    }
    function saveOfflineAttempts(queue) {
      offlineJson.write(offlineQueueKey(), queue);
      document.body?.classList.toggle("has-offline-queue", Boolean(queue.length));
    }
    function queueOfflineAttempt(payload) {
      const queue = queuedOfflineAttempts();
      const item = {
        ...payload,
        clientAttemptId: payload.clientAttemptId || "web-offline-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2),
        clientCreatedAt: payload.clientCreatedAt || new Date().toISOString(),
      };
      queue.push(item);
      saveOfflineAttempts(queue.slice(-100));
      return item;
    }
    async function syncOfflineAttempts() {
      if (!navigator.onLine) return;
      const queue = queuedOfflineAttempts();
      if (!queue.length) return;
      const remaining = [];
      for (const item of queue) {
        try {
          const res = await fetch("/api/attempt", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
          });
          if (!res.ok) throw new Error("sync failed");
        } catch {
          remaining.push(item);
        }
      }
      saveOfflineAttempts(remaining);
      if (remaining.length !== queue.length && state.activeStudentId) {
        try {
          await loadProgress();
          await loadAssignments();
          await loadReport();
          await loadMistakes();
          renderAll();
        } catch {}
      }
    }
    function localAttemptResult(payload) {
      const questions = ((QUESTION_MODULES[payload.routeKey || state.routeKey] || {})[String(payload.nodeId || "").split("-")[0]]?.[payload.nodeId] || questionsFor(payload.nodeId)).filter(question => state.me?.role === "teacher" || question.status === "vetted");
      const results = {};
      let score = 0;
      questions.forEach((question) => {
        const ok = String(payload.answers?.[question.id] || "").trim() === String(question.answer || "").trim();
        results[question.id] = ok;
        if (ok) score += 1;
      });
      const total = questions.length;
      const passed = score >= Math.min(8, total);
      const failedLayers = [...new Set(questions.filter((question) => !results[question.id]).map((question) => question.layer))];
      const recommendations = passed ? [] : unmetPrerequisites(payload.nodeId).slice(0, 6);
      state.progress ||= {};
      const existing = state.progress[payload.nodeId] || { status: "not_started", history: [], attempts: [] };
      const attempt = {
        at: new Date().toISOString(),
        clientAttemptId: payload.clientAttemptId,
        score,
        total,
        passed,
        answers: payload.answers || {},
        results,
        failedLayers,
        recommendations,
        by: state.me?.id || "offline",
      };
      state.progress[payload.nodeId] = {
        ...existing,
        status: passed ? "mastered" : "in_progress",
        updatedAt: attempt.at,
        updatedBy: attempt.by,
        attempts: [...(existing.attempts || []), attempt],
        history: [...(existing.history || []), { status: passed ? "mastered" : "in_progress", at: attempt.at, by: attempt.by, source: "offline-attempt", score, total }],
      };
      if (state.activeStudentId) cacheApiResponse("/api/progress?studentId=" + encodeURIComponent(state.activeStudentId), { progress: state.progress });
      return { score, total, passed, results, failedLayers, recommendations, completedAssignments: [], offlineQueued: true };
    }
    const api = async (url, options = {}) => {
      const method = String(options.method || "GET").toUpperCase();
      const requestOptions = { headers: { "content-type": "application/json" }, ...options };
      try {
        const res = await fetch(url, requestOptions);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "请求失败");
        const data = await res.json();
        if (method === "GET") cacheApiResponse(url, data);
        return data;
      } catch (error) {
        if (method === "GET") {
          const cached = readCachedApiResponse(url);
          if (cached) return cached;
        }
        if (method === "POST" && url === "/api/attempt") {
          const payload = JSON.parse(options.body || "{}");
          const queued = queueOfflineAttempt(payload);
          return localAttemptResult(queued);
        }
        throw error;
      }
    };
    const readyCallbacks = [];
    const mathApp = {
      api,
      byId,
      escapeHtml,
      get ready() { return Boolean(state.me); },
      get state() { return state; },
      onReady(callback) {
        if (typeof callback !== "function") return;
        if (mathApp.ready) callback(mathApp);
        else readyCallbacks.push(callback);
      },
      renderAll: () => renderAll(),
      openNode: (code) => openNode(code),
      openAssignmentNode: (code, routeKey) => openAssignmentNode(code, routeKey),
    };
    window.MathApp = mathApp;
    window.addEventListener("online", () => syncOfflineAttempts().catch(() => {}));
    saveOfflineAttempts(queuedOfflineAttempts());
    function notifyReady() {
      window.dispatchEvent(new CustomEvent("math-app-ready", { detail: mathApp }));
      while (readyCallbacks.length) {
        const callback = readyCallbacks.shift();
        try {
          callback(mathApp);
        } catch (error) {
          console.error(error);
        }
      }
    }
    function route() { return ROUTES[state.routeKey] || ROUTES.primary; }
    function routeQuestions() { return QUESTION_MODULES[state.routeKey] || QUESTION_MODULES.primary; }
    function applyQuestionReviewOverrides(routeKey, reviews) {
      const modules = QUESTION_MODULES[routeKey] || {};
      Object.entries(reviews || {}).forEach(([key, review]) => {
        const [reviewRoute, nodeId, questionId] = key.split(":");
        if (reviewRoute !== routeKey) return;
        const question = modules[nodeId.split("-")[0]]?.[nodeId]?.find(item => item.id === questionId);
        if (!question) return;
        question.status = review.status || question.status || "draft";
        question.reviewedAt = review.reviewedAt;
        question.reviewedBy = review.reviewedBy;
        question.quality = { ...(question.quality || {}), reviewerNote: review.note || question.quality?.reviewerNote || "" };
      });
    }
    function routeLabel() { return ROUTE_META[state.routeKey]?.label || "数学学习路线"; }
    function allNodes() { return route().modules.flatMap(module => module.nodes.map(node => ({ ...node, module }))); }
    function moduleSeries(moduleCode) { return String(moduleCode || "").slice(0, 1); }
    function seriesModules(seriesCode) { return route().modules.filter(module => moduleSeries(module.code) === seriesCode); }
    function seriesNodeCount(seriesCode) { return seriesModules(seriesCode).reduce((sum, module) => sum + module.nodes.length, 0); }
    function seriesMasteredCount(seriesCode) {
      return seriesModules(seriesCode).reduce((sum, module) => sum + module.nodes.filter(node => statusFor(node.code) === "mastered").length, 0);
    }
    function seriesPercent(seriesCode) {
      const total = seriesNodeCount(seriesCode);
      return total ? Math.round((seriesMasteredCount(seriesCode) / total) * 100) : 0;
    }
    function seriesProgressHtml(seriesCode) {
      const percent = seriesPercent(seriesCode);
      return '<div class="series-progress" aria-label="' + escapeHtml(seriesCode) + '系列完成度 ' + percent + '%"><span style="width:' + percent + '%"></span></div>';
    }
    function abilityForLayer(layer) {
      const text = String(layer || "");
      if (text.includes("概念")) return "concept";
      if (text.includes("模型")) return "model";
      if (text.includes("快速") || text.includes("反应") || text.includes("心算")) return "mental";
      if (text.includes("规范") || text.includes("笔算")) return "standard";
      if (text.includes("应用")) return "application";
      return "";
    }
    function questionsForNodeAnyRoute(nodeId) {
      const routeKey = routeKeyForNodeId(nodeId, state.routeKey);
      const direct = (QUESTION_MODULES[routeKey] || {})[nodeId.split("-")[0]]?.[nodeId];
      if (direct) return direct;
      for (const modules of Object.values(QUESTION_MODULES)) {
        const questions = modules?.[nodeId.split("-")[0]]?.[nodeId];
        if (questions) return questions;
      }
      return [];
    }
    function activeAbilityRadarResetMs() {
      const value = state.abilityRadarResetAtByStudent?.[state.activeStudentId] || "";
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    function abilityStatsFromAttempts(seriesCode) {
      const stats = Object.fromEntries(ABILITY_LAYERS.map(item => [item.key, { ...item, correct: 0, total: 0 }]));
      const resetMs = activeAbilityRadarResetMs();
      function addStat(layer, correct, total = 1) {
        const key = abilityForLayer(layer);
        if (!key || !stats[key]) return;
        stats[key].total += Number(total) || 0;
        stats[key].correct += Number(correct) || 0;
      }
      Object.entries(activeProgress()).forEach(([nodeId, record]) => {
        if (seriesCode && moduleSeries(nodeId.split("-")[0]) !== seriesCode) return;
        const firstSeen = new Set();
        const questionById = new Map(questionsForNodeAnyRoute(nodeId).map(question => [question.id, question]));
        (record.attempts || []).forEach(attempt => {
          const attemptMs = Date.parse(attempt.at || 0);
          if (resetMs && (!Number.isFinite(attemptMs) || attemptMs < resetMs)) return;
          if (Object.prototype.hasOwnProperty.call(attempt, "firstAttemptLayerResults")) {
            Object.entries(attempt.firstAttemptLayerResults || {}).forEach(([layer, result]) => {
              addStat(layer, result?.correct || 0, result?.total || 0);
            });
            return;
          }
          Object.entries(attempt.results || {}).forEach(([questionId, ok]) => {
            if (firstSeen.has(questionId)) return;
            firstSeen.add(questionId);
            addStat(questionById.get(questionId)?.layer, ok ? 1 : 0, 1);
          });
        });
      });
      return ABILITY_LAYERS.map(item => {
        const stat = stats[item.key];
        return {
          ...item,
          correct: stat.correct,
          total: stat.total,
          percent: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0,
        };
      });
    }
    function radarPoint(index, total, percent, radius = 82, center = 120) {
      const angle = (-90 + (360 * index) / total) * Math.PI / 180;
      const distance = radius * Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
      return {
        x: +(center + Math.cos(angle) * distance).toFixed(2),
        y: +(center + Math.sin(angle) * distance).toFixed(2),
      };
    }
    function renderAbilityRadar(seriesCode, title) {
      const entries = abilityStatsFromAttempts(seriesCode);
      if (!entries.length) return '<div class="mastery-radar empty">暂无路线数据</div>';
      const total = entries.length;
      const rings = [25, 50, 75, 100].map(value => {
        const points = entries.map((_, index) => radarPoint(index, total, value)).map(point => point.x + "," + point.y).join(" ");
        return '<polygon class="radar-ring" points="' + points + '"></polygon>';
      }).join("");
      const axes = entries.map((entry, index) => {
        const end = radarPoint(index, total, 100);
        const label = radarPoint(index, total, 116);
        const anchor = label.x < 96 ? "end" : (label.x > 144 ? "start" : "middle");
        const dy = label.y < 45 ? -2 : (label.y > 195 ? 12 : 4);
        return '<line class="radar-axis" x1="120" y1="120" x2="' + end.x + '" y2="' + end.y + '"></line>' +
          '<text class="radar-label" x="' + label.x + '" y="' + (label.y + dy) + '" text-anchor="' + anchor + '">' + escapeHtml(entry.code) + '</text>' +
          '<text class="radar-percent" x="' + label.x + '" y="' + (label.y + dy + 15) + '" text-anchor="' + anchor + '">' + entry.percent + '%</text>';
      }).join("");
      const dataPoints = entries.map((entry, index) => radarPoint(index, total, entry.percent));
      const polygonPoints = dataPoints.map(point => point.x + "," + point.y).join(" ");
      const dots = dataPoints.map((point, index) => '<circle class="radar-dot" cx="' + point.x + '" cy="' + point.y + '" r="' + (entries[index].percent ? 4 : 3) + '"></circle>').join("");
      const legend = entries.map(entry =>
        '<div><strong>' + escapeHtml(entry.code) + '</strong><span>' + escapeHtml(entry.total ? entry.correct + "/" + entry.total + " 题答对" : "暂无作答") + '</span><b>' + entry.percent + '%</b></div>'
      ).join("");
      return '<div class="mastery-radar" aria-label="' + escapeHtml(title) + '能力雷达图">' +
        '<div class="radar-title">' + escapeHtml(title) + '</div>' +
        '<svg viewBox="0 0 240 240" role="img" aria-label="概念、模型、心算、规范、应用能力雷达图">' +
          '<title>' + escapeHtml(title) + '：概念、模型、心算、规范、应用能力雷达图</title>' +
          rings +
          axes +
          '<polygon class="radar-area" points="' + polygonPoints + '"></polygon>' +
          dots +
          '<circle class="radar-center-dot" cx="120" cy="120" r="4"></circle>' +
        '</svg>' +
        '<div class="radar-legend">' + legend + '</div>' +
      '</div>';
    }
    function renderMasteryRadarBoard() {
      return '<div class="radar-board">' +
        ["A", "B", "C", "D"].map(code => renderAbilityRadar(code, code + " " + studentSeriesName(SERIES[code]))).join("") +
      '</div>';
    }
    function studentSeriesName(series) {
      const labels = { A: "数与式", B: "测量", C: "几何", D: "生活应用", E: "综合关系" };
      return state.me?.role === "student" ? (labels[series.code] || series.name) : series.name;
    }
    function practiceFor(code) { return route().practice.byId[code]; }
    function allQuestionsFor(code) { return routeQuestions()[code.split("-")[0]]?.[code] || []; }
    function questionsFor(code) {
      const questions = allQuestionsFor(code);
      if (state.me?.role === "teacher") return questions;
      return questions.filter(question => question.status === "vetted");
    }
    function reviewCountsFor(code) {
      const counts = { vetted: 0, draft: 0, hidden: 0, total: 0 };
      allQuestionsFor(code).forEach(question => {
        counts.total += 1;
        counts[question.status || "draft"] = (counts[question.status || "draft"] || 0) + 1;
      });
      return counts;
    }
    function currentStudent() { return state.students.find(s => s.id === state.activeStudentId); }
    function findNodeInRoute(code, routeKey = state.routeKey) {
      const selectedRoute = ROUTES[routeKey] || ROUTES.primary;
      for (const module of selectedRoute.modules) {
        const node = module.nodes.find(item => item.code === code);
        if (node) return { module, node, routeKey };
      }
      return null;
    }
    function routeKeyForNodeId(code, preferredRouteKey = state.routeKey) {
      if (findNodeInRoute(code, preferredRouteKey)) return preferredRouteKey;
      if (findNodeInRoute(code, "primary")) return "primary";
      if (findNodeInRoute(code, "middle")) return "middle";
      return preferredRouteKey || "primary";
    }
    function assignmentItems(assignment) {
      if (Array.isArray(assignment?.items) && assignment.items.length) return assignment.items;
      return (assignment?.nodeIds || []).map(nodeId => ({ nodeId, routeKey: routeKeyForNodeId(nodeId, assignment?.routeKey || state.routeKey) }));
    }
    function assignmentIsVisible(assignment) {
      return assignment && !["archived", "canceled"].includes(assignment.computedStatus) && !["archived", "canceled"].includes(assignment.status);
    }
    function assignmentIsOpen(assignment) {
      return assignmentIsVisible(assignment) && assignment.computedStatus !== "completed";
    }
    function visibleHomeworkAssignments() {
      return state.assignments.filter(assignmentIsVisible);
    }
    function pendingHomeworkItems(assignment) {
      if (Array.isArray(assignment?.pendingNodeIds)) {
        const pendingIds = new Set(assignment.pendingNodeIds);
        return assignmentItems(assignment).filter(item => pendingIds.has(item.nodeId));
      }
      return assignmentItems(assignment).filter(item => !["mastered", "skipped"].includes(statusFor(item.nodeId)));
    }
    function isAssignedNode(code) {
      return state.assignments.some(assignment => assignmentIsVisible(assignment) && assignmentItems(assignment).some(item => item.nodeId === code));
    }
    function activeAssignmentTasks(limit = 6) {
      const tasks = [];
      state.assignments.filter(assignmentIsOpen).forEach(assignment => {
        pendingHomeworkItems(assignment).forEach(item => {
          const routeKey = item.routeKey || routeKeyForNodeId(item.nodeId);
          const found = findNodeInRoute(item.nodeId, routeKey) || findNodeInRoute(item.nodeId, "primary") || findNodeInRoute(item.nodeId, "middle");
          tasks.push({
            assignment,
            nodeId: item.nodeId,
            routeKey: found?.routeKey || routeKey,
            title: found?.node?.skill || item.title || item.nodeId,
            moduleTitle: found?.module?.title || item.moduleCode || item.nodeId.split("-")[0],
          });
        });
      });
      return tasks.slice(0, limit);
    }
    function routeKeyForStudent(student) {
      const module = String(student?.currentModule || student?.level || "");
      return /^([A-Z])(\d+)/.test(module) && Number(module.match(/^([A-Z])(\d+)/)[2]) >= 19 ? "middle" : "primary";
    }
    function preferredSeriesForStudent(student) {
      const module = String(student?.currentModule || student?.level || "");
      return module ? module.slice(0, 1) : "all";
    }
    function currentModuleForStudent() {
      const studentModule = String(currentStudent()?.currentModule || currentStudent()?.level || "");
      if (studentModule) return studentModule.split("-")[0];
      const active = Object.entries(activeProgress()).find(([, record]) => ["in_progress", "forgotten"].includes(record?.status));
      if (active?.[0]) return active[0].split("-")[0];
      return route().modules[0]?.code || "";
    }
    function focusModuleCode() {
      const preferred = currentModuleForStudent();
      return route().modules.some(module => module.code === preferred) ? preferred : route().modules[0]?.code || "";
    }
    function studentCurrentFocusMode() {
      if (state.me?.role !== "student") return false;
      return state.studentViewMode === "today";
    }
    function visibleModules() {
      if (state.me?.role === "student") {
        if (studentCurrentFocusMode()) {
          const code = focusModuleCode();
          return route().modules.filter(module => module.code === code);
        }
        const series = state.activeSeries === "all" ? preferredSeriesForStudent(currentStudent()) : state.activeSeries;
        return route().modules.filter(module => moduleSeries(module.code) === series);
      }
      return route().modules.filter(module => state.activeSeries === "all" || moduleSeries(module.code) === state.activeSeries);
    }
    function focusCurrentLearningView() {
      if (state.me?.role === "student") state.studentViewMode = "today";
      if (state.me?.role === "student" && state.studentScreen === "map") state.studentViewMode = "series";
      state.status = "unfinished";
      if (byId("statusFilter")) byId("statusFilter").value = state.status;
      const openModule = focusModuleCode();
      state.collapsed = new Set(visibleModules().filter(module => module.code !== openModule).map(module => module.code));
    }
    function syncStudentPanels() {
      const isStudent = state.me?.role === "student";
      document.body.classList.toggle("student-tools-open", isStudent && state.studentToolsOpen);
      document.body.classList.toggle("student-report-open", isStudent && state.studentReportOpen);
      if (isStudent) document.body.dataset.studentScreen = state.studentScreen || "today";
      else delete document.body.dataset.studentScreen;
      document.querySelectorAll("[data-student-screen]").forEach((button) => {
        const active = isStudent && button.dataset.studentScreen === state.studentScreen;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
      });
      const toggle = byId("toggleStudentTools");
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(isStudent && state.studentToolsOpen));
        toggle.textContent = state.studentToolsOpen ? "收起搜索与筛选" : "搜索与筛选";
      }
    }
    function studentUiStorageKey() { return "math-route-student-ui:" + (state.activeStudentId || "anonymous"); }
    function restoreStudentUiState() {
      if (state.me?.role !== "student") return;
      try {
        const saved = JSON.parse(localStorage.getItem(studentUiStorageKey()) || "{}");
        if (["today", "map", "tasks", "growth"].includes(saved.screen)) state.studentScreen = saved.screen;
        if (/^[A-E]$/.test(saved.series || "")) state.activeSeries = saved.series;
      } catch (_) {}
    }
    function saveStudentUiState() {
      if (state.me?.role !== "student") return;
      try { localStorage.setItem(studentUiStorageKey(), JSON.stringify({ screen: state.studentScreen, series: state.activeSeries })); } catch (_) {}
    }
    function setStudentScreen(screen, options = {}) {
      if (state.me?.role !== "student" || !["today", "map", "tasks", "growth"].includes(screen)) return;
      state.studentScreen = screen;
      state.studentViewMode = screen === "map" ? "series" : "today";
      if (screen === "map" && state.activeSeries === "all") state.activeSeries = preferredSeriesForStudent(currentStudent());
      saveStudentUiState();
      renderAll();
      if (options.scroll !== false) {
        const target = screen === "map" ? byId("mapPanel") : byId("studentFocus");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    function activeProgress() { return state.progress || {}; }
    function recordFor(code) { return activeProgress()[code] || { status: "not_started", history: [], attempts: [] }; }
    function statusFor(code) { return recordFor(code).status || "not_started"; }
    function isSatisfied(code) { return ["mastered", "skipped"].includes(statusFor(code)); }
    function unmetPrerequisites(code) { return (practiceFor(code)?.prerequisites || []).filter(id => !isSatisfied(id)); }
    function defaultPrimaryUnlockPolicy() {
      return { globalMode: "sequential", series: Object.fromEntries(Object.keys(SERIES).map(code => [code, "sequential"])) };
    }
    function primaryUnlockPolicyForStudent(studentId = state.activeStudentId) {
      const policy = state.unlockPoliciesByStudent?.[studentId]?.primary || defaultPrimaryUnlockPolicy();
      return {
        globalMode: policy.globalMode === "all_free" ? "all_free" : "sequential",
        series: { ...defaultPrimaryUnlockPolicy().series, ...(policy.series || {}) },
      };
    }
    function previousNodeInModule(code) {
      const found = findNode(code);
      if (!found) return "";
      const index = found.module.nodes.findIndex(node => node.code === code);
      return index > 0 ? found.module.nodes[index - 1]?.code || "" : "";
    }
    function primarySequentialPreviousNode(code) {
      const match = String(code || "").match(/^([A-E]\\d+)-(\\d+)$/);
      if (match && Number(match[2]) > 1) {
        const numericPrevious = match[1] + "-" + (Number(match[2]) - 1);
        if (findNode(numericPrevious)) return numericPrevious;
      }
      return previousNodeInModule(code);
    }
    function isCurrentModule(code) {
      const current = String(currentStudent()?.currentModule || currentStudent()?.level || "").split("-")[0];
      return !current || current === code.split("-")[0];
    }
    function unmetSequentialPrerequisites(code) {
      if (!isCurrentModule(code)) return [String(currentStudent()?.currentModule || currentStudent()?.level || "当前设定路线位置").split("-")[0]];
      const previous = primarySequentialPreviousNode(code);
      return previous && !isSatisfied(previous) ? [previous] : [];
    }
    function unlockInfo(code) {
      if (state.me?.role === "teacher") return { unlocked: true, label: "老师全局视图：已解锁" };
      if (isAssignedNode(code)) return { unlocked: true, label: "老师布置作业：已开启" };
      if (state.routeKey !== "primary") {
        const unmet = unmetPrerequisites(code);
        return { unlocked: unmet.length === 0, label: unmet.length ? "未解锁，需要先掌握：" + unmet.join("、") : "已解锁" };
      }
      const policy = primaryUnlockPolicyForStudent();
      if (policy.globalMode === "all_free") return { unlocked: true, label: "已解锁：全小学路线自由选择" };
      const seriesCode = moduleSeries(code.split("-")[0]);
      if (policy.series?.[seriesCode] === "series_free") return { unlocked: true, label: "已解锁：" + seriesCode + " 系列自由选择" };
      const unmet = unmetSequentialPrerequisites(code);
      return { unlocked: unmet.length === 0, label: unmet.length ? "未解锁，需要先完成：" + unmet.join("、") : "已解锁：逐节点推进" };
    }
    function isUnlocked(code) { return unlockInfo(code).unlocked; }
    async function loadProgress() {
      const studentId = state.activeStudentId;
      if (!studentId) return;
      const data = await api("/api/progress?studentId=" + encodeURIComponent(studentId));
      state.progress = data.progress || {};
    }
    async function loadAssignments() {
      const studentId = state.activeStudentId;
      if (!studentId) {
        state.assignments = [];
        return;
      }
      const data = await api("/api/assignments?studentId=" + encodeURIComponent(studentId));
      state.assignments = data.assignments || [];
    }
    async function loadAssignmentAlerts() {
      if (state.me?.role !== "teacher") {
        state.assignmentAlerts = [];
        return;
      }
      const data = await api("/api/assignment-alerts");
      state.assignmentAlerts = data.alerts || [];
    }
    async function loadReport() {
      if (!state.activeStudentId) return;
      const data = await api("/api/report?studentId=" + encodeURIComponent(state.activeStudentId));
      state.report = data.report;
    }
    async function loadWeeklyDiagnosis() {
      if (!state.activeStudentId) return;
      const data = await api("/api/weekly-diagnostics?studentId=" + encodeURIComponent(state.activeStudentId));
      state.weeklyDiagnosis = data.live || data.latest || null;
    }
    async function loadMistakes() {
      if (!state.activeStudentId) {
        state.mistakes = [];
        return;
      }
      const data = await api("/api/mistakes?studentId=" + encodeURIComponent(state.activeStudentId) + "&status=all&limit=200");
      state.mistakes = data.mistakes || [];
    }
    async function loadLoginLogs() {
      if (state.me?.role !== "teacher") return;
      const username = byId("loginLogUsername")?.value.trim() || "";
      const limit = byId("loginLogLimit")?.value || "100";
      const params = new URLSearchParams({ limit });
      if (username) params.set("username", username);
      const data = await api("/api/login-log?" + params.toString());
      state.loginLogs = data.logs || [];
    }
    function renderWeeklyReport() {
      if (!state.report) return;
      const report = state.report;
      const diagnosisHtml = renderWeeklyDiagnosisHtml();
      if (state.me?.role === "student") {
        const c = counts();
        const total = allNodes().length || 1;
        const masteryPercent = Math.round((c.mastered / total) * 100);
        const next = nextLearningNode();
        const html =
          '<div class="mastery-card">' +
            '<div class="mastery-ring" style="--pct:' + masteryPercent + '%"><div><div><strong>' + masteryPercent + '%</strong><span>当前掌握度</span></div></div></div>' +
            '<button class="mastery-action" id="startMasteryCheck" type="button">开始检测</button>' +
            '<div class="mastery-stats">' +
              '<div class="mastery-stat"><strong>' + c.mastered + '</strong><span>已掌握关卡</span></div>' +
              '<div class="mastery-stat"><strong>' + c.unlocked + '</strong><span>已解锁关卡</span></div>' +
            '</div>' +
            '<div class="mastery-suggestion"><strong>老师作业：</strong>' + escapeHtml((report.assigned || []).join("、") || "暂无") + '<br /><strong>本周已学：</strong>' + escapeHtml(report.thisWeekLearned.join("、") || "暂无") + '<br /><strong>下周建议：</strong>' + escapeHtml(report.nextWeekSuggestions.join("、") || (next ? next.code : "继续当前节点")) + '</div>' +
            diagnosisHtml +
            renderMasteryRadarBoard() +
          '</div>';
        if (byId("familyReport")) byId("familyReport").innerHTML = html;
        byId("startMasteryCheck")?.addEventListener("click", () => next && openNode(next.code));
        return;
      }
      if (state.me?.role === "parent") {
        const html =
          '<div class="parent-report-card"><strong>本周完成</strong><span>' + escapeHtml(report.thisWeekLearned.join("、") || "本周暂时没有完成的新关卡。") + '</span></div>' +
          '<div class="parent-report-card"><strong>建议练习</strong><span>' + escapeHtml(report.nextWeekSuggestions.join("、") || "继续当前学习路线。") + '</span></div>' +
          diagnosisHtml;
        if (byId("familyReport")) byId("familyReport").innerHTML = html;
        return;
      }
      const html =
        '<div><strong>本周已学：</strong>' + escapeHtml(report.thisWeekLearned.join("、") || "暂无") + '</div>' +
        '<div><strong>老师作业：</strong>' + escapeHtml((report.assigned || []).join("、") || "暂无") + '</div>' +
        '<div><strong>下周建议：</strong>' + escapeHtml(report.nextWeekSuggestions.join("、") || "继续当前节点") + '</div>' +
        '<div><strong>回补建议：</strong>' + escapeHtml(report.remediation.join("、") || "暂无") + '</div>' +
        diagnosisHtml;
      if (byId("weeklyReport")) byId("weeklyReport").innerHTML = html;
      if (byId("familyReport")) byId("familyReport").innerHTML = html;
    }
    function renderWeeklyDiagnosisHtml() {
      const diagnosis = state.weeklyDiagnosis;
      if (!diagnosis) return "";
      const generated = diagnosis.generatedAt ? new Date(diagnosis.generatedAt).toLocaleString("zh-CN", { hour12: false }) : "实时预览";
      const source = diagnosis.source === "auto" ? "每周自动生成" : "实时预览";
      const lines = String(diagnosis.text || "").split(/\r?\n/).filter(Boolean);
      return '<div class="weekly-diagnosis">' +
        '<div class="weekly-diagnosis-head"><strong>数学每周诊断</strong><span>' + escapeHtml(source + "｜" + generated) + '</span></div>' +
        '<div class="weekly-diagnosis-profile">数学依据：' + escapeHtml(diagnosis.profileHint || "暂无数学画像文件，先看做题数据。") + '</div>' +
        '<div class="weekly-diagnosis-lines">' + lines.map((line) => {
          const strong = /^(数学本周结论|本周结论|我的优势|数学主要问题|主要问题|错题类型|数学下一步|建议下一步|是否解锁)：?/.test(line);
          return '<div class="' + (strong ? "diagnosis-line heading" : "diagnosis-line") + '">' + escapeHtml(line) + '</div>';
        }).join("") + '</div>' +
      '</div>';
    }
    function renderLoginLogs() {
      if (state.me?.role !== "teacher") return;
      const box = byId("loginLogTable");
      if (!box) return;
      byId("loginLogMessage").textContent = state.loginLogs.length ? "共显示 " + state.loginLogs.length + " 条记录。" : "没有匹配的登录记录。";
      box.innerHTML = state.loginLogs.length
        ? state.loginLogs.map(log => {
            const time = log.at ? new Date(log.at).toLocaleString("zh-CN", { hour12: false }) : "-";
            const status = log.success ? '<span class="log-ok">成功</span>' : '<span class="log-bad">失败</span>';
            const userText = (log.displayName || log.username || "-") + (log.username ? "｜" + log.username : "");
            const detail = [log.role || "", log.reason || "", log.ip || "", log.device || ""].filter(Boolean).join("｜");
            return '<div class="log-row">' +
              '<div><strong>' + escapeHtml(time) + '</strong></div>' +
              '<div>' + status + '</div>' +
              '<div>' + escapeHtml(log.studentId || log.role || "-") + '</div>' +
              '<div><strong>' + escapeHtml(userText) + '</strong><br />' + escapeHtml(detail || "-") + '</div>' +
            '</div>';
          }).join("")
        : '<div class="empty">暂无登录记录。</div>';
    }
    function renderMistakeBook() {
      const box = byId("mistakeBook");
      if (!box) return;
      const mistakes = state.mistakes || [];
      const openMistakes = mistakes.filter((item) => (item.status || "open") === "open");
      const title = byId("mistakeBookTitle");
      const hint = byId("mistakeBookHint");
      if (title) title.textContent = state.me?.role === "student" ? "我的错题本" : "错题本｜" + (currentStudent()?.name || "当前学生");
      if (hint) hint.textContent = mistakes.length ? ("共 " + mistakes.length + " 道错题，" + openMistakes.length + " 道待复习。") : "暂无错题记录。";
      box.innerHTML = mistakes.length
        ? mistakes.map((item) => {
            const time = item.lastWrongAt || item.at ? new Date(item.lastWrongAt || item.at).toLocaleString("zh-CN", { hour12: false }) : "-";
            const isOpen = (item.status || "open") === "open";
            return '<article class="mistake-card">' +
              '<div class="mistake-top"><span>' + escapeHtml(item.nodeId || "") + '</span><b>' + escapeHtml(layerDisplayName(item.layer)) + '</b><small>' + escapeHtml(time) + '</small><em class="mistake-status ' + (isOpen ? "open" : "reviewed") + '">' + (isOpen ? "待复习" : "已复习") + '</em></div>' +
              '<div class="mistake-title">' + escapeHtml(item.nodeTitle || item.moduleTitle || "") + '</div>' +
              '<div class="mistake-prompt">' + escapeHtml(item.prompt || "") + '</div>' +
              '<div class="mistake-detail"><span>我的答案：' + escapeHtml(item.selected || "未选择") + '</span><span>正确答案：' + escapeHtml(item.answer || "-") + '</span></div>' +
              '<div class="mistake-reason">' + escapeHtml(item.reason || "这个选项对应的关系或计算有问题。") + '</div>' +
              '<div class="mistake-actions">' + (isOpen ? '<button type="button" data-review-mistake="' + escapeHtml(item.id) + '">标记已复习</button>' : '<button type="button" disabled>已复习</button>') + '<button type="button" data-mistake-node="' + escapeHtml(item.nodeId) + '" data-mistake-route="' + escapeHtml(item.routeKey || routeKeyForNodeId(item.nodeId)) + '">回到节点</button></div>' +
            '</article>';
          }).join("")
        : '<div class="empty">现在没有错题记录。做题时第一次确认后答错的题，会自动进入这里。</div>';
      document.querySelectorAll("[data-review-mistake]").forEach(btn => btn.addEventListener("click", async () => {
        await api("/api/mistakes/review", { method: "POST", body: JSON.stringify({ studentId: state.activeStudentId, mistakeId: btn.dataset.reviewMistake }) });
        await loadMistakes();
        renderMistakeBook();
        renderStudentFocus();
      }));
      document.querySelectorAll("[data-mistake-node]").forEach(btn => btn.addEventListener("click", () => openAssignmentNode(btn.dataset.mistakeNode, btn.dataset.mistakeRoute)));
    }
    async function bootstrap() {
      const data = await api("/api/bootstrap");
      state.me = data.user;
      state.students = data.students;
      state.activeStudentId = data.activeStudentId;
      state.questionReviewSummary = data.questionReviewSummary || {};
      state.unlockPoliciesByStudent = data.unlockPoliciesByStudent || {};
      state.abilityRadarResetAtByStudent = data.abilityRadarResetAtByStudent || {};
      applyQuestionReviewOverrides("primary", data.questionReviews || {});
      applyQuestionReviewOverrides("middle", data.questionReviews || {});
      document.body.classList.toggle("teacher", state.me.role === "teacher");
      document.body.classList.toggle("student", state.me.role === "student");
      document.body.classList.toggle("parent", state.me.role === "parent");
      byId("who").textContent = state.me.displayName + "｜" + ({ teacher: "老师", student: "学生", parent: "家长", guest: "访客" }[state.me.role] || state.me.role);
      state.routeKey = routeKeyForStudent(currentStudent());
      state.activeSeries = preferredSeriesForStudent(currentStudent());
      restoreStudentUiState();
      renderStudentSelect();
      await loadProgress();
      await loadAssignments();
      await loadAssignmentAlerts();
      await loadReport();
      await loadWeeklyDiagnosis();
      await loadMistakes();
      await loadLoginLogs();
      focusCurrentLearningView();
      renderAll();
      syncOfflineAttempts().catch(() => {});
    }
    function renderStudentSelect() {
      const select = byId("studentSelect");
      select.disabled = state.me.role !== "teacher";
      select.innerHTML = state.students.map(student => '<option value="' + escapeHtml(student.id) + '"' + (student.id === state.activeStudentId ? " selected" : "") + '>' + escapeHtml(student.name) + '</option>').join("");
      renderBatchStudents();
      renderAssignmentStudents();
    }
    function renderBatchStudents() {
      const box = byId("batchStudents");
      if (!box) return;
      box.innerHTML = state.students.map(student => '<label><input type="checkbox" value="' + escapeHtml(student.id) + '" />' + escapeHtml(student.name) + '</label>').join("");
    }
    function renderAssignmentStudents() {
      const box = byId("assignmentStudents");
      if (!box) return;
      box.innerHTML = state.students.map(student => '<label><input type="checkbox" value="' + escapeHtml(student.id) + '"' + (student.id === state.activeStudentId ? " checked" : "") + ' />' + escapeHtml(student.name) + '</label>').join("");
    }
    function assignmentStatusLabel(assignment) {
      const status = assignment.computedStatus || assignment.status || "active";
      if (assignment.needsTeacherReview) return "待老师确认";
      return status === "completed" ? "已完成" : status === "archived" ? "已归档" : status === "canceled" ? "已取消" : "进行中";
    }
    function assignmentTime(value) {
      return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
    }
    async function focusTeacherAssignment(studentId, nodeId, routeKey) {
      state.activeStudentId = studentId;
      if (byId("studentSelect")) byId("studentSelect").value = studentId;
      state.routeKey = routeKeyForNodeId(nodeId, routeKey || routeKeyForStudent(currentStudent()));
      state.activeSeries = moduleSeries(nodeId.split("-")[0]);
      await loadProgress();
      await loadAssignments();
      await loadReport();
      await loadWeeklyDiagnosis();
      focusCurrentLearningView();
      renderAll();
      requestAnimationFrame(() => openAssignmentNode(nodeId, state.routeKey));
    }
    async function acknowledgeAssignment(studentId, assignmentId) {
      const result = await api("/api/assignments/acknowledge", { method: "POST", body: JSON.stringify({ studentId, assignmentId }) });
      if (studentId === state.activeStudentId) state.assignments = result.assignments || state.assignments;
      state.assignmentAlerts = result.alerts || [];
      if (byId("assignmentMessage")) byId("assignmentMessage").textContent = "已确认收到完成作业。";
      renderAssignmentAlerts();
      renderAssignments();
      renderWeeklyReport();
    }
    function renderAssignmentAlerts() {
      const box = byId("assignmentAlerts");
      if (!box || state.me?.role !== "teacher") return;
      const alerts = state.assignmentAlerts || [];
      box.classList.toggle("is-empty", !alerts.length);
      box.innerHTML = alerts.length
        ? '<div class="assignment-alert-header"><strong>完成作业待确认</strong><span>' + alerts.length + '份</span></div>' +
          alerts.slice(0, 8).map(assignment => {
            const items = assignmentItems(assignment);
            return '<div class="assignment-alert-card">' +
              '<div class="assignment-alert-main">' +
                '<strong>' + escapeHtml(assignment.studentName || assignment.studentId || "-") + '</strong>' +
                '<span>' + escapeHtml(assignment.title || "老师布置的作业") + '</span>' +
                '<small>完成时间：' + escapeHtml(assignmentTime(assignment.completedAt || assignment.teacherNoticeAt)) + '</small>' +
              '</div>' +
              '<div class="assignment-node-list">' + items.map(item => '<button type="button" data-alert-open="' + escapeHtml(item.nodeId) + '" data-alert-student="' + escapeHtml(assignment.studentId) + '" data-alert-route="' + escapeHtml(item.routeKey || routeKeyForNodeId(item.nodeId)) + '">' + escapeHtml(item.nodeId) + '</button>').join("") + '</div>' +
              '<div class="control-row"><button class="primary" type="button" data-ack-assignment="' + escapeHtml(assignment.id) + '" data-ack-student="' + escapeHtml(assignment.studentId) + '">确认收到</button></div>' +
            '</div>';
          }).join("")
        : '<div class="assignment-alert-empty">暂无待确认完成作业。</div>';
      box.querySelectorAll("[data-alert-open]").forEach(btn => btn.addEventListener("click", () => focusTeacherAssignment(btn.dataset.alertStudent, btn.dataset.alertOpen, btn.dataset.alertRoute)));
      box.querySelectorAll("[data-ack-assignment]").forEach(btn => btn.addEventListener("click", async () => {
        try {
          await acknowledgeAssignment(btn.dataset.ackStudent, btn.dataset.ackAssignment);
        } catch (error) {
          if (byId("assignmentMessage")) byId("assignmentMessage").textContent = error.message;
        }
      }));
    }
    function renderAssignments() {
      const box = byId("assignmentList");
      if (!box || state.me?.role !== "teacher") return;
      const list = state.assignments || [];
      box.innerHTML = list.length
        ? list.map(assignment => {
            const done = assignment.computedStatus === "completed";
            const archived = assignment.computedStatus === "archived" || assignment.status === "archived";
            const canceled = assignment.computedStatus === "canceled" || assignment.status === "canceled";
            const items = assignmentItems(assignment);
            const pendingCount = assignment.pendingNodeIds?.length ?? items.length;
            const meta = [
              assignment.dueDate ? "截止：" + assignment.dueDate : "",
              "剩余：" + pendingCount + "/" + items.length,
              assignment.note || "",
            ].filter(Boolean).join("｜");
            const reviewAction = done && assignment.needsTeacherReview
              ? '<button class="primary" type="button" data-ack-assignment="' + escapeHtml(assignment.id) + '" data-ack-student="' + escapeHtml(state.activeStudentId) + '">确认收到</button>'
              : '';
            return '<div class="assignment-card' + (done ? " done" : "") + (assignment.needsTeacherReview ? " review-needed" : "") + ((archived || canceled) ? " archived" : "") + (canceled ? " canceled" : "") + '">' +
              '<div class="assignment-title-row"><strong>' + escapeHtml(assignment.title || "老师布置的作业") + '</strong><span class="badge">' + escapeHtml(assignmentStatusLabel(assignment)) + '</span></div>' +
              '<div class="assignment-meta">' + escapeHtml(meta || "无备注") + '</div>' +
              '<div class="assignment-node-list">' + items.map(item => '<button type="button"' + (canceled ? " disabled" : "") + ' data-assignment-open="' + escapeHtml(item.nodeId) + '" data-assignment-route="' + escapeHtml(item.routeKey || routeKeyForNodeId(item.nodeId)) + '">' + escapeHtml(item.nodeId) + '</button>').join("") + '</div>' +
              (!(archived || canceled) ? '<div class="control-row">' + reviewAction + '<button class="danger" type="button" data-cancel-assignment="' + escapeHtml(assignment.id) + '">取消作业</button><button type="button" data-archive-assignment="' + escapeHtml(assignment.id) + '">归档作业</button></div>' : '') +
            '</div>';
          }).join("")
        : '<div class="empty">当前学生还没有作业。</div>';
      box.querySelectorAll("[data-assignment-open]").forEach(btn => btn.addEventListener("click", () => openAssignmentNode(btn.dataset.assignmentOpen, btn.dataset.assignmentRoute)));
      box.querySelectorAll("[data-ack-assignment]").forEach(btn => btn.addEventListener("click", async () => {
        const message = byId("assignmentMessage");
        try {
          await acknowledgeAssignment(btn.dataset.ackStudent, btn.dataset.ackAssignment);
        } catch (error) {
          if (message) message.textContent = error.message;
        }
      }));
      box.querySelectorAll("[data-archive-assignment]").forEach(btn => btn.addEventListener("click", async () => {
        const message = byId("assignmentMessage");
        try {
          const result = await api("/api/assignments/archive", { method: "POST", body: JSON.stringify({ studentId: state.activeStudentId, assignmentId: btn.dataset.archiveAssignment }) });
          state.assignments = result.assignments || [];
          await loadAssignmentAlerts();
          message.textContent = "已归档作业。";
          renderAssignmentAlerts();
          renderAssignments();
          renderStudentFocus();
          renderWeeklyReport();
        } catch (error) {
          message.textContent = error.message;
        }
      }));
      box.querySelectorAll("[data-cancel-assignment]").forEach(btn => btn.addEventListener("click", async () => {
        const message = byId("assignmentMessage");
        if (!window.confirm("确定取消这份作业吗？学生端将不再显示。")) return;
        try {
          const result = await api("/api/assignments/cancel", { method: "POST", body: JSON.stringify({ studentId: state.activeStudentId, assignmentId: btn.dataset.cancelAssignment }) });
          state.assignments = result.assignments || [];
          await loadAssignmentAlerts();
          message.textContent = "已取消作业，学生端不会再显示。";
          renderAssignmentAlerts();
          renderAssignments();
          renderStudentFocus();
          renderWeeklyReport();
        } catch (error) {
          message.textContent = error.message;
        }
      }));
    }
    function renderUnlockPolicyManager() {
      if (state.me?.role !== "teacher") return;
      const policy = primaryUnlockPolicyForStudent();
      if (byId("unlockStudentName")) byId("unlockStudentName").textContent = currentStudent()?.name || "-";
      if (byId("primaryGlobalUnlockMode")) byId("primaryGlobalUnlockMode").value = policy.globalMode;
      const box = byId("primarySeriesUnlocks");
      if (!box) return;
      box.innerHTML = Object.values(SERIES).map(series =>
        '<label>' + escapeHtml(series.code + " " + series.name) +
          '<select data-unlock-series="' + series.code + '">' +
            '<option value="sequential"' + (policy.series[series.code] === "sequential" ? " selected" : "") + '>逐节点解锁</option>' +
            '<option value="series_free"' + (policy.series[series.code] === "series_free" ? " selected" : "") + '>本系列自由选择</option>' +
          '</select>' +
        '</label>'
      ).join("");
    }
    function counts() {
      const result = { not_started: 0, in_progress: 0, mastered: 0, forgotten: 0, skipped: 0, unlocked: 0 };
      allNodes().forEach(({ code }) => {
        result[statusFor(code)] += 1;
        if (isUnlocked(code)) result.unlocked += 1;
      });
      return result;
    }
    function renderMetrics() {
      const c = counts();
      const student = state.students.find(s => s.id === state.activeStudentId);
      const items = [
        ["当前学生", student?.name || "-", "正在查看的记录"],
        ["总节点", allNodes().length, routeLabel()],
        ["已解锁", c.unlocked, "可以学习/做题"],
        ["已掌握", c.mastered, "绿色"],
        ["进行中", c.in_progress, "黄色"],
        ["已遗忘", c.forgotten, "红色"],
        ["跳过", c.skipped, "紫色"],
        ["未开始", c.not_started, "灰色"],
      ];
      byId("metrics").innerHTML = items.map(([label, value, note]) => '<div class="metric"><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + "｜" + escapeHtml(note) + '</span></div>').join("");
    }
    function nextLearningNode() {
      const assigned = activeAssignmentTasks(1)[0];
      if (assigned) return { code: assigned.nodeId, skill: assigned.title, routeKey: assigned.routeKey, assignment: assigned.assignment };
      const nodes = allNodes();
      return nodes.find(({ code }) => isUnlocked(code) && statusFor(code) === "in_progress")
        || nodes.find(({ code }) => isUnlocked(code) && statusFor(code) !== "mastered")
        || nodes.find(({ code }) => statusFor(code) !== "mastered")
        || nodes[0];
    }
    function upcomingLearningNodes(limit = 3) {
      const assigned = activeAssignmentTasks(limit).map(task => ({ code: task.nodeId, skill: task.title, routeKey: task.routeKey, assignment: task.assignment }));
      const seen = new Set(assigned.map(item => item.code));
      const regular = allNodes()
        .filter(({ code }) => isUnlocked(code) && statusFor(code) !== "mastered")
        .filter(({ code }) => !seen.has(code))
        .slice(0, limit);
      return [...assigned, ...regular].slice(0, limit);
    }
    function renderHomeworkReminder() {
      const assignments = visibleHomeworkAssignments();
      if (!assignments.length) return "";
      const pendingTasks = activeAssignmentTasks(4);
      const pendingNodeCount = assignments.reduce((sum, assignment) => sum + pendingHomeworkItems(assignment).length, 0);
      const completedCount = assignments.filter(assignment => assignment.computedStatus === "completed").length;
      const title = pendingNodeCount ? "老师作业提醒" : "老师作业已完成";
      const subline = pendingNodeCount
        ? "还有 " + pendingNodeCount + " 个节点等你完成。先做老师布置的，再继续探索。"
        : "已完成 " + completedCount + "/" + assignments.length + " 个作业包，可以复习错题或继续下一关。";
      const actions = pendingTasks.length
        ? '<div class="homework-alert-actions">' + pendingTasks.map(task => '<button type="button" data-homework-node="' + escapeHtml(task.nodeId) + '" data-homework-route="' + escapeHtml(task.routeKey || routeKeyForNodeId(task.nodeId)) + '"><strong>' + escapeHtml(task.nodeId) + '</strong><span>' + escapeHtml(task.title) + '</span></button>').join("") + '</div>'
        : '<div class="homework-alert-done">本次作业没有未完成节点。</div>';
      return '<div class="homework-alert ' + (pendingNodeCount ? "" : "done") + '" data-homework-alert>' +
        '<div><div class="homework-alert-kicker">任务仓</div><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(subline) + '</p></div>' +
        actions +
      '</div>';
    }
    function renderTaskPackage(assignment, nextTask) {
      if (!assignment) return "";
      const items = assignmentItems(assignment);
      const pendingItems = pendingHomeworkItems(assignment);
      const done = Math.max(0, items.length - pendingItems.length);
      const percent = items.length ? Math.round((done / items.length) * 100) : 100;
      const next = nextTask || pendingItems[0];
      const visibleItems = pendingItems.slice(0, 6);
      return '<div class="focus-package">' +
        '<div class="package-kicker">今日任务包</div>' +
        '<strong>' + escapeHtml(assignment.title || "老师布置的作业") + '</strong>' +
        '<div class="package-progress-line"><span>已完成 ' + done + '/' + items.length + '</span><b>' + percent + '%</b></div>' +
        '<div class="package-progress"><span style="width:' + percent + '%"></span></div>' +
        (next ? '<div class="package-next"><span>下一关</span><button type="button" data-homework-node="' + escapeHtml(next.nodeId || next.code) + '" data-homework-route="' + escapeHtml(next.routeKey || routeKeyForNodeId(next.nodeId || next.code)) + '">' + escapeHtml(next.nodeId || next.code) + '</button></div>' : '<div class="package-next done"><span>这份任务包已经完成。</span></div>') +
        (visibleItems.length ? '<div class="package-node-strip">' + visibleItems.map(item => '<button type="button" data-homework-node="' + escapeHtml(item.nodeId) + '" data-homework-route="' + escapeHtml(item.routeKey || routeKeyForNodeId(item.nodeId)) + '">' + escapeHtml(item.nodeId) + '</button>').join("") + '</div>' : '') +
      '</div>';
    }
    function renderStudentModuleDock() {
      return '<nav class="explorer-module-dock" aria-label="数学学习模块">' + Object.values(SERIES).map((series) => {
        const isMain = preferredSeriesForStudent(currentStudent()) === series.code;
        const modules = route().modules.filter(module => moduleSeries(module.code) === series.code);
        const available = modules.some(module => module.nodes.some(node => isUnlocked(node.code)));
        const percent = seriesPercent(series.code);
        const stateLabel = isMain ? "主线" : available ? "可探索" : "暂未开放";
        return '<button type="button" class="explorer-module explorer-' + series.code.toLowerCase() + (state.activeSeries === series.code && state.studentScreen === "map" ? " selected" : "") + '" data-student-module="' + series.code + '">' +
          '<span class="explorer-letter">' + series.code + '</span>' +
          '<span class="explorer-module-copy"><strong>' + escapeHtml(studentSeriesName(series)) + '</strong><small>' + stateLabel + '</small></span>' +
          '<b>' + percent + '%</b>' +
        '</button>';
      }).join("") + '</nav>';
    }
    function renderStudentFocus() {
      const box = byId("studentFocus");
      if (!box || state.me?.role !== "student") return;
      const c = counts();
      const next = nextLearningNode();
      const moduleCode = focusModuleCode();
      const module = route().modules.find(item => item.code === moduleCode);
      const moduleTotal = module?.nodes.length || 0;
      const moduleMastered = module ? module.nodes.filter(node => statusFor(node.code) === "mastered").length : 0;
      const modulePercent = moduleTotal ? Math.round((moduleMastered / moduleTotal) * 100) : 0;
      const assignedTasks = activeAssignmentTasks(6);
      const openAssignments = state.assignments.filter(assignmentIsOpen);
      const primaryAssignment = openAssignments[0];
      const primaryPending = primaryAssignment ? pendingHomeworkItems(primaryAssignment) : [];
      const primaryTotal = primaryAssignment ? assignmentItems(primaryAssignment).length : 0;
      const primaryDone = primaryAssignment ? Math.max(0, primaryTotal - primaryPending.length) : 0;
      const openMistakes = (state.mistakes || []).filter((item) => (item.status || "open") === "open");
      document.body.classList.toggle("has-homework", Boolean(primaryAssignment && primaryPending.length));

      if (state.studentScreen === "tasks") {
        const assignmentHtml = openAssignments.length
          ? openAssignments.map(assignment => {
              const items = pendingHomeworkItems(assignment);
              const done = Math.max(0, assignmentItems(assignment).length - items.length);
              return '<article class="student-task-card"><div><span class="student-section-kicker">老师作业</span><h2>' + escapeHtml(assignment.title || "老师布置的作业") + '</h2><p>' + escapeHtml(assignment.note || (assignment.dueDate ? "截止：" + assignment.dueDate : "按自己的节奏完成")) + '</p></div><div class="student-task-progress"><strong>' + done + '/' + assignmentItems(assignment).length + '</strong><span>已完成</span></div><div class="student-task-nodes">' + items.map(item => '<button type="button" data-homework-node="' + escapeHtml(item.nodeId) + '" data-homework-route="' + escapeHtml(item.routeKey || routeKeyForNodeId(item.nodeId)) + '"><strong>' + escapeHtml(item.nodeId) + '</strong><span>开始</span></button>').join("") + '</div></article>';
            }).join("")
          : '<div class="student-empty-state"><strong>今天没有老师作业</strong><span>可以继续自己的主线，也可以复习一题错题。</span></div>';
        const mistakeHtml = openMistakes.length
          ? openMistakes.slice(0, 3).map(item => '<button type="button" class="student-mistake-preview" data-mistake-node="' + escapeHtml(item.nodeId) + '" data-mistake-route="' + escapeHtml(item.routeKey || routeKeyForNodeId(item.nodeId)) + '"><span>' + escapeHtml(layerDisplayName(item.layer)) + '</span><strong>' + escapeHtml(item.nodeId + " " + (item.nodeTitle || "")) + '</strong><small>' + escapeHtml(item.reason || "回到这关再看一次。") + '</small></button>').join("")
          : '<div class="student-empty-state calm"><strong>错题本很干净</strong><span>继续保持，做题时遇到不确定的地方可以慢一点。</span></div>';
        box.innerHTML = '<section class="student-page student-task-page"><div class="student-page-heading"><div><span class="student-section-kicker">任务仓</span><h1>先完成最重要的一件事</h1><p>作业完成后会自动告诉老师，不需要再额外提交。</p></div><button type="button" class="student-link-button" data-student-jump="today">回到今天</button></div><div class="student-task-list">' + assignmentHtml + '</div><section class="student-review-shelf"><div class="student-shelf-title"><div><span class="student-section-kicker">复习站</span><h2>待复习错题</h2></div><button type="button" class="student-link-button" data-student-jump="growth">看成长</button></div><div class="student-mistake-grid">' + mistakeHtml + '</div></section></section>';
      } else if (state.studentScreen === "growth") {
        const report = state.report || { thisWeekLearned: [], nextWeekSuggestions: [] };
        box.innerHTML = '<section class="student-page student-growth-page"><div class="student-page-heading"><div><span class="student-section-kicker">成长</span><h1>看见自己越来越会数学</h1><p>能力图只统计每道题第一次作答的结果。</p></div><button type="button" class="student-link-button" data-student-jump="today">继续学习</button></div><div class="student-growth-grid"><section class="student-radar-card">' + renderMasteryRadarBoard() + '</section><section class="student-next-steps"><span class="student-section-kicker">下一步</span><h2>' + escapeHtml(next ? next.code + " " + next.skill : "你已经完成当前路线") + '</h2><p>' + escapeHtml((report.nextWeekSuggestions || []).length ? "接下来可以练：" + report.nextWeekSuggestions.join("、") : "保持每次认真完成一小关。") + '</p>' + (next ? '<button class="primary" type="button" id="openGrowthNext">去做这一关</button>' : "") + '</section></div><section class="student-diagnosis-card"><span class="student-section-kicker">本周回顾</span>' + (renderWeeklyDiagnosisHtml() || '<h2>本周还没有新的学习记录</h2><p>完成一次检测后，这里会告诉你自己的优势和下一步。</p>') + '</section></section>';
        byId("openGrowthNext")?.addEventListener("click", () => openAssignmentNode(next.code, next.routeKey));
      } else if (state.studentScreen === "map") {
        box.innerHTML = '<section class="student-page student-map-intro"><div class="student-page-heading"><div><span class="student-section-kicker">学习地图</span><h1>选择一条数学河流</h1><p>主线会带你往前走，老师布置的任务和已开放支线也可以探索。</p></div><button type="button" class="student-link-button" data-student-jump="today">回到今天</button></div>' + renderStudentModuleDock() + '</section>';
      } else {
        const assignmentLabel = primaryAssignment && primaryPending.length ? "老师任务优先" : "今日主线";
        const assignmentHint = primaryAssignment && primaryPending.length
          ? "先完成老师布置的 " + primaryDone + "/" + primaryTotal + " 个节点"
          : (module ? module.code + " · " + module.title : routeLabel());
        box.innerHTML = '<section class="student-page student-today-page">' +
          '<div class="student-page-heading compact"><div><span class="student-section-kicker">今天的出发点</span><h1>把这一关走扎实</h1></div><span class="student-route-chip">' + escapeHtml(assignmentHint) + '</span></div>' +
          renderStudentModuleDock() +
          '<section class="student-mission-card"><div class="student-mission-copy"><span class="student-section-kicker">' + escapeHtml(assignmentLabel) + '</span><h2>' + escapeHtml(next ? next.code + " " + next.skill : "今天先选择一关开始") + '</h2><p>' + escapeHtml(next ? "一次只做一题，每两题就会得到一次反馈。" : "你已经完成这一段路线，可以打开地图看看下一段。") + '</p><div class="student-mission-actions">' + (next ? '<button class="primary" type="button" id="openNextNode">开始这一关</button>' : "") + '<button type="button" data-student-jump="map">打开学习地图</button></div></div><div class="student-mission-progress"><strong>' + (primaryAssignment ? primaryDone + "/" + primaryTotal : modulePercent + "%") + '</strong><span>' + (primaryAssignment ? "作业完成" : "当前模块") + '</span><i><b style="width:' + (primaryAssignment && primaryTotal ? Math.round((primaryDone / primaryTotal) * 100) : modulePercent) + '%"></b></i></div></section>' +
          '<section class="student-quick-row"><button type="button" class="student-quick-card task" data-student-jump="tasks"><span>任务仓</span><strong>' + (assignedTasks.length ? assignedTasks.length + " 个待完成" : "今天无作业") + '</strong><small>' + (primaryAssignment?.dueDate ? "截止 " + primaryAssignment.dueDate : "查看老师安排") + '</small></button><button type="button" class="student-quick-card mistake" data-student-jump="tasks"><span>错题本</span><strong>' + openMistakes.length + " 道待复习" + '</strong><small>回去看清错因</small></button><button type="button" class="student-quick-card growth" data-student-jump="growth"><span>我的成长</span><strong>' + moduleMastered + "/" + moduleTotal + " 已掌握" + '</strong><small>看能力与下一步</small></button></section></section>';
        byId("openNextNode")?.addEventListener("click", () => next?.routeKey ? openAssignmentNode(next.code, next.routeKey) : openNode(next.code));
      }
      document.querySelectorAll("[data-student-jump]").forEach(btn => btn.addEventListener("click", () => setStudentScreen(btn.dataset.studentJump)));
      document.querySelectorAll("[data-student-module]").forEach(btn => btn.addEventListener("click", () => {
        state.activeSeries = btn.dataset.studentModule;
        state.collapsed = new Set();
        saveStudentUiState();
        setStudentScreen("map");
      }));
      document.querySelectorAll("[data-homework-node]").forEach(btn => btn.addEventListener("click", () => openAssignmentNode(btn.dataset.homeworkNode, btn.dataset.homeworkRoute)));
      document.querySelectorAll("[data-mistake-node]").forEach(btn => btn.addEventListener("click", () => openAssignmentNode(btn.dataset.mistakeNode, btn.dataset.mistakeRoute)));
    }
    function renderSeriesOverview() {
      const entries = Object.values(SERIES);
      byId("routeTitle").textContent = state.me?.role === "student" ? "学习星球" : routeLabel();
      byId("routeSubtitle").textContent = state.me?.role === "student"
        ? "选择一颗星球查看关卡；先完成任务舱里的当前任务，也可以看看其他路线。"
        : (ROUTE_META[state.routeKey]?.subtitle || "");
      byId("routeSelect").value = state.routeKey;
      byId("puzzleMap").innerHTML = entries.map(series => {
        const total = seriesNodeCount(series.code);
        const mastered = seriesMasteredCount(series.code);
        const percent = seriesPercent(series.code);
        return '<button class="puzzle-block ' + series.className + (state.activeSeries === series.code ? " active" : "") + '" type="button" data-series="' + series.code + '">' +
          '<div class="puzzle-code">' + series.code + '</div>' +
          '<div class="puzzle-name">' + escapeHtml(studentSeriesName(series)) + '</div>' +
          '<div class="puzzle-desc">' + escapeHtml(series.short) + '</div>' +
          seriesProgressHtml(series.code) +
          '<div class="puzzle-note">' + percent + "%</div>" +
          '<div class="planet-status">' + mastered + "/" + total + " 已掌握</div>" +
        '</button>';
      }).join("");
      byId("seriesCards").innerHTML = entries.map(series => {
        const total = seriesNodeCount(series.code);
        const mastered = seriesMasteredCount(series.code);
        return '<button class="series-card' + (state.activeSeries === series.code ? " active" : "") + '" type="button" data-series="' + series.code + '">' +
          '<div class="code">' + series.code + '系列</div>' +
          '<div class="name">' + escapeHtml(series.name) + '</div>' +
          '<div class="series-desc">' + escapeHtml(series.short) + '</div>' +
          seriesProgressHtml(series.code) +
          '<span class="badge">' + mastered + "/" + total + ' 已掌握</span>' +
        '</button>';
      }).join("");
      byId("seriesTabs").innerHTML =
        (state.me?.role === "student" ? "" : '<button class="series-tab' + (state.activeSeries === "all" ? " active" : "") + '" type="button" data-series="all"><strong>全部</strong><br><span class="badge">' + allNodes().length + '节点</span></button>') +
        entries.map(series => '<button class="series-tab' + (state.activeSeries === series.code && !studentCurrentFocusMode() ? " active" : "") + '" type="button" data-series="' + series.code + '"><strong>' + series.code + '</strong><span>' + escapeHtml(series.name) + '</span><small>' + escapeHtml(series.short) + '</small>' + seriesProgressHtml(series.code) + '<span class="badge">' + seriesNodeCount(series.code) + '站</span></button>').join("");
      document.querySelectorAll("[data-series]").forEach(el => el.addEventListener("click", () => {
        state.activeSeries = el.dataset.series;
        state.collapsed = new Set();
        if (state.me?.role === "student") state.studentViewMode = "series";
        renderAll();
        (state.me?.role === "student" ? byId("modules") : byId("modulesTitle")).scrollIntoView({ behavior: "smooth", block: "start" });
      }));
      const active = SERIES[state.activeSeries];
      if (state.me?.role === "student") {
        if (studentCurrentFocusMode()) {
          const module = route().modules.find(item => item.code === focusModuleCode());
          byId("modulesTitle").textContent = "选择学习大陆";
          byId("modulesHint").textContent = "A-E 是五大学习路线；下面先显示今天要走的 " + escapeHtml(module ? module.code : "当前模块") + "。";
        } else {
          byId("modulesTitle").textContent = active ? active.code + "系列：" + active.name : "当前系列";
          byId("modulesHint").textContent = "正在查看这个系列；灰色节点表示还没解锁。";
        }
        byId("showOverview").textContent = studentCurrentFocusMode() ? "今日任务" : "回到今日任务";
      } else {
        byId("modulesTitle").textContent = active ? active.code + "系列：" + active.name : "全部路线模块";
        byId("modulesHint").textContent = active ? "正在查看这个系列的模块和节点。" : "也可以直接从下面打开模块。";
        byId("showOverview").textContent = "回到当前路线";
      }
    }
    function nodeMatches(node) {
      const q = state.query.trim().toLowerCase();
      if (!q) return true;
      return [node.code, node.skill, node.prereq, node.mastery, node.module.title].join(" ").toLowerCase().includes(q);
    }
    function statusMatches(node) {
      if (state.status === "all") return true;
      if (state.status === "unfinished") {
        const unfinished = statusFor(node.code) !== "mastered";
        return state.me?.role === "student" && studentCurrentFocusMode() ? unfinished && isUnlocked(node.code) : unfinished;
      }
      if (state.status === "unlocked") return isUnlocked(node.code);
      return statusFor(node.code) === state.status;
    }
    function badge(code) {
      const meta = progressMeta[statusFor(code)] || progressMeta.not_started;
      return '<span class="badge ' + meta.className + '">' + meta.label + '</span>';
    }
    function renderModules() {
      let visible = 0;
      const modules = visibleModules();
      byId("modules").innerHTML = modules.map(module => {
        const collapsed = state.collapsed.has(module.code);
        const nodes = module.nodes.filter(node => nodeMatches({ ...node, module }) && statusMatches(node));
        if (nodes.length) visible += 1;
        return '<section class="module' + (nodes.length ? "" : " hidden") + '" data-module="' + escapeHtml(module.code) + '">' +
          '<div class="module-head" data-toggle="' + escapeHtml(module.code) + '"><div class="module-code">' + escapeHtml(module.code) + '</div><div class="module-title">' + escapeHtml(module.title) + '</div><div class="module-count">' + nodes.length + "/" + module.nodes.length + ' 个</div></div>' +
          '<div class="river' + (collapsed ? " hidden" : "") + '">' + nodes.map((node, index) => renderNode(module, node, index)).join("") + '</div>' +
        '</section>';
      }).join("");
      byId("empty").classList.toggle("hidden", visible !== 0);
      document.querySelectorAll("[data-toggle]").forEach(el => el.addEventListener("click", () => {
        const code = el.dataset.toggle;
        if (state.collapsed.has(code)) state.collapsed.delete(code); else state.collapsed.add(code);
        renderModules();
      }));
      document.querySelectorAll("[data-node]").forEach(el => el.addEventListener("click", () => openNode(el.dataset.node)));
    }
    function renderNode(module, node, index = 0) {
      const locked = !isUnlocked(node.code);
      const nextCode = state.me?.role === "student" ? nextLearningNode()?.code : "";
      const hasOpenMistake = state.me?.role === "student" && (state.mistakes || []).some(item => item.nodeId === node.code && (item.status || "open") === "open");
      const assigned = state.me?.role === "student" && isAssignedNode(node.code);
      const classes = [
        "river-node",
        index % 3 === 1 ? "branch" : "",
        locked ? "locked" : "",
        nextCode === node.code ? "current" : "",
        assigned ? "assigned" : "",
        hasOpenMistake ? "remediate" : "",
        statusFor(node.code) === "mastered" ? "completed" : "",
      ].filter(Boolean).join(" ");
      const qc = reviewCountsFor(node.code);
      const reviewLine = state.me?.role === "teacher" && qc.total
        ? '<div class="prereq">题库：已复核 ' + qc.vetted + '｜草稿 ' + qc.draft + '｜隐藏 ' + qc.hidden + '</div>'
        : '';
      return '<article class="' + classes + '" data-node="' + escapeHtml(node.code) + '">' +
        '<div class="node-top"><span class="node-code">' + escapeHtml(node.code) + '</span>' + badge(node.code) + '</div>' +
        '<div class="skill">' + escapeHtml(node.skill) + '</div>' +
        '<div class="prereq">前置：' + escapeHtml(node.prereq || "无") + '</div>' +
        reviewLine +
      '</article>';
    }
    function renderAll() { syncStudentPanels(); renderMetrics(); renderStudentFocus(); renderSeriesOverview(); renderModules(); renderWeeklyReport(); renderMistakeBook(); renderUnlockPolicyManager(); renderAssignmentAlerts(); renderAssignments(); renderLoginLogs(); }
    function findNode(code) {
      for (const module of route().modules) {
        const node = module.nodes.find(item => item.code === code);
        if (node) return { module, node };
      }
      return null;
    }
    function openAssignmentNode(code, routeKey) {
      const targetRoute = routeKeyForNodeId(code, routeKey || state.routeKey);
      state.routeKey = targetRoute;
      state.activeSeries = moduleSeries(code.split("-")[0]);
      state.studentViewMode = state.me?.role === "student" ? "series" : state.studentViewMode;
      renderAll();
      requestAnimationFrame(() => openNode(code));
    }
    function openNode(code) {
      const found = findNode(code);
      if (!found) return;
      state.currentNode = found.node;
      byId("dialogTitle").textContent = found.node.code + " " + found.node.skill;
      byId("details").innerHTML = state.me?.role === "student"
        ? '<div class="student-node-brief"><span>这一关要学</span><strong>' + escapeHtml(found.node.skill) + '</strong><p>' + escapeHtml(found.node.mastery || "做完 10 道题，看看自己已经掌握了多少。") + '</p></div>'
        : [
            ["模块", found.module.code + " " + found.module.title],
            ["前置", found.node.prereq || "无"],
            ["教材来源", found.node.source || ""],
            ["Mastery", found.node.mastery || ""],
          ].map(([k, v]) => '<div class="detail-row"><span>' + escapeHtml(k) + '</span><div>' + escapeHtml(v) + '</div></div>').join("");
      renderProgressActions(code);
      renderPractice(code);
      byId("nodeDialog").showModal();
    }
    function shuffle(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
    function layerSortIndex(layer) {
      const ability = abilityForLayer(layer);
      const order = ["concept", "model", "mental", "standard", "application"];
      const index = order.indexOf(ability);
      return index >= 0 ? index : order.length;
    }
    function layerDisplayName(layer) {
      const ability = abilityForLayer(layer);
      const found = ABILITY_LAYERS.find(item => item.key === ability);
      return found?.label || String(layer || "").replace(/层$/, "");
    }
    function orderedLayerEntries(questions) {
      return ABILITY_LAYERS
        .map(item => [item.layer, questions.filter(question => abilityForLayer(question.layer) === item.key)])
        .filter(([, items]) => items.length);
    }
    function orderedPracticeQuestions(questions) {
      return questions
        .slice()
        .sort((a, b) => {
          const layerDiff = layerSortIndex(a.layer) - layerSortIndex(b.layer);
          if (layerDiff) return layerDiff;
          const orderDiff = Number(a.order || 0) - Number(b.order || 0);
          if (orderDiff) return orderDiff;
          return String(a.id || "").localeCompare(String(b.id || ""));
        })
        .map((question, index) => {
          const normalized = { ...question, order: index + 1 };
          return Array.isArray(question.options) ? { ...normalized, options: shuffle(question.options) } : normalized;
        });
    }
    function renderProgressActions(code) {
      const current = statusFor(code);
      const canMark = state.me.role === "teacher";
      byId("progressActions").innerHTML =
        badge(code) +
        (canMark ? Object.entries(progressMeta).map(([status, meta]) => '<button type="button" data-mark="' + status + '"' + (status === current ? ' class="primary"' : '') + '>' + meta.label + '</button>').join("") : "") +
        '<span>' + escapeHtml(unlockInfo(code).label) + '</span>';
      document.querySelectorAll("[data-mark]").forEach(btn => btn.addEventListener("click", async () => {
        await api("/api/progress", { method: "POST", body: JSON.stringify({ studentId: state.activeStudentId, nodeId: code, status: btn.dataset.mark }) });
        await loadProgress();
        await loadAssignments();
        await loadAssignmentAlerts();
        await loadReport();
        await loadWeeklyDiagnosis();
        renderProgressActions(code);
        renderMetrics();
        renderModules();
        renderAssignmentAlerts();
        renderAssignments();
        renderStudentFocus();
        renderWeeklyReport();
      }));
      const history = recordFor(code).history || [];
      byId("history").innerHTML = history.length ? history.slice(-5).reverse().map(item => '<div>' + escapeHtml(progressMeta[item.status]?.label || item.status) + "｜" + escapeHtml(new Date(item.at).toLocaleString("zh-CN")) + '</div>').join("") : '<div>还没有记录。</div>';
    }
    function renderPractice(code) {
      const locked = !isUnlocked(code);
      const questions = questionsFor(code);
      if (locked && state.me.role !== "teacher") {
        byId("practice").innerHTML = '<div class="empty">这个节点还没有开启。</div>';
        return;
      }
      if (!questions.length) {
        byId("practice").innerHTML = '<div class="empty">' + (state.me?.role === "teacher" ? "这个节点暂时没有题目。" : "这个节点的检测题正在复核，暂时不开放自动批改。") + '</div>';
        return;
      }
      const ordered = orderedPracticeQuestions(questions);
      state.currentQuestions = ordered;
      const readOnly = state.me.role === "parent" || state.me.role === "guest";
      const autoGradable = questions.every(question => Array.isArray(question.options) && question.options.length && "answer" in question);
      const nodeTitle = state.currentNode?.skill || code;
      const layerEntries = orderedLayerEntries(ordered);
      if (state.me?.role === "student" && autoGradable) {
        renderStudentPracticeRunner(code, ordered, layerEntries, nodeTitle);
        return;
      }
      byId("practice").innerHTML =
        '<div class="practice-hero">' +
          '<div><div class="practice-kicker">掌握检测</div><h3>闯关检测：' + escapeHtml(code) + '</h3><p>' + escapeHtml(nodeTitle) + '</p></div>' +
          '<div class="practice-score-chip"><strong>' + ordered.length + '</strong><span>题</span></div>' +
        '</div>' +
        '<div class="practice-layer-track">' + layerEntries.map(([layer, items], index) => '<span><b>' + (index + 1) + '</b>' + escapeHtml(layerDisplayName(layer)) + '<em>' + items.length + '题</em></span>').join("") + '</div>' +
        (state.me?.role === "teacher" ? '<div class="practice-teacher-note">老师视图：可以看到草稿、隐藏、已复核全部题；学生端只显示“已复核”题。</div>' : '') +
        layerEntries.map(([layer, items], index) => '<details class="question-layer"' + (index === 0 ? " open" : "") + '><summary><span>' + escapeHtml(layerDisplayName(layer)) + '层</span><span>' + items.length + '题</span></summary>' + items.map(renderQuestion).join("") + '</details>').join("") +
        (readOnly ? '<div class="empty">家长账号为只读模式。</div>' : (autoGradable ? '<div class="attempt-bar"><button class="primary" id="submitAttempt" type="button">提交闯关</button><span id="attemptSummary" class="attempt-summary">完成后自动批改</span></div>' : '<div class="empty">中学题库当前为开放题，请完成后由老师在上方记录进度。</div>'));
      if (!readOnly && autoGradable) byId("submitAttempt").addEventListener("click", () => submitAttempt(code).catch(() => {}));
      document.querySelectorAll("[data-review-status]").forEach(btn => btn.addEventListener("click", () => updateQuestionReview(code, btn.dataset.questionId, btn.dataset.reviewStatus)));
    }
    function renderStudentPracticeRunner(code, questions, layerEntries, nodeTitle) {
      state.currentQuestions = questions;
      state.currentPractice = {
        code,
        questions,
        answers: {},
        confirmedAnswers: {},
        checked: {},
        currentIndex: 0,
        showCheckpoint: false,
        submitting: false,
        clientAttemptId: "web-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2),
      };
      byId("practice").innerHTML =
        '<div class="practice-runner-shell">' +
          '<div class="runner-topline">' +
            '<div><div class="practice-kicker">掌握检测</div><h3>' + escapeHtml(code) + '</h3><p>' + escapeHtml(nodeTitle) + '</p></div>' +
            '<div class="runner-score" id="runnerScore"><strong>0</strong><span>已答题</span></div>' +
          '</div>' +
          '<div class="runner-layer-strip">' + layerEntries.map(([layer, items], index) => '<span><b>' + (index + 1) + '</b>' + escapeHtml(layerDisplayName(layer)) + '<em>' + items.length + '题</em></span>').join("") + '</div>' +
          '<div id="practiceRunner" class="practice-runner"></div>' +
        '</div>';
      renderPracticeRunnerStep();
    }
    function selectedReasonFor(question, selected) {
      const diagnostics = question.quality?.distractorDiagnostics || [];
      const selectedReason = diagnostics.find(item => item.startsWith(selected + "：") || item.includes(". " + selected + "：") || item.includes(selected + "："));
      return selectedReason ? selectedReason.replace(/^[A-D]\.\s*/, "").replace(selected + "：", "") : "这个选项对应的关系或计算有问题。";
    }
    function markRenderedQuestion(question, selected, ok) {
      const questionEl = document.querySelector('[data-question="' + CSS.escape(question.id) + '"]');
      if (!questionEl) return;
      questionEl.classList.toggle("is-correct", !!ok);
      questionEl.classList.toggle("is-wrong", !ok);
      questionEl.querySelectorAll(".answers label").forEach(label => {
        const input = label.querySelector("input");
        const value = input?.value || "";
        if (value === selected && input) input.checked = true;
        label.classList.toggle("option-selected", value === selected);
        label.classList.toggle("option-correct", value === selected && !!ok);
        label.classList.toggle("option-wrong", value === selected && !ok);
        label.classList.toggle("option-answer", !ok && value === question.answer);
      });
      const el = questionEl.querySelector(".result");
      if (!el) return;
      el.className = "result " + (ok ? "correct" : "wrong");
      el.textContent = ok ? "正确，继续保持。" : "再想想：" + selectedReasonFor(question, selected);
    }
    function renderPracticeRunnerStep() {
      const session = state.currentPractice;
      if (!session?.questions?.length) return;
      const runner = byId("practiceRunner");
      if (!runner) return;
      const total = session.questions.length;
      const index = Math.min(session.currentIndex, total - 1);
      const question = session.questions[index];
      const answeredCount = Object.keys(session.checked).length;
      const correctCount = Object.values(session.checked).filter(Boolean).length;
      const pairStart = Math.floor(index / 2) * 2;
      const pairEnd = Math.min(pairStart + 2, total);
      const pairQuestions = session.questions.slice(pairStart, pairEnd);
      const pairAnswered = pairQuestions.every(item => item.id in session.checked);
      const allAnswered = session.questions.every(item => item.id in session.checked);
      const pairCorrect = pairQuestions.filter(item => session.checked[item.id]).length;
      const selected = session.answers[question.id] || "";
      const checked = question.id in session.checked;
      if (byId("runnerScore")) byId("runnerScore").innerHTML = '<strong>' + answeredCount + '/' + total + '</strong><span>答对 ' + correctCount + '</span>';
      const dots = session.questions.map((item, dotIndex) => '<span class="' + (dotIndex === index ? "current " : "") + (item.id in session.checked ? (session.checked[item.id] ? "right" : "miss") : "") + '"></span>').join("");
      const checkpointHtml = session.showCheckpoint && pairAnswered
        ? '<div class="checkpoint-card ' + (pairCorrect === pairQuestions.length ? "good" : "review") + '">' +
            '<div><strong>' + (pairCorrect === pairQuestions.length ? "这一小组很稳" : "这一小组再看一下") + '</strong><span>刚刚 ' + pairQuestions.length + ' 题，答对 ' + pairCorrect + ' 题。</span></div>' +
            (pairCorrect === pairQuestions.length ? '<p>继续下一组，保持这个节奏。</p>' : '<p>先看红色选项的原因，再继续。你不是不会，是这里的关系要再分清。</p>') +
          '</div>'
        : "";
      const actionHtml = session.submitting
        ? '<button class="primary" id="finishPracticeRunner" type="button" disabled>正在提交...</button>'
        : allAnswered
          ? '<button class="primary" id="finishPracticeRunner" type="button">提交给老师</button>'
          : !checked
        ? '<button class="primary" id="checkCurrentQuestion" type="button">确认答案</button>'
        : (session.showCheckpoint && pairAnswered
          ? '<button class="primary" id="continuePracticeRunner" type="button">继续下一组</button>'
          : '<button class="primary" id="nextPracticeQuestion" type="button">下一题</button>');
      runner.innerHTML =
        '<div class="runner-progress"><div><span>第 ' + (index + 1) + ' / ' + total + ' 题</span><strong>每 2 题给一次小反馈</strong></div><div class="runner-dots">' + dots + '</div></div>' +
        renderQuestion({ ...question, order: index + 1, disabled: checked }) +
        checkpointHtml +
        '<div class="runner-actions">' + actionHtml + '<span id="runnerMessage"></span></div>';
      if (checked) markRenderedQuestion(question, selected, session.checked[question.id]);
      runner.querySelectorAll('input[name="' + CSS.escape(question.id) + '"]').forEach(input => input.addEventListener("change", () => {
        if (question.id in session.checked) return;
        session.answers[question.id] = input.value;
      }));
      byId("checkCurrentQuestion")?.addEventListener("click", () => {
        const picked = runner.querySelector('input[name="' + CSS.escape(question.id) + '"]:checked')?.value || "";
        if (!picked) {
          byId("runnerMessage").textContent = "先选一个答案。";
          return;
        }
        session.answers[question.id] = picked;
        session.confirmedAnswers[question.id] = picked;
        session.checked[question.id] = String(picked).trim() === String(question.answer || "").trim();
        session.showCheckpoint = session.questions.slice(pairStart, pairEnd).every(item => item.id in session.checked);
        renderPracticeRunnerStep();
      });
      byId("nextPracticeQuestion")?.addEventListener("click", () => {
        session.currentIndex = Math.min(index + 1, total - 1);
        session.showCheckpoint = false;
        renderPracticeRunnerStep();
      });
      byId("continuePracticeRunner")?.addEventListener("click", () => {
        session.currentIndex = Math.min(pairEnd, total - 1);
        session.showCheckpoint = false;
        renderPracticeRunnerStep();
      });
      byId("finishPracticeRunner")?.addEventListener("click", () => finishPracticeRunner());
    }
    async function finishPracticeRunner() {
      const session = state.currentPractice;
      if (!session || session.submitting) return;
      session.questions.forEach((question) => {
        if (!(question.id in session.confirmedAnswers) && session.answers[question.id]) {
          session.confirmedAnswers[question.id] = session.answers[question.id];
          session.checked[question.id] = String(session.answers[question.id]).trim() === String(question.answer || "").trim();
        }
      });
      const missing = session.questions.find(item => !String(session.confirmedAnswers[item.id] || "").trim());
      if (missing) {
        const missingIndex = session.questions.findIndex(item => item.id === missing.id);
        session.currentIndex = Math.max(0, missingIndex);
        session.showCheckpoint = false;
        renderPracticeRunnerStep();
        const message = byId("runnerMessage");
        if (message) message.textContent = "还有题目没有确认答案，请先完成这一题。";
        return;
      }
      session.submitting = true;
      renderPracticeRunnerStep();
      try {
        await submitAttempt(session.code, session.confirmedAnswers, { clientAttemptId: session.clientAttemptId });
      } catch (error) {
        session.submitting = false;
        renderPracticeRunnerStep();
        const message = byId("runnerMessage");
        if (message) message.textContent = "提交没有成功，请再点一次。原因：" + error.message;
      }
    }
    function renderPracticeRunnerFinal(result) {
      const runner = byId("practiceRunner");
      if (!runner) return;
      const retry = !result.passed && !result.recommendations?.length;
      const actionLabel = result.passed ? "通过，前往下一关" : retry ? "建议重测当前关" : "先回补指定节点";
      runner.innerHTML =
        '<div class="runner-final ' + (result.passed ? "passed" : "retry") + '">' +
          '<strong>' + (result.passed ? "这一关通过了" : retry ? "再练一次会更稳" : "先补好这一小段") + '</strong>' +
          '<p>本次答对 ' + result.score + ' / ' + result.total + ' 题。' + (result.offlineQueued ? "已先保存在本机，联网后会同步给老师。" : (result.completedAssignments?.length ? "作业已提交给老师。" : "学习记录已保存。")) + '</p>' +
          (result.recommendations?.length ? '<div class="runner-remediate">先回补：' + escapeHtml(result.recommendations.join("、")) + '</div>' : '') +
          '<button class="primary" type="button" id="continueAfterSubmit">' + actionLabel + '</button>' +
          '<button type="button" id="closePracticeAfterSubmit">回到学习地图</button>' +
        '</div>';
      byId("continueAfterSubmit")?.addEventListener("click", () => {
        if (result.passed) {
          byId("nodeDialog").close();
          const next = nextLearningNode();
          if (next) openAssignmentNode(next.code, next.routeKey);
          else setStudentScreen("map");
          return;
        }
        if (result.recommendations?.length) {
          byId("nodeDialog").close();
          openAssignmentNode(result.recommendations[0], routeKeyForNodeId(result.recommendations[0], state.routeKey));
          return;
        }
        renderPractice(state.currentPractice?.code || state.currentNode?.code || "");
      });
      byId("closePracticeAfterSubmit")?.addEventListener("click", () => { byId("nodeDialog").close(); setStudentScreen("map"); });
    }
    function renderQuestion(question) {
      const optionLetters = ["A", "B", "C", "D", "E", "F"];
      const meta = reviewMeta[question.status || "draft"] || reviewMeta.draft;
      const teacherReview =
        state.me?.role === "teacher"
          ? '<div class="question-review">' +
              '<div class="question-meta"><span class="badge ' + meta.className + '">' + meta.label + '</span><span>来源：' + escapeHtml(question.source || "unknown") + '</span></div>' +
              '<div><strong>答案：</strong>' + escapeHtml(question.answer || "") + '</div>' +
              '<div><strong>答案理由：</strong>' + escapeHtml(question.quality?.answerReason || "待补充") + '</div>' +
              '<div><strong>干扰项错因：</strong>' + escapeHtml((question.quality?.distractorDiagnostics || []).join("；") || "待补充") + '</div>' +
              '<div class="control-row">' +
                Object.entries(reviewMeta).map(([status, info]) => '<button type="button" data-question-id="' + escapeHtml(question.id) + '" data-review-status="' + status + '"' + (status === (question.status || "draft") ? ' class="primary"' : '') + '>' + info.label + '</button>').join("") +
              '</div>' +
            '</div>'
          : "";
      return '<div class="question" data-question="' + escapeHtml(question.id) + '">' +
        '<div class="question-head"><span class="question-index">第' + escapeHtml(question.order || "") + '题</span><div class="prompt">' + escapeHtml(question.prompt) + '</div></div>' +
        (Array.isArray(question.options) ? '<div class="answers">' + question.options.map((option, index) => '<label><input type="radio" name="' + escapeHtml(question.id) + '" value="' + escapeHtml(option) + '"' + (question.disabled ? " disabled" : "") + ' /> <span class="option-letter">' + escapeHtml(optionLetters[index] || String(index + 1)) + '</span><span>' + escapeHtml(option) + '</span></label>').join("") + '</div>' : '<textarea rows="3" placeholder="在纸上完成，或在这里写下答案/思路。"></textarea>') +
        teacherReview +
        '<div class="result"></div>' +
      '</div>';
    }
    async function updateQuestionReview(code, questionId, status) {
      const question = allQuestionsFor(code).find(item => item.id === questionId);
      if (!question) return;
      const result = await api("/api/question-review", { method: "POST", body: JSON.stringify({ routeKey: state.routeKey, nodeId: code, questionId, status, note: question.quality?.reviewerNote || "" }) });
      question.status = result.review.status;
      question.reviewedAt = result.review.reviewedAt;
      question.reviewedBy = result.review.reviewedBy;
      renderPractice(code);
      renderModules();
    }
    async function refreshAfterAttempt(code) {
      try {
        await loadProgress();
        await loadAssignments();
        await loadAssignmentAlerts();
        await loadReport();
        await loadWeeklyDiagnosis();
        await loadMistakes();
        renderProgressActions(code);
        renderMetrics();
        renderStudentFocus();
        renderSeriesOverview();
        renderModules();
        renderAssignmentAlerts();
        renderAssignments();
        renderWeeklyReport();
        renderMistakeBook();
      } catch (error) {
        console.warn("Attempt was saved, but follow-up refresh failed.", error);
      }
    }
    async function submitAttempt(code, providedAnswers = null, extraPayload = {}) {
      const runnerMode = Boolean(providedAnswers && state.currentPractice?.code === code);
      const questions = state.currentQuestions || questionsFor(code);
      const answers = providedAnswers ? { ...providedAnswers } : {};
      if (!providedAnswers) {
        questions.forEach(q => {
          answers[q.id] = document.querySelector('input[name="' + CSS.escape(q.id) + '"]:checked')?.value || "";
        });
      }
      const missing = questions.filter(q => !String(answers[q.id] || "").trim());
      if (missing.length) {
        const message = runnerMode ? byId("runnerMessage") : byId("attemptSummary");
        if (message) {
          message.className = runnerMode ? "" : "attempt-summary retry";
          message.textContent = "还有 " + missing.length + " 道题没有选择，请全部完成后再提交。";
        }
        throw new Error("还有题目没有选择。");
      }
      const result = await api("/api/attempt", { method: "POST", body: JSON.stringify({ studentId: state.activeStudentId, nodeId: code, routeKey: state.routeKey, answers, ...extraPayload }) });
      if (!runnerMode) {
        questions.forEach(q => {
          const ok = result.results[q.id];
          const selected = answers[q.id];
          markRenderedQuestion(q, selected, ok);
          const questionEl = document.querySelector('[data-question="' + CSS.escape(q.id) + '"]');
          const el = questionEl?.querySelector(".result");
          if (el && !selected) {
            el.className = "result wrong";
            el.textContent = "请选择一个答案。";
          }
        });
      }
      const completedNote = result.completedAssignments?.length ? "｜作业已提交给老师" : "";
      const summary = byId("attemptSummary");
      if (summary) {
        summary.className = "attempt-summary " + (result.passed ? "passed" : "retry");
        summary.textContent = (result.passed ? "已过关：" : "本次：") + result.score + "/" + result.total + completedNote + (result.recommendations?.length ? "｜建议回补：" + result.recommendations.join("、") : "");
      }
      await refreshAfterAttempt(code);
      if (runnerMode) renderPracticeRunnerFinal(result);
      return result;
    }
    byId("studentSelect").addEventListener("change", async e => {
      state.activeStudentId = e.target.value;
      if (state.me.role === "teacher") {
        state.routeKey = routeKeyForStudent(currentStudent());
        state.activeSeries = preferredSeriesForStudent(currentStudent());
      }
      await loadProgress();
      await loadAssignments();
      await loadAssignmentAlerts();
      await loadReport();
      await loadWeeklyDiagnosis();
      await loadMistakes();
      focusCurrentLearningView();
      renderAll();
    });
    byId("routeSelect").addEventListener("change", e => {
      state.routeKey = e.target.value;
      state.activeSeries = e.target.value === routeKeyForStudent(currentStudent()) ? preferredSeriesForStudent(currentStudent()) : "all";
      focusCurrentLearningView();
      renderAll();
    });
    byId("search").addEventListener("input", e => { state.query = e.target.value; renderModules(); });
    byId("statusFilter").addEventListener("change", e => { state.status = e.target.value; renderModules(); });
    byId("expandAll").addEventListener("click", () => { state.collapsed.clear(); renderModules(); });
    byId("collapseAll").addEventListener("click", () => { state.collapsed = new Set(visibleModules().map(m => m.code)); renderModules(); });
    byId("toggleStudentTools")?.addEventListener("click", () => {
      state.studentToolsOpen = !state.studentToolsOpen;
      syncStudentPanels();
    });
    byId("showOverview").addEventListener("click", () => {
      if (state.me?.role === "student") {
        state.activeSeries = preferredSeriesForStudent(currentStudent());
        state.studentToolsOpen = false;
        state.query = "";
        if (byId("search")) byId("search").value = "";
        setStudentScreen("today");
        return;
      }
      state.activeSeries = "all";
      renderAll();
      byId("mapPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.querySelectorAll("#studentMainNav [data-student-screen]").forEach(btn => btn.addEventListener("click", () => setStudentScreen(btn.dataset.studentScreen)));
    byId("closeDialog").addEventListener("click", () => byId("nodeDialog").close());
    byId("openPassword").addEventListener("click", () => {
      byId("passwordMessage").textContent = "";
      byId("passwordForm").reset();
      byId("passwordDialog").showModal();
    });
    byId("closePassword").addEventListener("click", () => byId("passwordDialog").close());
    byId("refreshReport")?.addEventListener("click", async () => { await loadReport(); await loadWeeklyDiagnosis(); renderWeeklyReport(); });
    byId("generateWeeklyDiagnosis")?.addEventListener("click", async () => {
      const message = byId("rollbackMessage");
      try {
        const result = await api("/api/weekly-diagnostics/generate", { method: "POST", body: JSON.stringify({ studentIds: [state.activeStudentId] }) });
        state.weeklyDiagnosis = result.generated?.[0] || state.weeklyDiagnosis;
        message.textContent = "已生成每周诊断。";
        renderWeeklyReport();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    byId("refreshLoginLog")?.addEventListener("click", async () => {
      const message = byId("loginLogMessage");
      try {
        message.textContent = "正在查询...";
        await loadLoginLogs();
        renderLoginLogs();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    byId("loginLogUsername")?.addEventListener("keydown", async e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      await loadLoginLogs();
      renderLoginLogs();
    });
    byId("fillCurrentNodeAssignment")?.addEventListener("click", () => {
      const input = byId("assignmentNodes");
      if (!input) return;
      const code = state.currentNode?.code || nextLearningNode()?.code || "";
      if (!code) return;
      const existing = input.value.trim();
      input.value = existing ? existing + " " + code : code;
      byId("assignmentMessage").textContent = "已填入节点 " + code + "。";
    });
    byId("createAssignment")?.addEventListener("click", async () => {
      const message = byId("assignmentMessage");
      const studentIds = [...document.querySelectorAll("#assignmentStudents input:checked")].map(input => input.value);
      const payload = {
        studentIds,
        title: byId("assignmentTitle").value.trim(),
        nodeIds: byId("assignmentNodes").value.trim(),
        dueDate: byId("assignmentDueDate").value,
        note: byId("assignmentNote").value.trim(),
        routeKey: state.routeKey,
      };
      if (!studentIds.length || !payload.nodeIds) {
        message.textContent = "请选择学生并填写至少一个节点。";
        return;
      }
      try {
        message.textContent = "正在布置...";
        const result = await api("/api/assignments", { method: "POST", body: JSON.stringify(payload) });
        message.textContent = "已布置给 " + result.created + " 个学生。";
        await loadAssignments();
        await loadAssignmentAlerts();
        await loadReport();
        await loadWeeklyDiagnosis();
        renderAssignmentAlerts();
        renderAssignments();
        renderStudentFocus();
        renderWeeklyReport();
        byId("assignmentTitle").value = "";
        byId("assignmentNodes").value = "";
        byId("assignmentNote").value = "";
      } catch (error) {
        message.textContent = error.message;
      }
    });
    byId("applyBatch")?.addEventListener("click", async () => {
      const studentIds = [...document.querySelectorAll("#batchStudents input:checked")].map(input => input.value);
      const nodeId = byId("batchNode").value.trim();
      const status = byId("batchStatus").value;
      const message = byId("batchMessage");
      if (!studentIds.length || !nodeId) { message.textContent = "请选择学生并填写节点。"; return; }
      const result = await api("/api/progress/batch", { method: "POST", body: JSON.stringify({ studentIds, nodeId, status, markPreviousMastered: byId("batchPrevious").checked }) });
      message.textContent = "已更新 " + result.updated + " 个学生。";
      if (studentIds.includes(state.activeStudentId)) await loadProgress();
      if (studentIds.includes(state.activeStudentId)) await loadAssignments();
      await loadAssignmentAlerts();
      await loadReport();
      await loadWeeklyDiagnosis();
      await loadMistakes();
      renderAll();
    });
    byId("rollbackLast")?.addEventListener("click", async () => {
      const message = byId("rollbackMessage");
      try {
        const result = await api("/api/rollback", { method: "POST", body: JSON.stringify({ studentId: state.activeStudentId }) });
        message.textContent = "已回滚：" + (result.entry?.action || "最近操作");
        await loadProgress();
        await loadAssignments();
        await loadAssignmentAlerts();
        await loadReport();
        await loadWeeklyDiagnosis();
        await loadMistakes();
        renderAll();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    byId("saveUnlockPolicy")?.addEventListener("click", async () => {
      const message = byId("unlockPolicyMessage");
      const series = {};
      document.querySelectorAll("[data-unlock-series]").forEach(select => {
        series[select.dataset.unlockSeries] = select.value;
      });
      try {
        const result = await api("/api/unlock-policy", {
          method: "POST",
          body: JSON.stringify({
            studentId: state.activeStudentId,
            routeKey: "primary",
            policy: { globalMode: byId("primaryGlobalUnlockMode").value, series },
          }),
        });
        state.unlockPoliciesByStudent[state.activeStudentId] = { primary: result.policy };
        message.textContent = "已保存小学解锁规则。";
        renderAll();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    byId("passwordForm").addEventListener("submit", async e => {
      e.preventDefault();
      const form = Object.fromEntries(new FormData(e.target));
      const message = byId("passwordMessage");
      message.style.color = "#b91c1c";
      if (form.newPassword !== form.confirmPassword) {
        message.textContent = "两次输入的新密码不一致。";
        return;
      }
      try {
        await api("/api/password", { method: "POST", body: JSON.stringify(form) });
        message.style.color = "#047857";
        message.textContent = "密码已修改。";
        e.target.reset();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    byId("createStudent").addEventListener("submit", async e => {
      e.preventDefault();
      const form = Object.fromEntries(new FormData(e.target));
      const result = await api("/api/students", { method: "POST", body: JSON.stringify(form) });
      state.students = result.students;
      state.activeStudentId = result.student.id;
      state.unlockPoliciesByStudent[state.activeStudentId] = { primary: defaultPrimaryUnlockPolicy() };
      renderStudentSelect();
      await loadProgress();
      await loadAssignments();
      await loadAssignmentAlerts();
      renderAll();
      e.target.reset();
    });
    bootstrap().then(notifyReady).catch(error => {
      document.body.innerHTML = '<main><div class="empty">加载失败：' + escapeHtml(error.message) + '</div></main>';
    });

})();
