<#
.SYNOPSIS
    在本地临时环境预览 Quartz 知识库站点（零污染主仓库）
.DESCRIPTION
    将 Quartz 引擎拉取到系统临时目录，挂载并同步当前内容后启动预览服务
#>
param (
    [switch]$UpdateEngine
)

$ErrorActionPreference = "Stop"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       Quartz 本地预览启动器            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$tempDir = Join-Path $env:TEMP "quartz-preview-changelog"
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path

# 1. 检查或准备 Quartz 运行环境
if (-not (Test-Path $tempDir) -or $UpdateEngine) {
    if (Test-Path $tempDir) {
        Write-Host "清理旧环境..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $tempDir
    }
    Write-Host "首次运行：正在拉取 Quartz 官方引擎到临时目录..." -ForegroundColor Yellow
    Write-Host "路径: $tempDir" -ForegroundColor DarkGray
    git clone --depth 1 https://github.com/jackyzha0/quartz.git $tempDir
    Push-Location $tempDir
    Write-Host "正在安装依赖..." -ForegroundColor Yellow
    npm ci
    Pop-Location
}

# 2. 准备内容目录 content
$contentDir = Join-Path $tempDir "content"
if (Test-Path $contentDir) {
    Remove-Item -Recurse -Force $contentDir
}
New-Item -ItemType Directory -Path $contentDir | Out-Null

Write-Host "正在同步知识库内容..." -ForegroundColor Cyan
# 首页映射
if (Test-Path "$repoRoot\INDEX.md") {
    Copy-Item "$repoRoot\INDEX.md" "$contentDir\index.md"
} elseif (Test-Path "$repoRoot\README.md") {
    Copy-Item "$repoRoot\README.md" "$contentDir\index.md"
}

if (Test-Path "$repoRoot\README.md") { Copy-Item "$repoRoot\README.md" "$contentDir\README.md" }
if (Test-Path "$repoRoot\WORKFLOW.md") { Copy-Item "$repoRoot\WORKFLOW.md" "$contentDir\WORKFLOW.md" }

if (Test-Path "$repoRoot\prompts") { Copy-Item -Recurse "$repoRoot\prompts" "$contentDir\prompts" }
if (Test-Path "$repoRoot\playbooks") { Copy-Item -Recurse "$repoRoot\playbooks" "$contentDir\playbooks" }
if (Test-Path "$repoRoot\learnings") { Copy-Item -Recurse "$repoRoot\learnings" "$contentDir\learnings" }

# 3. 覆盖自定义配置
if (Test-Path "$repoRoot\.github\quartz\quartz.config.ts") {
    Copy-Item "$repoRoot\.github\quartz\quartz.config.ts" "$tempDir\quartz.config.ts" -Force
}
if (Test-Path "$repoRoot\.github\quartz\quartz.layout.ts") {
    Copy-Item "$repoRoot\.github\quartz\quartz.layout.ts" "$tempDir\quartz.layout.ts" -Force
}

# 4. 启动服务
Write-Host "正在启动本地服务..." -ForegroundColor Green
Write-Host "预览地址: http://localhost:8080" -ForegroundColor Green
Push-Location $tempDir
try {
    npx quartz build --serve
} finally {
    Pop-Location
}
