param(
  [int]$Port = 3000,
  [string]$ConfigPath = "config/harness.example.yaml",
  [string]$DbPath = "data/harness.sqlite",
  [string]$CredentialStorePath = "data/credentials.enc.json",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $projectRoot

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "node_modules 不存在，正在执行 npm ci..."
  npm ci
}

if (-not (Test-Path -LiteralPath "data")) {
  New-Item -ItemType Directory -Path "data" | Out-Null
}

if (-not $SkipBuild) {
  Write-Host "正在构建 TypeScript..."
  npm run build
}

$env:HARNESS_CONFIG_PATH = $ConfigPath
$env:HARNESS_DB_PATH = $DbPath
$env:HARNESS_CREDENTIAL_STORE_PATH = $CredentialStorePath
$env:PORT = [string]$Port

Write-Host "WebUI 即将启动：http://127.0.0.1:$Port"
Write-Host "配置文件：$ConfigPath"
Write-Host "SQLite：$DbPath"
Write-Host "凭据存储：$CredentialStorePath"

node dist/src/web/server.js
