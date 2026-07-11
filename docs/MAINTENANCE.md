# 数学学习系统维护流程

这个项目现在是线上多人学习系统。以后修改时默认先走下面流程，避免每次靠手工记命令。

## 本地检查

```bash
npm run check
```

只做语法检查，不会连接服务器，不会改数据库。现在会检查：

- `math_multiuser_server.mjs`
- `server/appState.mjs`
- `server/assignments.mjs`
- `server/assignmentsView.mjs`
- `server/auth.mjs`
- `server/db.mjs`
- `server/learningPages.mjs`
- `server/loginLogs.mjs`
- `server/middleRouteLoader.mjs`
- `server/primaryRouteLoader.mjs`
- `server/progress.mjs`
- `server/questionBank.mjs`
- `server/questionReview.mjs`
- `server/questions.mjs`
- `server/reports.mjs`
- `server/routeDataLoader.mjs`
- `server/routes.mjs`
- `server/staticAssets.mjs`
- `server/students.mjs`
- `server/uiPage.mjs`
- `public/shared.js`
- `public/admin.js`
- `public/student.js`
- `scripts/smoke_math_system.mjs`
- `scripts/extract_app_assets.mjs`
- `scripts/deploy_math_system.sh`

## 一键部署

```bash
MATH_SERVER_HOST='deploy@your-server' \
MATH_TEACHER_PASSWORD='老师密码' \
npm run deploy
```

脚本会自动完成：

1. 本地语法检查。
2. 服务器备份 `math_multiuser_server.mjs`。
3. 服务器备份 `data/math-learning-db.json`。
4. 上传主程序、冒烟测试脚本和关键图片资源。
5. 服务器语法检查。
6. 重启 `math-system`。
7. 检查 `/healthz`。
8. 运行老师/学生/作业/权限冒烟测试。

## 只跑线上冒烟测试

```bash
MATH_BASE_URL='http://127.0.0.1:4180' \
MATH_TEACHER_USERNAME='stephen' \
MATH_TEACHER_PASSWORD='老师密码' \
node scripts/smoke_math_system.mjs
```

如果在服务器本机运行，`MATH_BASE_URL` 用 `http://127.0.0.1:4180`。

## 冒烟测试会验证什么

- `/healthz` 正常。
- `/public/style.css` 正常返回。
- `/public/shared.js` 正常返回。
- `/public/admin.js` 正常返回。
- `/public/student.js` 正常返回。
- `/assets/student-starry-bg.png` 正常返回。
- `/assets/math-lab-planet-map.png` 正常返回。
- 老师能登录。
- 老师后台有“布置指定作业”。
- 老师后台有“完成作业待确认”提醒区域。
- 登录后的页面引用外部 CSS/JS。
- “新窗口打开学习活动”不会重新出现。
- 老师能查询登录日志，学生不能查询登录日志。
- 老师能查询作业完成提醒，学生不能查询老师提醒。
- 老师能查询学生进度和周报。
- 批量进度接口会校验空请求。
- 老师添加学生接口会校验必填项。
- 学生不能添加学生。
- 题目复核接口会校验题目状态。
- 学生不能复核题目。
- 不存在的检测节点不会写入进度。
- 错误当前密码不能修改密码。
- 能给测试学生创建作业。
- 能读取该学生作业。
- 新建作业不会因为学生过去已经掌握过节点而立刻自动完成。
- 如果设置了 `MATH_TEST_STUDENT_PASSWORD`，学生能看到老师刚布置、尚未归档的测试作业。
- 未完成作业不能被老师提前确认。
- 能归档测试作业。
- 如果设置了 `MATH_TEST_STUDENT_PASSWORD`，学生能登录。
- 学生页面脚本有作业提醒区域。
- 学生页面脚本有闯关检测和老师确认按钮逻辑。
- 如果设置了 `MATH_TEST_STUDENT_PASSWORD`，学生能看自己的作业，不能看其他学生的作业。
- 如果设置了 `MATH_TEST_STUDENT_PASSWORD`，学生能看自己的进度和报告，不能看其他学生的进度。
- 如果设置了 `MATH_TEST_STUDENT_PASSWORD`，学生不能替其他学生提交检测。

## 常用环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `MATH_SERVER_HOST` | 空 | SSH 目标；公开仓库不内置真实服务器地址 |
| `MATH_REMOTE_DIR` | `/opt/math-system` | 服务器项目目录 |
| `MATH_NODE_BIN` | `/usr/local/bin/node20` | 服务器 Node |
| `MATH_SERVICE` | `math-system` | systemd 服务名 |
| `MATH_TEACHER_USERNAME` | `stephen` | 冒烟测试老师账号 |
| `MATH_TEACHER_PASSWORD` | 空 | 冒烟测试老师密码，必须提供 |
| `MATH_TEST_STUDENT_USERNAME` | `Jason` | 冒烟测试学生账号 |
| `MATH_TEST_STUDENT_PASSWORD` | 空 | 冒烟测试学生密码；留空则跳过学生登录测试，避免猜测孩子已修改的密码 |
| `MATH_TEST_STUDENT_NAME` | `Jason` | 创建/归档测试作业使用的学生 |
| `MATH_TEST_NODE_ID` | `A11-1` | 测试作业节点 |
| `MATH_RUN_SMOKE` | `1` | 设为 `0` 可只部署不跑冒烟测试 |

## 当前工程结构

第一阶段已经把“部署和验收”固定下来了。

第二阶段已经把登录后的主系统前端拆出来，并建立角色入口：

- `public/style.css`：老师端、学生端、节点弹窗等主系统样式。
- `public/shared.js`：共享数据加载、路线渲染、节点弹窗、检测、进度基础逻辑。
- `public/admin.js`：老师端入口。后续老师后台逻辑逐步迁入这里。
- `public/student.js`：学生端入口。后续学生任务舱和游戏化交互逐步迁入这里。
- `math_multiuser_server.mjs`：保留登录页模板、数据注入、API、数据库读写和静态资源服务。

以后改登录后的界面，优先改 `public/style.css`、`public/shared.js`、`public/admin.js`、`public/student.js`，不要再把样式/脚本塞回服务器模板。

如果需要从主模板重新抽取资源：

```bash
node scripts/extract_app_assets.mjs
```

第三阶段已经把后端 API 拆出 5 个模块：

- `server/students.mjs`：添加学生。
- `server/progress.mjs`：进度查询、手动记录、批量记录、周报、回滚。
- `server/assignments.mjs`：作业读取、布置、归档、完成提醒、老师确认。
- `server/questions.mjs`：题目复核、检测提交、自动批改。
- `server/loginLogs.mjs`：登录日志记录和查询。

第四阶段已经把 JSON 数据库文件读写抽到：

- `server/db.mjs`：JSON 文件创建、读取、临时文件写入、原子重命名。

第五阶段已经把认证逻辑抽到：

- `server/auth.mjs`：密码哈希、密码验证、session cookie、当前用户读取、登录、退出、修改密码。

第六阶段已经把静态资源服务抽到：

- `server/staticAssets.mjs`：`/public/*.css/js` 和 `/assets/*.png` 白名单资源服务。

第七阶段已经把路线与解锁工具抽到：

- `server/routes.mjs`：路线节点查找、路线类型判断、作业节点解析、前置依赖、学生解锁判断、小学解锁策略。

第八阶段已经把页面模板抽到：

- `server/uiPage.mjs`：登录页 HTML、主系统 HTML、页面启动数据注入。

第九阶段已经把报告生成抽到：

- `server/reports.mjs`：每周报告、本周已学、下周建议、回补建议汇总。

第十阶段已经把作业展示状态抽到：

- `server/assignmentsView.mjs`：作业公开字段、完成/待完成节点、自动完成状态计算、老师待确认提醒汇总。

第十一阶段已经把题目复核视图抽到：

- `server/questionReview.mjs`：题目复核 key、复核覆盖、学生/老师可见题过滤、复核数量汇总。

第十二阶段已经把路线数据加载和题库生成抽到：

- `server/routeDataLoader.mjs`：路线数据加载装配器。
- `server/learningPages.mjs`：学习页路径发现和标题。
- `server/questionBank.mjs`：小学书面测试题、practice markdown 题解析、题目质量字段。
- `server/primaryRouteLoader.mjs`：小学路线 HTML 读取与题库覆盖。
- `server/middleRouteLoader.mjs`：中学 DAG、checklist、题库读取。

第十三阶段已经把应用数据状态抽到：

- `server/appState.mjs`：默认数据库、数据库形状补齐、公开用户视图、学生访问权限、审计日志追加。

`math_multiuser_server.mjs` 仍然负责 HTTP 路由调度，以及少量跨模块组合函数。短期维护重点是继续减薄主文件，保持每次拆分都有冒烟测试覆盖。

## 后续维护方向

当前版本采用 JSON 文件作为轻量数据存储，适合小规模教学部署和人工检查。后续如果学生数量、并发使用或统计查询需求继续增加，可以按下面顺序演进：

1. 在 `server/repositories/*.mjs` 增加数据访问层，比如 `studentsRepo`、`progressRepo`、`assignmentsRepo`。
2. 为 SQLite 增加 schema 和迁移脚本。
3. 做一次 JSON 到 SQLite 的只读迁移演练。
4. 冒烟测试通过后再切换正式读写。
5. 保留 JSON 备份和回滚脚本，直到连续使用稳定。

继续拆分模块或升级存储前，应保留当前冒烟测试，确保每一步维护都能验证核心教学流程没有退化。
