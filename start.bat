@echo off
chcp 65001 >nul
title 一键启动前后端服务

echo ========================================
echo   正在启动前后端服务...
echo   前端端口: 2077
echo   后端端口: 6077
echo ========================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [1/3] 检测到 node_modules 不存在，正在安装依赖...
    where pnpm >nul 2>nul
    if %errorlevel%==0 (
        pnpm install
    ) else (
        where npm >nul 2>nul
        if %errorlevel%==0 (
            npm install
        ) else (
            echo 错误: 未找到 pnpm 或 npm，请先安装 Node.js 和包管理器
            pause
            exit /b 1
        )
    )
) else (
    echo [1/3] 依赖已安装，跳过...
)

echo [2/3] 启动后端服务 (端口 6077)...
start "后端服务 - 端口 6077" cmd /k "cd /d ""%~dp0"" && set PORT=6077 && (where pnpm >nul 2>nul && pnpm run server:dev || npm run server:dev)"

timeout /t 2 /nobreak >nul

echo [3/3] 启动前端服务 (端口 2077)...
start "前端服务 - 端口 2077" cmd /k "cd /d ""%~dp0"" && set PORT=2077 && (where pnpm >nul 2>nul && pnpm run client:dev || npm run client:dev)"

echo.
echo ========================================
echo   服务启动中!
echo   前端地址: http://localhost:2077
echo   后端地址: http://localhost:6077
echo ========================================
echo.
echo 提示: 前后端服务已在独立窗口启动
echo       关闭此脚本不会影响正在运行的服务
echo       如需停止服务，请关闭对应的窗口
echo.
timeout /t 5 /nobreak >nul
start "" "http://localhost:2077"
