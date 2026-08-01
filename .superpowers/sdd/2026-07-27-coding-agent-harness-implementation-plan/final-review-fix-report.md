# 最终 Review 修复报告

## 状态

`DONE_WITH_CONCERNS`

实现提交：`9aeb6ef948573850acae89e633b163af1ef9b2cf`

唯一 concern 是本机没有 Docker CLI，因此无法执行镜像构建或 Compose 启动验证；Dockerfile 与 Compose 的静态接线已经完成，其余要求均已通过自动化或编译后 smoke 验证。

## Important Findings 处理摘要

1. **feedback 驱动 correction**
   - guardrail block 保留为独立短 run。
   - test failure、`write_file` correction 与 finish 改为同一个顺序 agent loop。
   - demo provider 第二次调用会解析实际 context，只有看到 `test_failed` feedback 才返回 `write_file`。
   - demo 输出 `correctionContextObserved: true`，timeline 中 `feedback.test_failed` 位于 `action.write_file` 之前。

2. **CLI/WebUI 接入 SQLite EventStore/MemoryStore**
   - CLI `run` 与默认 WebUI 都读取 `HARNESS_DB_PATH`，默认值为 `data/harness.sqlite`。
   - 两个入口都把 EventStore 与 MemoryStore 注入 `runAgentLoop`；loop 返回实际持久化 run id。
   - WebUI 删除进程内 run Map，API 与 HTML 页面均从 SQLite 重建 run timeline 和状态。
   - Compose 设置 `HARNESS_DB_PATH=/app/data/harness.sqlite`，`harness-data` volume 现在实际保存 run、event 与 memory。

3. **共享 YAML config loader/registry**
   - 新增共享 `HarnessRegistry` 与 YAML loader，校验并加载多个 workspace、mock provider、mode、maxIterations。
   - CLI 与默认 WebUI 使用同一个 loader/registry；workspace root 相对配置文件目录解析。
   - Web 表单 provider id 也来自 registry，不再硬编码。
   - 请求体仍只读取 `workspaceId`、`provider`、`task`，不能覆盖预注册 workspace root。

4. **WebUI timeline 页面**
   - HTML form 提交返回 `303 Location: /runs/:id`。
   - `GET /runs/:id` 渲染 run 元数据和按序 timeline HTML。
   - JSON `POST /api/runs` 与 `GET /api/runs/:id` 保持原有 API 行为和响应字段。

5. **SQLite 写入前 secret redaction**
   - 新增 store 共享脱敏模块，覆盖 task、递归 event payload、memory key/value。
   - 覆盖 password、api_key/apiKey、credential、token、secret、private key、`sk-...`，并补充 JSON 形态 assignment。
   - EventStore 新增脱敏后的 run lookup；HTML task 与 API timeline 都从已脱敏 SQLite 数据读取。

6. **Minor：CLI shebang**
   - `src/cli/main.ts` 已增加 `#!/usr/bin/env node`。
   - 构建后 `dist/src/cli/main.js` 首行检查通过。

## TDD 红灯证据

- Store 首轮：13 个定向测试中 6 个失败，分别命中缺少 `getRun`、task 未脱敏、password/api_key/credential memory 泄露和 memory key assignment 泄露。
- Config：loader 类型壳加载后 2 个测试按预期失败，命中未实现 YAML 加载与重复 workspace 检查。
- CLI：7 个定向测试中 2 个失败，命中硬编码 workspace 与缺少 shebang。
- WebUI：9 个定向测试中 3 个失败，命中未加载 YAML、form 仍返回 201、SQLite 中没有 run/memory。
- Demo：7 个定向测试中 1 个失败，`correctionContextObserved` 为 `undefined`。
- 最终自审补强：JSON task secret 与 YAML provider 表单接线各有 1 个失败测试，随后修复。

## 绿灯与最终验证

- `npm test`：退出码 0，12 个测试文件、89 个测试全部通过。
- `npm run build`：退出码 0。
- `npm run typecheck`：退出码 0。
- `node dist/src/cli/main.js demo`：退出码 0；输出包含 `feedback.test_failed`、其后的 `action.write_file`，以及 `correctionContextObserved: true`。
- `node -e "import('./dist/src/web/server.js').then(() => console.log('built-web-import-ok'))"`：退出码 0，输出 `built-web-import-ok`。
- `dist/src/cli/main.js` 首行：`#!/usr/bin/env node`。
- `git diff --check`：退出码 0；仅报告 Windows 工作区的 LF/CRLF 转换提示，无 whitespace error。
- `docker --version`：失败，PowerShell 报告无法识别 `docker` 命令；未执行 Docker build/Compose runtime 验证。

## 遗留 Concern

- 仅有 Docker CLI 缺失导致的容器运行验证缺口。未实现真实 OpenAI provider、真实 OS keychain 或生产认证，符合本轮明确约束；WebUI v1 无 password 的风险说明继续保留在中文文档中。
