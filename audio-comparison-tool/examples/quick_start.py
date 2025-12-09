#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速开始示例
演示如何使用音频对比工具
"""

import sys
sys.path.append('..')

from audio_comparison import AudioComparisonTool
import numpy as np
import soundfile as sf

def create_sample_audio():
    """创建示例音频文件用于测试"""
    print("创建示例音频文件...")
    
    # 生成一个简单的正弦波音频 (标准音频)
    sample_rate = 16000
    duration = 3  # 3秒
    frequency = 440  # A4音符
    
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio1 = np.sin(2 * np.pi * frequency * t) * 0.3
    
    # 生成一个稍有不同的音频 (待检测音频)
    # 添加一些频率变化和噪音来模拟读音问题
    audio2 = np.sin(2 * np.pi * (frequency + 5) * t) * 0.3  # 频率略有不同
    audio2 += np.random.normal(0, 0.05, audio2.shape)  # 添加噪音
    
    # 保存音频文件
    sf.write('sample_reference.wav', audio1, sample_rate)
    sf.write('sample_target.wav', audio2, sample_rate)
    
    print("示例音频已创建: sample_reference.wav, sample_target.wav")
    return 'sample_reference.wav', 'sample_target.wav'


def example1_basic_comparison():
    """示例1: 基础对比"""
    print("\n" + "="*60)
    print("示例1: 基础音频对比")
    print("="*60)
    
    # 创建示例音频
    ref_path, tgt_path = create_sample_audio()
    
    # 初始化工具(使用tiny模型加快演示速度)
    tool = AudioComparisonTool(whisper_model_size='tiny')
    
    # 执行对比
    result = tool.compare(ref_path, tgt_path, output_prefix='example1')
    
    print("\n分析完成！查看 example1_comparison.png 和 example1_analysis.json")


def example2_step_by_step():
    """示例2: 分步骤使用各个功能"""
    print("\n" + "="*60)
    print("示例2: 分步骤演示")
    print("="*60)
    
    ref_path, tgt_path = create_sample_audio()
    
    tool = AudioComparisonTool(whisper_model_size='tiny')
    
    # 步骤1: 加载音频
    print("\n步骤1: 加载音频")
    ref_audio, sr = tool.load_audio(ref_path)
    tgt_audio, _ = tool.load_audio(tgt_path)
    print(f"  音频长度: {len(ref_audio)/sr:.2f}秒, 采样率: {sr}Hz")
    
    # 步骤2: 提取特征
    print("\n步骤2: 提取MFCC特征")
    ref_mfcc = tool.extract_mfcc(ref_audio, sr)
    tgt_mfcc = tool.extract_mfcc(tgt_audio, sr)
    print(f"  特征维度: {ref_mfcc.shape}")
    
    # 步骤3: 计算相似度
    print("\n步骤3: 计算相似度")
    similarity = tool.compute_similarity(ref_mfcc, tgt_mfcc)
    print(f"  相似度得分: {similarity:.2f}/100")
    
    # 步骤4: 检测问题
    print("\n步骤4: 检测读音问题")
    issues = tool.detect_pronunciation_issues(ref_audio, tgt_audio, sr, threshold=0.7)
    print(f"  发现 {len(issues)} 个问题片段")
    
    # 步骤5: 可视化
    print("\n步骤5: 生成可视化")
    tool.visualize_comparison(ref_audio, tgt_audio, sr, issues, 'example2_viz.png')
    print("  可视化已保存")


def example3_custom_threshold():
    """示例3: 自定义阈值"""
    print("\n" + "="*60)
    print("示例3: 使用不同的检测阈值")
    print("="*60)
    
    ref_path, tgt_path = create_sample_audio()
    tool = AudioComparisonTool(whisper_model_size='tiny')
    
    ref_audio, sr = tool.load_audio(ref_path)
    tgt_audio, _ = tool.load_audio(tgt_path)
    
    # 尝试不同的阈值
    thresholds = [0.5, 0.7, 0.9]
    
    for threshold in thresholds:
        issues = tool.detect_pronunciation_issues(
            ref_audio, tgt_audio, sr, threshold=threshold
        )
        print(f"\n阈值 {threshold}: 检测到 {len(issues)} 个问题片段")
        for i, issue in enumerate(issues[:3], 1):  # 只显示前3个
            print(f"  {i}. {issue['start_time']:.2f}s - {issue['end_time']:.2f}s "
                  f"(相似度: {issue['similarity']:.2f})")


def main():
    """运行所有示例"""
    print("音频对比工具 - 快速开始示例")
    print("="*60)
    
    # 运行示例
    example1_basic_comparison()
    
    # 如果需要更多示例，取消注释下面的行
    # example2_step_by_step()
    # example3_custom_threshold()
    
    print("\n" + "="*60)
    print("所有示例完成！")
    print("="*60)
    print("\n提示:")
    print("1. 使用真实的音频文件可以获得更好的效果")
    print("2. 建议使用 'base' 或更大的模型以获得更准确的转录")
    print("3. 查看生成的PNG图片和JSON文件了解详细结果")
    print("\n下一步:")
    print("- 尝试使用自己的音频文件")
    print("- 启动Web界面: python ../app.py")
    print("- 使用命令行: python ../audio_comparison.py -r 标准.wav -t 测试.wav")


if __name__ == '__main__':
    main()

