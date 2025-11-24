#!/bin/bash

# 自动部署脚本
# 用法: ./deploy.sh "提交说明"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 开始自动部署流程...${NC}"

# 检查是否有修改
if [[ -z $(git status -s) ]]; then
    echo -e "${GREEN}✅ 没有需要提交的修改${NC}"
    exit 0
fi

# 获取提交说明
COMMIT_MSG="${1:-更新代码}"

echo -e "${BLUE}📝 添加所有修改...${NC}"
git add .

echo -e "${BLUE}💾 提交修改: ${COMMIT_MSG}${NC}"
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

