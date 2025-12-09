#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频对比工具 - Web界面
提供用户友好的网页界面来使用音频对比功能
"""

from flask import Flask, render_template, request, jsonify, send_file
import os
from werkzeug.utils import secure_filename
from audio_comparison import AudioComparisonTool
import json
import base64

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['RESULT_FOLDER'] = 'results'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# 确保上传和结果文件夹存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULT_FOLDER'], exist_ok=True)

# 初始化音频对比工具
tool = None

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac', 'm4a'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """主页"""
    return render_template('index.html')


@app.route('/api/compare', methods=['POST'])
def compare_audio():
    """音频对比API"""
    global tool
    
    # 检查文件
    if 'reference' not in request.files or 'target' not in request.files:
        return jsonify({'error': '请上传两个音频文件'}), 400
    
    reference_file = request.files['reference']
    target_file = request.files['target']
    
    if reference_file.filename == '' or target_file.filename == '':
        return jsonify({'error': '文件名不能为空'}), 400
    
    if not (allowed_file(reference_file.filename) and allowed_file(target_file.filename)):
        return jsonify({'error': '不支持的文件格式'}), 400
    
    try:
        # 保存上传的文件
        ref_filename = secure_filename(reference_file.filename)
        tgt_filename = secure_filename(target_file.filename)
        
        ref_path = os.path.join(app.config['UPLOAD_FOLDER'], 'ref_' + ref_filename)
        tgt_path = os.path.join(app.config['UPLOAD_FOLDER'], 'tgt_' + tgt_filename)
        
        reference_file.save(ref_path)
        target_file.save(tgt_path)
        
        # 初始化工具(如果还没有初始化)
        if tool is None:
            model_size = request.form.get('model', 'base')
            tool = AudioComparisonTool(whisper_model_size=model_size)
        
        # 执行对比分析
        result_prefix = os.path.join(app.config['RESULT_FOLDER'], 'analysis')
        result = tool.compare(ref_path, tgt_path, result_prefix)
        
        # 读取生成的图片并转换为base64
        img_path = f'{result_prefix}_comparison.png'
        with open(img_path, 'rb') as f:
            img_data = base64.b64encode(f.read()).decode('utf-8')
        
        result['visualization'] = f'data:image/png;base64,{img_data}'
        
        # 清理临时文件
        os.remove(ref_path)
        os.remove(tgt_path)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def status():
    """获取服务状态"""
    return jsonify({
        'status': 'running',
        'model_loaded': tool is not None
    })


if __name__ == '__main__':
    print("=" * 60)
    print("音频对比工具 Web 服务")
    print("=" * 60)
    print("正在启动服务器...")
    print("访问地址: http://localhost:5000")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)

