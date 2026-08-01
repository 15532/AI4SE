# 脚本

## `start-local.ps1`

Windows PowerShell 本地启动脚本，用于简化课程演示和本地开发。

```powershell
.\scripts\start-local.ps1
.\scripts\start-local.ps1 -Port 3100
.\scripts\start-local.ps1 -SkipBuild
```

脚本会在缺少 `node_modules` 时自动执行 `npm ci`，创建 `data/` 目录，设置默认 harness 环境变量，并启动 `dist/src/web/server.js`。
