#!/bin/bash

# =========================================
# 推送到 Supabase 自动化脚本
# =========================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Supabase 推送助手${NC}"
echo ""

# 步骤1: 检查环境变量
echo -e "${CYAN}📋 步骤 1/4: 检查环境变量配置${NC}"
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ 未找到 .env.local 文件${NC}"
    echo ""
    echo -e "${YELLOW}请创建 .env.local 文件并添加：${NC}"
    echo "VITE_SUPABASE_URL=https://your-project-id.supabase.co"
    echo "VITE_SUPABASE_ANON_KEY=your-anon-key-here"
    echo ""
    exit 1
fi

# 读取环境变量
source .env.local
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ 环境变量未正确配置${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境变量已配置${NC}"
echo -e "${BLUE}   URL: ${VITE_SUPABASE_URL}${NC}"
echo ""

# 步骤2: 显示 SQL 脚本信息
echo -e "${CYAN}📋 步骤 2/4: 数据库更新脚本${NC}"
if [ ! -f UPDATE_DATABASE_TO_LATEST.sql ]; then
    echo -e "${RED}❌ 未找到 UPDATE_DATABASE_TO_LATEST.sql 文件${NC}"
    exit 1
fi

SQL_LINES=$(wc -l < UPDATE_DATABASE_TO_LATEST.sql)
echo -e "${GREEN}✅ 找到 SQL 更新脚本 (${SQL_LINES} 行)${NC}"
echo ""
echo -e "${YELLOW}⚠️  重要：数据库更新需要在 Supabase 控制台手动执行${NC}"
echo ""
echo -e "${BLUE}📝 执行步骤：${NC}"
echo "1. 打开 Supabase 控制台: https://supabase.com/dashboard"
echo "2. 选择您的项目"
echo "3. 点击左侧 'SQL Editor' → 'New query'"
echo "4. 复制 UPDATE_DATABASE_TO_LATEST.sql 的全部内容"
echo "5. 粘贴到 SQL Editor 并点击 'Run' (或按 Cmd+Enter)"
echo ""
read -p "是否已完成数据库更新？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}💡 提示：您可以打开 UPDATE_DATABASE_TO_LATEST.sql 文件复制内容${NC}"
    echo -e "${BLUE}   或者运行以下命令查看内容：${NC}"
    echo "   cat UPDATE_DATABASE_TO_LATEST.sql"
    echo ""
    read -p "按 Enter 继续（将跳过数据库更新检查）..."
fi

# 步骤3: 构建项目
echo ""
echo -e "${CYAN}📋 步骤 3/4: 构建项目${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未找到 npm，请先安装 Node.js${NC}"
    exit 1
fi

echo -e "${BLUE}🔨 正在构建...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 构建成功${NC}"
echo ""

# 步骤4: 检查并推送代码
echo -e "${CYAN}📋 步骤 4/4: 推送代码到 Git${NC}"

# 检查 Git 状态
if [[ -n $(git status -s) ]]; then
    echo -e "${BLUE}📝 检测到未提交的更改：${NC}"
    git status --short
    echo ""
    
    COMMIT_MSG="${1:-更新到 Supabase 后端}"
    echo -e "${BLUE}💾 提交更改: ${COMMIT_MSG}${NC}"
    git add .
    git commit -m "$COMMIT_MSG"
    
    echo -e "${BLUE}⬆️  推送到远程仓库...${NC}"
    git push
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 推送成功！${NC}"
    else
        echo -e "${RED}❌ 推送失败，请检查网络或权限${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 工作区干净，没有需要提交的更改${NC}"
    echo -e "${BLUE}💡 如果需要强制推送，可以运行：${NC}"
    echo "   git push"
fi

# 完成
echo ""
echo -e "${GREEN}🎉 完成！${NC}"
echo ""
echo -e "${BLUE}📝 下一步操作：${NC}"
echo "1. ✅ 确认已在 Supabase 控制台执行 SQL 脚本"
echo "2. ✅ 确认已在 Vercel 配置环境变量（如果使用 Vercel）"
echo "3. 🌐 等待 Vercel 自动部署（1-2 分钟）"
echo "4. 🧪 访问网站并测试功能"
echo ""
echo -e "${CYAN}💡 验证 Supabase 连接：${NC}"
echo "   - 打开浏览器控制台（F12）"
echo "   - 应该看到：✅ Supabase 客户端已初始化"
echo ""

