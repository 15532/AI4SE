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

## 最终交付前待补证据

- Docker 服务器验证因当前服务器未安装 Docker，按用户决定暂缓到后续服务器部署阶段；若之后安装 Docker，可补跑 `docker build -t ai4se-coding-agent-harness:local .` 或 `docker compose up --build` 并记录结果。
- 如果需要容器分发，推送到 registry 后补充真实 `docker pull` 命令。
- 若正式长期开放公网 WebUI，建议补充 Basic Auth、VPN、SSO 或其他访问控制。
