#!/bin/bash

# =========================================
# Supabase 后端更新助手脚本
# =========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Supabase 后端更新助手${NC}"
echo ""

# 检查 .env.local 文件
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠️  未找到 .env.local 文件${NC}"
    echo -e "${BLUE}📝 请先创建 .env.local 文件并添加以下内容：${NC}"
    echo ""
    echo "VITE_SUPABASE_URL=https://your-project-id.supabase.co"
    echo "VITE_SUPABASE_ANON_KEY=your-anon-key-here"
    echo ""
    echo -e "${YELLOW}获取凭证：Supabase 控制台 → Settings → API${NC}"
    echo ""
    read -p "是否已配置环境变量？(y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ 请先配置环境变量后再运行此脚本${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 找到 .env.local 文件${NC}"
fi

# 检查 UPDATE_DATABASE_TO_LATEST.sql 文件
if [ ! -f UPDATE_DATABASE_TO_LATEST.sql ]; then
    echo -e "${RED}❌ 未找到 UPDATE_DATABASE_TO_LATEST.sql 文件${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 更新步骤：${NC}"
echo ""
echo "1️⃣  更新 Supabase 数据库（必须在 Supabase 控制台手动执行）"
echo "   - 打开：https://supabase.com"
echo "   - 选择项目 → SQL Editor → New query"
echo "   - 复制 UPDATE_DATABASE_TO_LATEST.sql 的内容"
echo "   - 粘贴并执行"
echo ""
read -p "是否已完成数据库更新？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  请先完成数据库更新${NC}"
    echo -e "${BLUE}💡 提示：打开 UPDATE_DATABASE_TO_LATEST.sql 文件，复制内容到 Supabase SQL Editor 执行${NC}"
    exit 1
fi

# 构建项目
echo ""
echo -e "${BLUE}🔨 构建项目...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 构建失败，请检查错误信息${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 构建成功${NC}"

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    echo ""
    echo -e "${BLUE}📝 检测到未提交的更改${NC}"
    git status --short
    echo ""
    read -p "是否提交并推送到远程仓库？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        COMMIT_MSG="${1:-更新到 Supabase 后端}"
        echo -e "${BLUE}💾 提交更改: ${COMMIT_MSG}${NC}"
        git add .
        git commit -m "$COMMIT_MSG"
        
        echo -e "${BLUE}⬆️  推送到远程仓库...${NC}"
        git push
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 推送成功！${NC}"
            echo -e "${GREEN}🎉 Vercel 将自动部署，请稍等 1-2 分钟后访问网站${NC}"
        else
            echo -e "${RED}❌ 推送失败，请检查网络或权限${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  跳过提交，您可以稍后手动提交${NC}"
    fi
else
    echo -e "${GREEN}✅ 没有未提交的更改${NC}"
fi

echo ""
echo -e "${GREEN}✅ 更新完成！${NC}"
echo ""
echo -e "${BLUE}📝 下一步：${NC}"
echo "1. 在 Vercel 中配置环境变量（如果还未配置）"
echo "2. 等待 Vercel 自动部署完成"
echo "3. 访问网站并测试功能"
echo ""

