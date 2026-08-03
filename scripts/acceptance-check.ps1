param(
  [switch]$SkipDemos,
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Command
}

Invoke-Step "Build TypeScript" {
  npm.cmd run build
}

Invoke-Step "Run all tests" {
  npm.cmd test
}

if (-not $SkipDemos) {
  Invoke-Step "Run mechanism demo" {
    npm.cmd run demo:mechanisms
  }

  Invoke-Step "Run coding task demo" {
    npm.cmd run demo:coding-task
  }
}

Invoke-Step "Check git workspace status" {
  $status = git status --short
  if ($status) {
    Write-Host $status
    if (-not $AllowDirty) {
      throw "Working tree has uncommitted changes. Use -AllowDirty when this is expected."
    }
  }
}

Invoke-Step "Scan common secret patterns" {
  $patterns = @(
    "DEEPSEEK_API_KEY=",
    "sk-"
  )
  $files = git ls-files --cached --others --exclude-standard | ForEach-Object { Get-Item -LiteralPath $_ }

  foreach ($pattern in $patterns) {
    if ($pattern -eq "sk-") {
      $matches = $files | Select-String -Pattern "\bsk-[A-Za-z0-9_-]{20,}\b"
    } else {
      $matches = $files | Select-String -Pattern $pattern -SimpleMatch
    }
    $hits = $matches |
      Where-Object {
        $_.Path -notlike "*.example" -and
        $_.Path -notlike "*ACCEPTANCE_CHECKLIST.md" -and
        $_.Path -notlike "*acceptance-check.ps1" -and
        $_.Path -notlike "*acceptance.test.ts" -and
        $_.Line -notmatch "never_commit|example|placeholder|DeepSeek Key|expect\\(script\\)|toContain"
      }
    if ($hits) {
      $hits | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
      throw "Potential secret pattern found: $pattern"
    }
  }
}

Write-Host ""
Write-Host "Acceptance check completed."
