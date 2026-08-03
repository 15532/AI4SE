param(
  [int]$Port = 3100,
  [string]$HostName = "127.0.0.1",
  [string]$ConfigPath = "config/harness.example.yaml",
  [string]$DbPath = "data/harness.sqlite",
  [string]$CredentialStorePath = "data/credentials.enc.json",
  [string]$WebUiAdminUser = "admin",
  [string]$WebUiAdminPassword = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $projectRoot

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "node_modules is missing; running npm ci..."
  npm ci
}

if (-not (Test-Path -LiteralPath "data")) {
  New-Item -ItemType Directory -Path "data" | Out-Null
}

if (-not $SkipBuild) {
  Write-Host "Building TypeScript..."
  npm run build
}

$env:HARNESS_CONFIG_PATH = $ConfigPath
$env:HARNESS_DB_PATH = $DbPath
$env:HARNESS_CREDENTIAL_STORE_PATH = $CredentialStorePath
$env:WEBUI_ADMIN_USER = $WebUiAdminUser
$env:WEBUI_ADMIN_PASSWORD = $WebUiAdminPassword
$env:PORT = [string]$Port
$env:HOST = $HostName

Write-Host "WebUI URL: http://${HostName}:$Port"
Write-Host "Config file: $ConfigPath"
Write-Host "SQLite DB: $DbPath"
Write-Host "Credential store: $CredentialStorePath"
if ($WebUiAdminPassword -eq "") {
  Write-Host "WebUI auth: disabled for local development"
} else {
  Write-Host "WebUI auth: Basic Auth enabled for user $WebUiAdminUser"
}

node dist/src/web/server.js
