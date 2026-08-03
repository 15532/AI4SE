# 安全策略

## 凭据规则

- 真实 API key、provider token 或其他密钥不得提交到仓库。
- 不得在终端输出、日志、SQLite、运行历史、CI 日志或 WebUI response 中打印或返回真实 key。
- `.env` 只能保存非密钥配置和本地开发 fallback，且应理解明文存储风险。
- 当前 `CredentialManager` v2 默认使用加密凭据文件：`HARNESS_CREDENTIAL_STORE_PATH` 指向密文 JSON，`HARNESS_MASTER_PASSWORD` 用于派生 AES-256-GCM 密钥。主密码不得提交到仓库。
- DeepSeek provider 优先从加密凭据文件读取真实 key，其次才从 `DEEPSEEK_API_KEY` 读取受控环境变量 fallback。真实值只能来自加密凭据文件、未提交的 `.env`、系统环境变量或部署平台 secret；`.env.example` 只能保留变量名和空值。
- SQLite 写入边界会对 task、event payload、memory key/value 中的常见 password、api_key、credential、token、secret 和 `sk-...` 形态做脱敏。该防线不能替代凭据管理，任务与 memory 输入仍不得包含真实 secret。

## WebUI 边界

WebUI real-run 只能选择共享 YAML registry 中预注册的 workspace id，不能提交任意服务器路径或覆盖 root。每个 workspace 的文件操作均受 path boundary 限制；shell 操作必须命中 command allowlist，全部 action 仍经过 guardrail。WebUI 也不得展示或返回 API key 明文。缺少 DeepSeek key 时，WebUI 返回结构化错误，不回显环境变量名或 secret。普通 WebUI 入口默认使用 DeepSeek，并隐藏 mock；mock 仅保留给离线测试、机制演示和 CLI/API 调试。

## v1 无密码风险与部署建议

WebUI v1 没有 password。它仅适合受信任网络或短期课程演示，不应作为直接暴露公网的长期服务。长期公网部署必须放在 Nginx 或其他反向代理、认证与网络边界之后，例如 basic auth、SSO、VPN 或等效访问控制。不要将 `3000` 端口直接暴露给公网。

服务器部署时，`HARNESS_MASTER_PASSWORD` 应来自反向代理、进程管理器、Docker Compose 变量替换、平台 secret 或系统环境变量。真实 DeepSeek key 推荐写入持久化数据卷中的加密凭据文件，`DEEPSEEK_API_KEY` 只作为短期 fallback。不要把真实 key 或主密码写入镜像、compose 文件、示例 env 文件或仓库配置。`HARNESS_DB_PATH` 和 `HARNESS_CREDENTIAL_STORE_PATH` 所在目录应挂载为持久化目录，并限制文件权限。

## 提交前检查清单

- 检查 `git status --short`，确认没有 `.env`、密钥文件或真实 SQLite 数据。
- 搜索新增文本与日志，确认没有 API key、token、密码或其他凭据。
- 确认 CI 输出不包含 provider token。
- 确认 demo 和测试仅使用 mock 值。
- 确认 WebUI 只暴露预注册 workspace，且反向代理已配置适当认证后再进行公网部署。
