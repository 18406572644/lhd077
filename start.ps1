# 一键启动脚本 (PowerShell)
# 前端端口: 2077, 后端端口: 6077

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  正在启动前后端服务..." -ForegroundColor Cyan
Write-Host "  前端端口: 2077" -ForegroundColor Green
Write-Host "  后端端口: 6077" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

if (-not (Test-Path "node_modules")) {
    Write-Host "[1/3] 检测到 node_modules 不存在，正在安装依赖..." -ForegroundColor Yellow
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm install
    } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
    } else {
        Write-Host "错误: 未找到 pnpm 或 npm，请先安装 Node.js 和包管理器" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/3] 依赖已安装，跳过..." -ForegroundColor Green
}

Write-Host "[2/3] 启动后端服务 (端口 6077)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($workDir)
    Set-Location $workDir
    $env:PORT = "6077"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm run server:dev
    } else {
        npm run server:dev
    }
} -ArgumentList $scriptPath

Write-Host "[3/3] 启动前端服务 (端口 2077)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($workDir)
    Set-Location $workDir
    $env:PORT = "2077"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm run client:dev
    } else {
        npm run client:dev
    }
} -ArgumentList $scriptPath

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  服务启动中，请稍候..." -ForegroundColor Cyan
Write-Host "  前端地址: http://localhost:2077" -ForegroundColor Green
Write-Host "  后端地址: http://localhost:6077" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Yellow
Write-Host ""

try {
    $started = $false
    $timeout = 60
    $elapsed = 0

    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2

        $backendOutput = Receive-Job -Job $backendJob
        $frontendOutput = Receive-Job -Job $frontendJob

        if ($backendOutput) {
            Write-Host "[后端] $backendOutput" -ForegroundColor Magenta
        }
        if ($frontendOutput) {
            Write-Host "[前端] $frontendOutput" -ForegroundColor Blue
        }

        if (-not $started) {
            try {
                $backendResponse = Invoke-WebRequest -Uri "http://localhost:6077" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
                $frontendResponse = Invoke-WebRequest -Uri "http://localhost:2077" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue

                if ($backendResponse -and $frontendResponse) {
                    Write-Host ""
                    Write-Host "========================================" -ForegroundColor Green
                    Write-Host "  所有服务已成功启动!" -ForegroundColor Green
                    Write-Host "  前端: http://localhost:2077" -ForegroundColor Green
                    Write-Host "  后端: http://localhost:6077" -ForegroundColor Green
                    Write-Host "========================================" -ForegroundColor Green
                    Write-Host ""
                    $started = $true
                }
            } catch {
            }
        }

        if ($backendJob.State -eq "Failed") {
            Write-Host "后端服务启动失败!" -ForegroundColor Red
            Receive-Job -Job $backendJob
            break
        }
        if ($frontendJob.State -eq "Failed") {
            Write-Host "前端服务启动失败!" -ForegroundColor Red
            Receive-Job -Job $frontendJob
            break
        }
    }

    while ($true) {
        Start-Sleep -Seconds 2
        $backendOutput = Receive-Job -Job $backendJob
        $frontendOutput = Receive-Job -Job $frontendJob

        if ($backendOutput) {
            Write-Host "[后端] $backendOutput" -ForegroundColor Magenta
        }
        if ($frontendOutput) {
            Write-Host "[前端] $frontendOutput" -ForegroundColor Blue
        }
    }
} finally {
    Write-Host ""
    Write-Host "正在停止服务..." -ForegroundColor Yellow

    if ($backendJob) {
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    }

    Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$scriptPath*" } | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "所有服务已停止" -ForegroundColor Green
}
