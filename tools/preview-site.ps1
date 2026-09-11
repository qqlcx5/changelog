<#
.SYNOPSIS
    在本地预览基于 VitePress & Teek 主题的知识库站点
#>
param (
    [switch]$Install
)

$ErrorActionPreference = "Stop"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     VitePress + Teek 本地预览启动器    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$tempDir = Join-Path $env:TEMP "teek-preview"
$docsDir = Join-Path $tempDir "docs"

# 1. 初始化临时运行环境
if (-not (Test-Path "$tempDir\node_modules") -or $Install) {
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    Copy-Item "$repoRoot\package.json" "$tempDir\package.json"
    Push-Location $tempDir
    Write-Host "正在安装 VitePress 与 Teek 主题依赖..." -ForegroundColor Yellow
    npm install
    Pop-Location
}

# 2. 同步内容与配置
if (Test-Path $docsDir) { Remove-Item -Recurse -Force $docsDir }
New-Item -ItemType Directory -Path $docsDir | Out-Null

Copy-Item -Recurse "$repoRoot\.vitepress" "$docsDir\.vitepress"
Copy-Item "$repoRoot\README.md" "$docsDir\README.md"
Copy-Item "$repoRoot\WORKFLOW.md" "$docsDir\WORKFLOW.md"
Copy-Item -Recurse "$repoRoot\prompts" "$docsDir\prompts"
Copy-Item -Recurse "$repoRoot\playbooks" "$docsDir\playbooks"
Copy-Item -Recurse "$repoRoot\learnings" "$docsDir\learnings"

# 首页 index.md
if (Test-Path "$repoRoot\INDEX.md") {
    $c = Get-Content "$repoRoot\INDEX.md" -Raw
    Set-Content "$docsDir\index.md" -Value ("---`nlayout: doc`ntitle: 个人知识库总索引`n---`n`n" + $c) -Encoding utf8
}

Write-Host "启动本地热重载开发服务 (http://localhost:5173)..." -ForegroundColor Green
Push-Location $tempDir
try {
    npx vitepress dev docs
} finally {
    Pop-Location
}
