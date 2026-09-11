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

# 2. 准备内容（调用 prepare.js 生成分类索引与超链接）
Write-Host "正在准备文档内容与索引..." -ForegroundColor Yellow
node "$repoRoot\.vitepress\prepare.js"
if (Test-Path $docsDir) { Remove-Item -Recurse -Force $docsDir }
Copy-Item -Recurse "$repoRoot\docs" $docsDir

Write-Host "启动本地热重载开发服务 (http://localhost:5173)..." -ForegroundColor Green
Push-Location $tempDir
try {
    npx vitepress dev docs
} finally {
    Pop-Location
}
