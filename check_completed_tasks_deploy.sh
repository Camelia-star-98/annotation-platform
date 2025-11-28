#!/bin/bash

# 已标注任务功能 - 部署前检查脚本

echo "=========================================="
echo "  已标注任务功能 - 部署前检查"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
PASS=0
FAIL=0

# 检查函数
check_item() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAIL++))
    fi
}

echo "1️⃣  检查文件修改..."
echo "-------------------------------------------"

# 检查主文件是否存在
if [ -f "src/pages/AnnotationTaskListPage.tsx" ]; then
    check_item 0 "主文件存在：AnnotationTaskListPage.tsx"
else
    check_item 1 "主文件缺失：AnnotationTaskListPage.tsx"
fi

echo ""
echo "2️⃣  检查关键代码..."
echo "-------------------------------------------"

# 检查是否包含新的状态列
if grep -q "title: '状态'" "src/pages/AnnotationTaskListPage.tsx"; then
    check_item 0 "包含状态列定义"
else
    check_item 1 "缺少状态列定义"
fi

# 检查是否包含isCompleted判断
if grep -q "isCompleted" "src/pages/AnnotationTaskListPage.tsx"; then
    check_item 0 "包含完成状态判断"
else
    check_item 1 "缺少完成状态判断"
fi

# 检查标签页标题
if grep -q "所有标注任务" "src/pages/AnnotationTaskListPage.tsx"; then
    check_item 0 "标签页标题已更新"
else
    check_item 1 "标签页标题未更新"
fi

echo ""
echo "3️⃣  检查构建..."
echo "-------------------------------------------"

# 尝试构建项目
echo "正在构建项目..."
if npm run build > /dev/null 2>&1; then
    check_item 0 "项目构建成功"
else
    check_item 1 "项目构建失败"
    echo -e "${RED}   请运行 'npm run build' 查看详细错误${NC}"
fi

# 检查dist目录
if [ -d "dist" ]; then
    check_item 0 "dist目录已生成"
else
    check_item 1 "dist目录未生成"
fi

echo ""
echo "4️⃣  检查测试文件..."
echo "-------------------------------------------"

# 检查测试文件
if [ -f "test_completed_tasks_v2.html" ]; then
    check_item 0 "测试文件存在"
else
    check_item 1 "测试文件缺失"
fi

echo ""
echo "5️⃣  检查文档..."
echo "-------------------------------------------"

# 检查功能说明文档
if [ -f "COMPLETED_TASKS_FEATURE.md" ]; then
    check_item 0 "功能说明文档存在"
else
    check_item 1 "功能说明文档缺失"
fi

echo ""
echo "=========================================="
echo "  检查结果"
echo "=========================================="
echo -e "通过项目: ${GREEN}${PASS}${NC}"
echo -e "失败项目: ${RED}${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ 所有检查通过！可以部署。${NC}"
    echo ""
    echo "部署命令："
    echo "  方法1: ./deploy.sh"
    echo "  方法2: npm run deploy"
    echo ""
    exit 0
else
    echo -e "${RED}✗ 有 ${FAIL} 项检查未通过，请修复后再部署。${NC}"
    echo ""
    exit 1
fi

