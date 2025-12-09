#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简易测试脚本 - 不需要实际音频文件的演示
展示音频对比工具的核心算法
"""

import numpy as np
from scipy.spatial.distance import euclidean
from dtw import dtw
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # 非GUI后端

def generate_test_signal(duration=2.0, sr=16000, freq=440, noise_level=0.0):
    """生成测试信号"""
    t = np.linspace(0, duration, int(sr * duration))
    signal = np.sin(2 * np.pi * freq * t)
    if noise_level > 0:
        signal += np.random.normal(0, noise_level, signal.shape)
    return signal, t

def extract_simple_features(signal, window_size=256, hop_size=128):
    """提取简单的频域特征"""
    features = []
    for i in range(0, len(signal) - window_size, hop_size):
        window = signal[i:i+window_size]
        # 计算FFT
        fft = np.abs(np.fft.fft(window))[:window_size//2]
        # 取对数能量
        energy = np.log(np.sum(fft**2) + 1e-10)
        # 频谱重心
        centroid = np.sum(fft * np.arange(len(fft))) / (np.sum(fft) + 1e-10)
        features.append([energy, centroid])
    return np.array(features)

def compute_similarity_score(features1, features2):
    """计算相似度分数"""
    # 使用DTW计算距离
    alignment = dtw(features1, features2, dist_method='euclidean')
    distance = alignment.distance
    # 归一化并转换为0-100的分数
    max_distance = max(len(features1), len(features2)) * 100
    similarity = max(0, 100 * (1 - distance / max_distance))
    return similarity

def detect_issues(features1, features2, threshold=70):
    """检测问题片段"""
    min_len = min(len(features1), len(features2))
    issues = []
    
    window = 10  # 分析窗口
    for i in range(0, min_len - window, 5):
        seg1 = features1[i:i+window]
        seg2 = features2[i:i+window]
        
        sim = compute_similarity_score(seg1, seg2)
        if sim < threshold:
            issues.append({
                'frame': i,
                'similarity': sim,
                'severity': 'high' if sim < 50 else 'medium'
            })
    
    return issues

def visualize_comparison(signal1, signal2, features1, features2, issues, filename='demo_result.png'):
    """可视化对比结果"""
    fig, axes = plt.subplots(3, 1, figsize=(12, 10))
    
    # 绘制信号波形
    axes[0].plot(signal1, alpha=0.7, label='标准信号', linewidth=0.5)
    axes[0].set_title('标准音频波形', fontsize=14, fontproperties='SimHei')
    axes[0].set_ylabel('振幅')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)
    
    axes[1].plot(signal2, alpha=0.7, color='orange', label='待检测信号', linewidth=0.5)
    axes[1].set_title('待检测音频波形', fontsize=14, fontproperties='SimHei')
    axes[1].set_ylabel('振幅')
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)
    
    # 标注问题区域
    for issue in issues:
        start = issue['frame'] * 128  # hop_size
        end = start + 10 * 128  # window * hop_size
        color = 'red' if issue['severity'] == 'high' else 'yellow'
        axes[1].axvspan(start, end, alpha=0.3, color=color)
    
    # 绘制特征对比
    axes[2].plot(features1[:, 0], label='标准特征', alpha=0.7)
    axes[2].plot(features2[:, 0], label='待检测特征', alpha=0.7)
    axes[2].set_title('频域特征对比', fontsize=14, fontproperties='SimHei')
    axes[2].set_xlabel('帧')
    axes[2].set_ylabel('对数能量')
    axes[2].legend()
    axes[2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(filename, dpi=150, bbox_inches='tight')
    print(f"✅ 可视化结果已保存: {filename}")

def main():
    """主演示函数"""
    print("="*70)
    print("音频对比工具 - 简易Demo演示")
    print("="*70)
    print("\n这个demo使用合成信号演示核心算法，无需实际音频文件")
    
    # 场景1: 高相似度
    print("\n【场景1】标准发音 vs 良好发音")
    print("-"*70)
    signal1, t = generate_test_signal(freq=440, noise_level=0.0)
    signal2, _ = generate_test_signal(freq=442, noise_level=0.05)  # 略有差异
    
    features1 = extract_simple_features(signal1)
    features2 = extract_simple_features(signal2)
    
    similarity = compute_similarity_score(features1, features2)
    issues = detect_issues(features1, features2, threshold=70)
    
    print(f"📊 相似度得分: {similarity:.2f}/100")
    print(f"⚠️  检测到 {len(issues)} 个潜在问题")
    if similarity >= 85:
        print("✅ 评价: 优秀 - 发音准确")
    elif similarity >= 70:
        print("✅ 评价: 良好 - 基本准确")
    else:
        print("⚠️  评价: 需要改进")
    
    visualize_comparison(signal1, signal2, features1, features2, issues, 
                        'demo_scenario1_good.png')
    
    # 场景2: 明显差异
    print("\n【场景2】标准发音 vs 问题发音")
    print("-"*70)
    signal3, _ = generate_test_signal(freq=440, noise_level=0.0)
    signal4, _ = generate_test_signal(freq=480, noise_level=0.2)  # 明显差异
    
    features3 = extract_simple_features(signal3)
    features4 = extract_simple_features(signal4)
    
    similarity = compute_similarity_score(features3, features4)
    issues = detect_issues(features3, features4, threshold=70)
    
    print(f"📊 相似度得分: {similarity:.2f}/100")
    print(f"⚠️  检测到 {len(issues)} 个潜在问题")
    if similarity >= 85:
        print("✅ 评价: 优秀 - 发音准确")
    elif similarity >= 70:
        print("✅ 评价: 良好 - 基本准确")
    else:
        print("❌ 评价: 需要改进 - 存在明显读音问题")
    
    if issues:
        print(f"\n问题片段详情:")
        for i, issue in enumerate(issues[:5], 1):  # 显示前5个
            print(f"  {i}. 帧位置: {issue['frame']}, "
                  f"相似度: {issue['similarity']:.1f}, "
                  f"严重程度: {issue['severity']}")
    
    visualize_comparison(signal3, signal4, features3, features4, issues,
                        'demo_scenario2_issues.png')
    
    print("\n" + "="*70)
    print("Demo完成！")
    print("="*70)
    print("\n📊 生成的文件:")
    print("  - demo_scenario1_good.png (良好发音示例)")
    print("  - demo_scenario2_issues.png (问题发音示例)")
    
    print("\n💡 核心算法说明:")
    print("  1. 特征提取: 从音频信号提取频域特征(能量、频谱重心等)")
    print("  2. DTW对齐: 使用动态时间规整算法对比两段音频")
    print("  3. 相似度计算: 将距离转换为0-100的相似度分数")
    print("  4. 问题检测: 滑动窗口检测相似度低于阈值的片段")
    
    print("\n🚀 下一步:")
    print("  1. 安装完整依赖: pip install -r requirements.txt")
    print("  2. 运行示例: python examples/quick_start.py")
    print("  3. 启动Web界面: python app.py")
    print("  4. 使用真实音频文件进行测试")

if __name__ == '__main__':
    main()

