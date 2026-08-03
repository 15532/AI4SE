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

公网或服务器验证必须设置 WebUI 认证和凭据主密码：

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
$env:WEBUI_ADMIN_PASSWORD = "服务器 WebUI 管理口令"
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
- `npm.cmd run check:acceptance -- -AllowDirty`：通过，覆盖 build、全量测试、机制 demo、代码开发 demo、git 状态检查和常见密钥扫描。

## 最终交付前待补证据

- 在有 Docker 的机器上运行 `docker build -t ai4se-coding-agent-harness:local .` 并记录通过结果。
- 如果需要容器分发，推送到 registry 后补充真实 `docker pull` 命令。
- 公网部署时记录 WebUI URL、认证方式和 HTTPS/反向代理配置。
