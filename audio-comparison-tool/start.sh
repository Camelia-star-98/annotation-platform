#!/bin/bash

echo "=========================================="
echo "音频对比工具 - 启动助手"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "simple_demo.py" ]; then
    echo "❌ 错误：请在 audio-comparison-tool 目录下运行此脚本"
    exit 1
fi

echo "请选择运行模式："
echo ""
echo "1) 简易Demo - 无需真实音频，快速查看效果"
echo "2) 测试服务器 - 检查Web服务是否正常"
echo "3) 完整Web界面 - 启动完整功能"
echo "4) 打开使用说明 (HTML)"
echo "5) 安装最小依赖"
echo "6) 安装完整依赖"
echo ""
read -p "请输入选项 (1-6): " choice

case $choice in
    1)
        echo ""
        echo "正在运行简易Demo..."
        echo "=========================================="
        python3 simple_demo.py
        ;;
    2)
        echo ""
        echo "正在启动测试服务器..."
        echo "=========================================="
        python3 test_app.py
        ;;
    3)
        echo ""
        echo "正在启动完整Web界面..."
        echo "=========================================="
        python3 app.py
        ;;
    4)
        echo ""
        echo "正在打开使用说明..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open 使用说明.html
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open 使用说明.html
        else
            echo "请手动打开 使用说明.html 文件"
        fi
        ;;
    5)
        echo ""
        echo "正在安装最小依赖..."
        echo "=========================================="
        pip3 install -r requirements_minimal.txt
        echo ""
        echo "✅ 安装完成！现在可以运行 simple_demo.py"
        ;;
    6)
        echo ""
        echo "正在安装完整依赖..."
        echo "=========================================="
        pip3 install -r requirements.txt
        echo ""
        echo "✅ 安装完成！现在可以运行完整功能"
        ;;
    *)
        echo "❌ 无效的选项"
        exit 1
        ;;
esac

