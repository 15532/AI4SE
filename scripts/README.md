# 脚本

## `start-local.ps1`

Windows PowerShell 本地启动脚本，用于简化课程演示和本地开发。

```powershell
.\scripts\start-local.ps1
.\scripts\start-local.ps1 -Port 5173
.\scripts\start-local.ps1 -SkipBuild
```

脚本会在缺少 `node_modules` 时自动执行 `npm ci`，创建 `data/` 目录，设置默认 harness 环境变量，并启动 `dist/src/web/server.js`。本地默认绑定 `127.0.0.1:3100`，避开 Windows 常见的 `3000` 端口排除范围；如果需要服务器监听外部流量，可显式传入 `-HostName 0.0.0.0` 并配合反向代理与访问控制。
