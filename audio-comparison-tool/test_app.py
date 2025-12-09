#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频对比工具 - Web界面 (简化测试版)
先测试基本功能是否正常
"""

from flask import Flask, render_template
import os

app = Flask(__name__)

# 确保必要的文件夹存在
os.makedirs('uploads', exist_ok=True)
os.makedirs('results', exist_ok=True)

@app.route('/')
def index():
    """主页"""
    try:
        return render_template('index.html')
    except Exception as e:
        return f"""
        <html>
        <head><title>测试页面</title></head>
        <body>
            <h1>Flask 测试页面</h1>
            <p>如果你能看到这个页面，说明Flask正在运行！</p>
            <p>错误信息: {str(e)}</p>
            <p>工作目录: {os.getcwd()}</p>
            <p>模板目录: {os.path.join(os.getcwd(), 'templates')}</p>
        </body>
        </html>
        """

@app.route('/test')
def test():
    """测试路由"""
    return """
    <html>
    <head>
        <meta charset="UTF-8">
        <title>连接成功</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
            }
            .success {
                background: #d4edda;
                border: 2px solid #c3e6cb;
                color: #155724;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
            }
            h1 { color: #155724; }
        </style>
    </head>
    <body>
        <div class="success">
            <h1>✅ Flask 服务运行正常！</h1>
            <p>音频对比工具后端已成功启动</p>
            <p><a href="/">返回主页</a></p>
        </div>
    </body>
    </html>
    """

if __name__ == '__main__':
    print("=" * 60)
    print("音频对比工具 - 测试服务器")
    print("=" * 60)
    print(f"工作目录: {os.getcwd()}")
    print(f"模板目录: {os.path.join(os.getcwd(), 'templates')}")
    print("=" * 60)
    print("正在启动服务器...")
    print("测试地址: http://localhost:5000/test")
    print("主页地址: http://localhost:5000/")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)

