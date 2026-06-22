#!/bin/bash
# 一键启动脚本 (Linux/Mac)
# 前端端口: 2077, 后端端口: 6077

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  正在启动前后端服务...${NC}"
echo -e "${GREEN}  前端端口: 2077${NC}"
echo -e "${GREEN}  后端端口: 6077${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi

    pkill -f "node.*server:dev" 2>/dev/null || true
    pkill -f "node.*client:dev" 2>/dev/null || true

    echo -e "${GREEN}所有服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[1/3] 检测到 node_modules 不存在，正在安装依赖...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        echo -e "${RED}错误: 未找到 pnpm 或 npm，请先安装 Node.js 和包管理器${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[1/3] 依赖已安装，跳过...${NC}"
fi

echo -e "${YELLOW}[2/3] 启动后端服务 (端口 6077)...${NC}"
if command -v pnpm &> /dev/null; then
    PORT=6077 pnpm run server:dev &
else
    PORT=6077 npm run server:dev &
fi
BACKEND_PID=$!

sleep 2

echo -e "${YELLOW}[3/3] 启动前端服务 (端口 2077)...${NC}"
if command -v pnpm &> /dev/null; then
    PORT=2077 pnpm run client:dev &
else
    PORT=2077 npm run client:dev &
fi
FRONTEND_PID=$!

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  服务启动中，请稍候...${NC}"
echo -e "${GREEN}  前端地址: http://localhost:2077${NC}"
echo -e "${GREEN}  后端地址: http://localhost:6077${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

sleep 5

STARTED=false
TIMEOUT=60
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    sleep 2
    ELAPSED=$((ELAPSED + 2))

    if [ "$STARTED" = false ]; then
        BACKEND_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:6077 --max-time 1 || echo "000")
        FRONTEND_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:2077 --max-time 1 || echo "000")

        if [ "$BACKEND_OK" != "000" ] && [ "$FRONTEND_OK" != "000" ]; then
            echo ""
            echo -e "${GREEN}========================================${NC}"
            echo -e "${GREEN}  所有服务已成功启动!${NC}"
            echo -e "${GREEN}  前端: http://localhost:2077${NC}"
            echo -e "${GREEN}  后端: http://localhost:6077${NC}"
            echo -e "${GREEN}========================================${NC}"
            echo ""
            STARTED=true

            if command -v open &> /dev/null; then
                open "http://localhost:2077"
            elif command -v xdg-open &> /dev/null; then
                xdg-open "http://localhost:2077" 2>/dev/null || true
            fi
        fi
    fi

    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${RED}后端服务已停止!${NC}"
        break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${RED}前端服务已停止!${NC}"
        break
    fi
done

wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
cleanup
