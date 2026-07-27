# 安全策略

## 凭据规则

- 不得提交真实 API key 或 provider token。
- 不得在日志、终端输出、WebUI response、CI logs 或 SQLite records 中打印 key value。
- 生产凭据应存入操作系统钥匙串。
- `.env` 只能作为显式启用的本地开发 fallback，并必须说明其明文风险。

## WebUI 边界

WebUI v1 可以触发真实 harness run，但必须受以下边界约束：

- 只能选择预注册 workspace id
- 不能输入任意服务器路径
- 所有 file action 必须留在 workspace root 内
- 所有 shell action 必须匹配 workspace allowlist
- 所有 action 必须经过 guardrail
- 不得展示或返回 API key 明文

根据用户决定，v1 暂不配置 WebUI password。因此公网部署应仅用于受信任网络或短期课程演示。长期公网部署前应加入应用口令或反向代理认证。

## 提交前检查

- `git status --short` 中没有 `.env` 或 secret files。
- 发布前搜索意外 key material。
- CI logs 不包含 provider tokens。
- Demo data 只包含 mock values。

