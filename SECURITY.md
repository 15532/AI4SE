# 安全策略

## 凭据规则

- 真实 API key、provider token 或其他密钥不得提交到仓库。
- 不得在终端输出、日志、SQLite、运行历史、CI 日志或 WebUI response 中打印或返回真实 key。
- `.env` 只能作为显式启用的本地开发 fallback，且应理解明文存储风险。
- 当前 `CredentialManager` v1 使用测试用内存 adapter；环境变量 fallback 仅在显式开启时可用。真实 OS keychain 不属于当前 v1 实现。
- SQLite 写入边界会对 task、event payload、memory key/value 中的常见 password、api_key、credential、token、secret 和 `sk-...` 形态做脱敏。该防线不能替代凭据管理，任务与 memory 输入仍不得包含真实 secret。

## WebUI 边界

WebUI real-run 只能选择共享 YAML registry 中预注册的 workspace id，不能提交任意服务器路径或覆盖 root。每个 workspace 的文件操作均受 path boundary 限制；shell 操作必须命中 command allowlist，全部 action 仍经过 guardrail。WebUI 也不得展示或返回 API key 明文。

## v1 无密码风险与部署建议

WebUI v1 没有 password。它仅适合受信任网络或短期课程演示，不应作为直接暴露公网的长期服务。长期公网部署必须放在 Nginx 或其他反向代理、认证与网络边界之后，例如 basic auth、SSO、VPN 或等效访问控制。不要将 `3000` 端口直接暴露给公网。

## 提交前检查清单

- 检查 `git status --short`，确认没有 `.env`、密钥文件或真实 SQLite 数据。
- 搜索新增文本与日志，确认没有 API key、token、密码或其他凭据。
- 确认 CI 输出不包含 provider token。
- 确认 demo 和测试仅使用 mock 值。
- 确认 WebUI 只暴露预注册 workspace，且反向代理已配置适当认证后再进行公网部署。
