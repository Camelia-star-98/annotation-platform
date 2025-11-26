#!/bin/bash

# 快速提交脚本
echo "🚀 开始提交代码..."

# 添加所有更改
git add -A

# 显示将要提交的文件
echo ""
echo "📝 将要提交的文件："
git status --short

# 提交
echo ""
echo "💾 提交更改..."
git commit -m "更新到 Supabase 后端：添加数据库更新脚本和部署文档"

# 推送
echo ""
echo "⬆️  推送到远程仓库..."
git push origin main

echo ""
echo "✅ 完成！Vercel 将自动部署，请稍等 1-2 分钟"

