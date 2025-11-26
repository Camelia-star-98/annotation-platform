#!/bin/bash

cd /Users/ailian/Downloads/annotation-platform

echo "🔍 检查依赖..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 Node.js"
    exit 1
fi

echo "📦 安装依赖（如果需要）..."
npm install

echo ""
echo "🚀 启动 JSON Server (端口 3001)..."
npm run server &
SERVER_PID=$!

sleep 3

echo ""
echo "🚀 启动前端开发服务器..."
npm run dev &
DEV_PID=$!

echo ""
echo "✅ 服务已启动！"
echo ""
echo "📌 访问地址："
echo "   前端：http://localhost:5173 (或查看终端输出)"
echo "   后端：http://localhost:3001"
echo ""
echo "⚠️  按 Ctrl+C 停止服务"
echo ""

# 等待用户中断
wait

