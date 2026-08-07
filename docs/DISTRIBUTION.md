# 分发与部署闭环

本文记录 Project A 的 Docker 分发方式、服务器运行命令和当前验证状态。

## 本地镜像构建

```powershell
docker build -t ai4se-coding-agent-harness:local .
```

预期结果：

- TypeScript 在镜像 build stage 内完成构建。
- 最终镜像启动命令为 `node dist/src/web/server.js`。
- `.dockerignore` 排除 `node_modules/`、`dist/`、`data/`、`logs/`、`.env`、SQLite、日志和加密凭据文件。

## 本地容器运行

仅本地验证可使用：

```powershell
docker run --rm -p 3000:3000 ai4se-coding-agent-harness:local
```

正式公网或服务器验证建议设置 WebUI 认证和凭据主密码；本次课程演示部署按用户选择暂不启用登录界面：

```powershell
docker run --rm -p 3000:3000 `
  -e WEBUI_ADMIN_USER=admin `
  -e WEBUI_ADMIN_PASSWORD="服务器 WebUI 管理口令" `
  -e HARNESS_MASTER_PASSWORD="服务器凭据主密码" `
  -v ai4se-harness-data:/app/data `
  ai4se-coding-agent-harness:local
```

## Compose 运行

```powershell
$env:HARNESS_MASTER_PASSWORD = "服务器凭据主密码"
docker compose up --build
```

Compose 会挂载 `harness-data` named volume 到 `/app/data`，用于保留 SQLite timeline、memory、session 和加密凭据文件。

## Registry 分发

如果课程或部署环境要求从公开 registry 获取镜像，可使用以下命令。`<registry>/<namespace>` 需要替换为真实仓库地址，例如 Docker Hub、GitHub Container Registry 或课程指定 registry。

```powershell
docker tag ai4se-coding-agent-harness:local <registry>/<namespace>/ai4se-coding-agent-harness:latest
docker push <registry>/<namespace>/ai4se-coding-agent-harness:latest
docker pull <registry>/<namespace>/ai4se-coding-agent-harness:latest
```

README 中不写死 registry，是为了避免伪造不可访问的镜像地址。最终提交前如果已经推送镜像，应在本文件补充真实 `docker pull` 命令和 registry 页面链接。

## 当前验证记录

- `npm.cmd test -- tests/scripts/acceptance.test.ts -t "Docker build context"`：通过，确认 `.dockerignore` 已覆盖本地依赖、构建产物、数据、日志、`.env` 和加密凭据。
- `docker build -t ai4se-coding-agent-harness:local .`：当前机器未安装 Docker CLI，PowerShell 返回 `docker` 命令不存在；需要在安装 Docker Desktop 或服务器 Docker 环境后补跑。
- GitHub Actions `unit-test` 已通过，workflow 中包含 `docker build -t coding-agent-harness .`：`https://github.com/15532/AI4SE/actions/runs/30803331722`。
- `npm.cmd run check:acceptance -- -AllowDirty`：通过，覆盖 build、全量测试、机制 demo、代码开发 demo、git 状态检查和常见密钥扫描。

## 服务器 systemd + Nginx 部署记录

部署时间：2026-08-04。

目标服务器：

- IP：`39.106.134.6`
- 系统：Debian GNU/Linux 12 (bookworm)
- 部署方式：systemd + Node.js + Nginx，不使用 Docker
- WebUI URL：`https://20230722.top/ai4se/`
- Node 监听：`127.0.0.1:3100`
- systemd 服务：`ai4se-harness.service`
- 应用目录：`/opt/ai4se/current`
- 持久配置：`/opt/ai4se/config/harness.server.yaml`
- 持久数据：`/opt/ai4se/data/harness.sqlite`
- 演示工作区：`/opt/ai4se/workspaces/deepseek-sandbox`

服务器验证：

- 已安装 Debian 包管理器提供的 Node.js/npm：Node `v18.20.4`，npm `9.2.0`。
- `/opt/ai4se/current` 内执行 `npm ci` 与 `npm run build` 通过。
- `deepseek-sandbox` 工作区执行 `npm test` 与 `npm run build` 通过。
- `systemctl is-active ai4se-harness.service` 返回 `active`。
- 本地 Node API：`http://127.0.0.1:3100/ai4se/api/workspaces` 返回 `deepseek-sandbox`。
- 公网 API：`https://20230722.top/ai4se/api/workspaces` 返回 `deepseek-sandbox`。
- 既有站点：`https://20230722.top/smart-kitchen/` 返回 `200`，未被新路由覆盖。

访问控制取舍：

- 本次课程演示部署按用户选择暂不启用 WebUI 登录界面，即未设置 `WEBUI_ADMIN_PASSWORD`。
- Nginx 只把 `/ai4se/` 反向代理到本机 `127.0.0.1:3100`，没有直接暴露 Node 端口。
- DeepSeek API key 不写入仓库、不写入本文档、不写入对话记录中的命令；需要在服务器 `/opt/ai4se/.env` 中由用户本地手动配置，并建议先轮换已经误发到对话中的旧 key。
- `npm audit` 在服务器依赖安装后提示 5 个依赖漏洞，后续可单独评估升级；当前构建和运行验证通过。

## 2026-08-06 服务器版本更新记录

更新内容：将 WebUI「mock 机制演示」接入确定性机制复现（`2d72daf`、`6a29bd3`、`cbc09a4` 后的代码），并同步到服务器。

- 新 release 目录：`/opt/ai4se/releases/20260806211130`
- 更新方式：本地 `npm run build` 通过后，打包源码上传（排除 node_modules/.git/dist/data），复制上一 release 的 node_modules，服务器 `npm run build` 通过，切换 `/opt/ai4se/current` 符号链接，重启 `ai4se-harness.service`。
- 服务状态：`systemctl is-active ai4se-harness.service` 返回 `active`，日志显示 `WebUI is listening on http://127.0.0.1:3100`。
- 公网回归：`https://20230722.top/ai4se/api/workspaces` 返回 `deepseek-sandbox`，首页包含 `mock-demo-form` 与「mock 机制演示」入口。
- 公网端到端验证：通过 `/ai4se/api/runs/start` 提交 `provider=mock` + 「mock 机制演示」任务，run 状态 `finished`，timeline 含 19 个事件：`guardrail` decision=block（拦截 `rm -rf .`）、`feedback` source=test_failed、`tool_result` action=write_file（修正动作，出现在 test_failed 之后）、`stop` reason=finish，摘要为中文「机制演示完成：护栏拦截了危险命令 rm -rf .，npm test 失败产生 test_failed 反馈，模型据此改为 write_file 修正动作；三项机制均已确定性复现。」

## 2026-08-06 第二轮部署：修复机制演示前端轮询中断

背景：第一轮部署后，用户反馈线上机制演示页面只显示 9 个事件、停在「护栏」处。根因是旧版 `runMechanismDemo` 用两个独立 `runAgentLoop` 写入同一 run，phase 1 结束写入 `stop(guardrail_blocked)`，导致 phase 2 期间 `statusFromTimeline` 判定为 `blocked`；前端 live 轮询在非 `running` 状态停止并 reload，页面冻结在中间状态（后端 timeline 完整）。

修复：将 WebUI 机制演示改为单个 `runAgentLoop`（护栏拦截 → 测试失败反馈 → 修正动作 → finish），全程只有一个 `stop(finish)`，状态从 `running` 直接到 `finished`。

- 提交：`e7fd439 修复：机制演示改为单次循环避免前端轮询中断`
- 新 release 目录：`/opt/ai4se/releases/20260806212800`（构建通过，切换 `current` 并重启服务，`active`）
- 线上验证：新 run `326f34f7` 轮询过程 `running → finished`（18 个事件），页面包含护栏拦截、测试失败反馈、修正动作（write_file）与中文 finish 摘要。

## 2026-08-06 第三轮部署：WebUI 清除历史对话与工作区

新功能：WebUI 左侧工具区新增「清除历史对话与工作区」按钮。后端新增 `EventStore.clearHistory()` 与 `POST /api/cleanup`（清空 sessions/runs/events/approvals/actions/feedback/memory_items/快照，并逐个重置已注册工作区到 `workspaces/<id>` 模板）；`src/runtime/workspace-reset.ts` 保证模板缺失时不动工作区、root 即模板时为 no-op。

- 提交：`1a5c07a 功能：WebUI 增加清除历史对话与工作区按钮`
- 新 release 目录：`/opt/ai4se/releases/20260806214200`（构建通过，切换 `current` 并重启服务，`active`）
- 线上端到端验证：清理前 6 sessions/6 runs/97 events、工作区 4 个文件；POST `/ai4se/api/cleanup` 后 0 sessions/0 runs/0 events，工作区恢复为模板 5 个文件（含 `src/bubble_sort.js`）；首页侧栏显示「暂无对话」。

## 2026-08-07 第四轮部署：详细摘要与文件变更修复

背景：用户反馈 DeepSeek 摘要过于简短、模型声称「node --check / npm test 通过」但 timeline 无对应 run_command（模型幻觉），以及工作区不是 git 仓库导致 WebUI「文件变更」恒为 0。

- 提交：`522dde0 优化：DeepSeek 摘要更详细并禁止编造验证，文件变更合并本次写入`
- 修复内容：
  - `src/core/providers.ts`：system prompt 要求 finish.summary 为 4-8 句详细中文（列出修改文件、逐文件关键改动、真实执行的验证命令及结果、跳过项），并禁止编造未执行的验证。
  - `src/web/server.ts`：`changesForRun` 将 run timeline 中 `write_file` 实际写入的文件合并进 run 文件变更列表，非 git 工作区也能展示。
- 新 release 目录：`/opt/ai4se/releases/20260807112200`（构建通过，切换 `current`、重启服务后 `active`）。
- 线上验证：用户 run `4532279e` 页面现在显示「文件变更 (1)」与 `src/index.js` 变更卡片，摘要含 bubbleSort 详情。

## 2026-08-07 第五轮部署：agent loop 历史去重

背景：用户询问为何存在迭代上限、为何简单任务仍迭代很多次。根因是 loop 只拦截「连续重复」动作，模型穿插其他动作后再写相同文件/读相同文件不会触发拦截，每个重复动作都消耗一次迭代。

- 提交：`0ae030c 优化：agent loop 历史去重避免重复动作消耗迭代`
- 修复内容：
  - `src/core/loop.ts`：write_file（同路径同内容）与 list_files（同路径）历史重复直接跳过并给 `duplicate_action` 反馈；read_file 在路径未被后续 write 修改时拦截重复读；写后重读允许。
  - `src/core/context.ts`：Operating rules 增加防重复与「简单任务尽快 finish」约束。
- 新 release 目录：`/opt/ai4se/releases/20260807113230`（构建通过，切换 `current`、重启服务后 `active`）。
- 本地验证：`npm run typecheck`、`npm run build`、`npm test`（200 个测试）全部通过。

## 2026-08-07 第六轮部署：聊天顺序与验证命令修复

背景：用户反馈 ① 会话中新的用户要求显示在旧要求上方；② 模型声称「没有可用验证命令」但工作区 package.json 明明有 npm test/npm run build；③ 简单任务迭代仍偏长。

- 提交：`bf669ea 修复：聊天线程按时间正序渲染，强化验证命令执行`
- 修复内容：
  - `src/web/views.ts`：`renderChatSessionThread` 按时间正序渲染（旧在上、新在下）。
  - `src/core/context.ts` + `src/core/providers.ts`：明确「验证任务直接运行 Allowed commands（npm test / npm run build），不要臆断脚本缺失；拿不准先 read package.json 再运行」。
- 新 release 目录：`/opt/ai4se/releases/20260807114430`（构建通过，切换 `current`、重启服务后 `active`）。
- 线上验证：session `b20e521e` 聊天线程内「请你写一个堆排序」位于「你可以进行验证吗?」上方（旧在上、新在下）。
- 本地验证：`npm run typecheck`、`npm run build`、`npm test`（201 个测试）全部通过。

## 2026-08-07 第七轮部署：有效迭代预算与重复空转分离

背景：用户反馈 run `caaebd00` timeline 有 35 个事件，其中 12 个是重复空转（模型连续 6 次重复 `list_files .`，每次被历史去重拦截但仍消耗一次迭代预算）。

- 提交：`acd71e6 优化：重复空转不再消耗有效迭代预算`
- 修复内容：
  - `src/core/loop.ts`：把「有效迭代预算」与「总轮次上限」分离——被拦截的重复/无效/护栏拦截/解析失败轮次只计入总轮次（上限 `maxIterations * 3`），不再消耗有效预算；只有真正执行工具的动作才消耗有效预算。重复反馈给出明确下一步建议。
- 新 release 目录：`/opt/ai4se/releases/20260807115200`（构建通过，切换 `current`、重启服务后 `active`）。
- 本地验证：`npm run typecheck`、`npm run build`、`npm test`（202 个测试）全部通过；新增「重复动作不消耗有效预算」测试。

## 2026-08-07 第八轮部署：多 JSON 拼接与目录误判修复

背景：用户反馈 run `8f4b4141` timeline 有 65 个事件，模型声称「已运行 npm run build 成功」但 timeline 无 run_command（幻觉），并断言「没有测试文件」（实际有 test/sort.test.js）。

- 提交：`4902fdc 修复：检测多 JSON 拼接，目录读取失败引导 list_files`
- 修复内容：
  - `src/core/actions.ts`：检测「多个 JSON 对象拼接」并返回 `invalid_action` 明确反馈，不再静默丢弃后续动作。
  - `src/core/context.ts` + `src/core/providers.ts`：提示一次只返回一个 JSON；目录读取失败（EISDIR）时改用 list_files。
- 新 release 目录：`/opt/ai4se/releases/20260807115830`（构建通过，切换 `current`、重启服务后 `active`）。
- 本地验证：`npm run typecheck`、`npm run build`、`npm test`（204 个测试）全部通过；新增多 JSON 检测测试（actions + loop）。

## 最终交付前待补证据

- Docker 服务器验证因当前服务器未安装 Docker，按用户决定暂缓到后续服务器部署阶段；若之后安装 Docker，可补跑 `docker build -t ai4se-coding-agent-harness:local .` 或 `docker compose up --build` 并记录结果。
- 如果需要容器分发，推送到 registry 后补充真实 `docker pull` 命令。
- 若正式长期开放公网 WebUI，建议补充 Basic Auth、VPN、SSO 或其他访问控制。
