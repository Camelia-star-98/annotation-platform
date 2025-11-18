#!/bin/bash

echo "🚀 启动标注平台..."
echo ""
echo "📝 提示：此脚本会打开两个终端窗口"
echo "   - 终端1: JSON Server 后端 (端口3001)"
echo "   - 终端2: 前端开发服务器 (端口3000)"
echo ""
echo "⏳ 准备启动..."
sleep 2

# 获取项目目录
PROJECT_DIR="/Users/ailian/Downloads/annotation-platform"

# 启动JSON Server（后端）
osascript -e "
tell application \"Terminal\"
    do script \"cd $PROJECT_DIR && echo '🔥 启动JSON Server后端...' && npm run server\"
    activate
end tell
"

# 等待2秒让后端先启动
sleep 2

# 启动Vite开发服务器（前端）
osascript -e "
tell application \"Terminal\"
    do script \"cd $PROJECT_DIR && echo '🎨 启动前端开发服务器...' && npm run dev\"
    activate
end tell
"

echo ""
echo "✅ 启动完成！"
echo ""
echo "📌 访问地址："
echo "   前端：http://localhost:3000"
echo "   后端：http://localhost:3001"
echo ""
echo "⚠️  注意：不要关闭这两个终端窗口"
echo ""

