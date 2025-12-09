#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频对比工具 - 核心功能模块
用于检测音频中的读音问题
"""

import whisper
import librosa
import soundfile as sf
import numpy as np
from scipy.spatial.distance import cosine
from dtw import dtw
import matplotlib.pyplot as plt
from typing import Tuple, Dict, List
import warnings
warnings.filterwarnings('ignore')


class AudioComparisonTool:
    """音频对比分析工具"""
    
    def __init__(self, whisper_model_size='base'):
        """
        初始化工具
        
        Args:
            whisper_model_size: Whisper模型大小 (tiny, base, small, medium, large)
        """
        print(f"正在加载 Whisper 模型 ({whisper_model_size})...")
        self.whisper_model = whisper.load_model(whisper_model_size)
        print("模型加载完成！")
        
    def load_audio(self, audio_path: str, sr: int = 16000) -> Tuple[np.ndarray, int]:
        """
        加载音频文件
        
        Args:
            audio_path: 音频文件路径
            sr: 采样率
            
        Returns:
            (音频数据, 采样率)
        """
        audio, sample_rate = librosa.load(audio_path, sr=sr)
        return audio, sample_rate
    
    def transcribe(self, audio_path: str) -> Dict:
        """
        转录音频为文字
        
        Args:
            audio_path: 音频文件路径
            
        Returns:
            包含文本和详细信息的字典
        """
        result = self.whisper_model.transcribe(
            audio_path,
            language='zh',  # 可以改为 'en' 或其他语言
            word_timestamps=True
        )
        return result
    
    def extract_mfcc(self, audio: np.ndarray, sr: int, n_mfcc: int = 13) -> np.ndarray:
        """
        提取MFCC特征
        
        Args:
            audio: 音频数据
            sr: 采样率
            n_mfcc: MFCC系数数量
            
        Returns:
            MFCC特征矩阵
        """
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=n_mfcc)
        # 归一化
        mfcc = (mfcc - np.mean(mfcc, axis=1, keepdims=True)) / (np.std(mfcc, axis=1, keepdims=True) + 1e-10)
        return mfcc
    
    def compute_similarity(self, mfcc1: np.ndarray, mfcc2: np.ndarray) -> float:
        """
        计算两个音频的相似度
        
        Args:
            mfcc1: 第一个音频的MFCC特征
            mfcc2: 第二个音频的MFCC特征
            
        Returns:
            相似度分数 (0-100)
        """
        # 使用DTW(动态时间规整)计算距离
        distance = dtw(mfcc1.T, mfcc2.T).distance
        
        # 转换为相似度分数(0-100)
        # 这里使用经验公式，可以根据实际情况调整
        max_distance = max(mfcc1.shape[1], mfcc2.shape[1]) * 10
        similarity = max(0, 100 * (1 - distance / max_distance))
        
        return similarity
    
    def detect_pronunciation_issues(
        self, 
        reference_audio: np.ndarray,
        target_audio: np.ndarray,
        sr: int,
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        检测读音问题
        
        Args:
            reference_audio: 标准音频
            target_audio: 待检测音频
            sr: 采样率
            threshold: 相似度阈值(低于此值认为有问题)
            
        Returns:
            问题片段列表
        """
        # 将音频分段分析
        segment_length = int(0.5 * sr)  # 0.5秒一段
        hop_length = int(0.25 * sr)     # 0.25秒步进
        
        issues = []
        
        for i in range(0, min(len(reference_audio), len(target_audio)) - segment_length, hop_length):
            ref_segment = reference_audio[i:i+segment_length]
            tgt_segment = target_audio[i:i+segment_length]
            
            # 提取特征
            ref_mfcc = self.extract_mfcc(ref_segment, sr)
            tgt_mfcc = self.extract_mfcc(tgt_segment, sr)
            
            # 计算相似度
            similarity = self.compute_similarity(ref_mfcc, tgt_mfcc)
            
            # 如果相似度低于阈值，标记为问题片段
            if similarity < threshold * 100:
                issues.append({
                    'start_time': i / sr,
                    'end_time': (i + segment_length) / sr,
                    'similarity': similarity,
                    'severity': 'high' if similarity < threshold * 50 else 'medium'
                })
        
        # 合并相邻的问题片段
        merged_issues = self._merge_issues(issues)
        
        return merged_issues
    
    def _merge_issues(self, issues: List[Dict], gap_threshold: float = 0.3) -> List[Dict]:
        """合并相邻的问题片段"""
        if not issues:
            return []
        
        merged = []
        current = issues[0].copy()
        
        for issue in issues[1:]:
            if issue['start_time'] - current['end_time'] < gap_threshold:
                # 合并
                current['end_time'] = issue['end_time']
                current['similarity'] = min(current['similarity'], issue['similarity'])
            else:
                merged.append(current)
                current = issue.copy()
        
        merged.append(current)
        return merged
    
    def visualize_comparison(
        self,
        reference_audio: np.ndarray,
        target_audio: np.ndarray,
        sr: int,
        issues: List[Dict] = None,
        save_path: str = 'comparison.png'
    ):
        """
        可视化音频对比
        
        Args:
            reference_audio: 标准音频
            target_audio: 待检测音频
            sr: 采样率
            issues: 问题片段列表
            save_path: 保存图片的路径
        """
        fig, axes = plt.subplots(4, 1, figsize=(15, 12))
        
        # 时间轴
        time_ref = np.linspace(0, len(reference_audio) / sr, len(reference_audio))
        time_tgt = np.linspace(0, len(target_audio) / sr, len(target_audio))
        
        # 1. 标准音频波形
        axes[0].plot(time_ref, reference_audio, alpha=0.7, color='blue')
        axes[0].set_title('标准音频波形', fontsize=14, fontproperties='SimHei')
        axes[0].set_ylabel('振幅')
        axes[0].grid(True, alpha=0.3)
        
        # 2. 待检测音频波形
        axes[1].plot(time_tgt, target_audio, alpha=0.7, color='orange')
        axes[1].set_title('待检测音频波形', fontsize=14, fontproperties='SimHei')
        axes[1].set_ylabel('振幅')
        axes[1].grid(True, alpha=0.3)
        
        # 标注问题片段
        if issues:
            for issue in issues:
                color = 'red' if issue['severity'] == 'high' else 'yellow'
                axes[1].axvspan(issue['start_time'], issue['end_time'], 
                              alpha=0.3, color=color, 
                              label=f"问题片段 (相似度: {issue['similarity']:.1f})")
        
        # 3. 标准音频频谱图
        D_ref = librosa.amplitude_to_db(np.abs(librosa.stft(reference_audio)), ref=np.max)
        img1 = librosa.display.specshow(D_ref, sr=sr, x_axis='time', y_axis='hz', ax=axes[2])
        axes[2].set_title('标准音频频谱图', fontsize=14, fontproperties='SimHei')
        fig.colorbar(img1, ax=axes[2], format='%+2.0f dB')
        
        # 4. 待检测音频频谱图
        D_tgt = librosa.amplitude_to_db(np.abs(librosa.stft(target_audio)), ref=np.max)
        img2 = librosa.display.specshow(D_tgt, sr=sr, x_axis='time', y_axis='hz', ax=axes[3])
        axes[3].set_title('待检测音频频谱图', fontsize=14, fontproperties='SimHei')
        axes[3].set_xlabel('时间 (秒)')
        fig.colorbar(img2, ax=axes[3], format='%+2.0f dB')
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"可视化结果已保存到: {save_path}")
        
    def compare(self, reference_path: str, target_path: str, output_prefix: str = 'result') -> Dict:
        """
        完整的音频对比分析流程
        
        Args:
            reference_path: 标准音频路径
            target_path: 待检测音频路径
            output_prefix: 输出文件前缀
            
        Returns:
            分析结果字典
        """
        print("=" * 60)
        print("开始音频对比分析...")
        print("=" * 60)
        
        # 1. 转录音频
        print("\n[1/5] 正在转录标准音频...")
        ref_transcript = self.transcribe(reference_path)
        print(f"标准文本: {ref_transcript['text']}")
        
        print("\n[2/5] 正在转录待检测音频...")
        tgt_transcript = self.transcribe(target_path)
        print(f"待检测文本: {tgt_transcript['text']}")
        
        # 2. 加载音频
        print("\n[3/5] 正在加载音频文件...")
        ref_audio, sr = self.load_audio(reference_path)
        tgt_audio, _ = self.load_audio(target_path)
        
        # 3. 提取特征并计算相似度
        print("\n[4/5] 正在计算音频相似度...")
        ref_mfcc = self.extract_mfcc(ref_audio, sr)
        tgt_mfcc = self.extract_mfcc(tgt_audio, sr)
        overall_similarity = self.compute_similarity(ref_mfcc, tgt_mfcc)
        print(f"整体相似度: {overall_similarity:.2f}/100")
        
        # 4. 检测问题片段
        print("\n[5/5] 正在检测读音问题...")
        issues = self.detect_pronunciation_issues(ref_audio, tgt_audio, sr)
        
        if issues:
            print(f"\n发现 {len(issues)} 个潜在的读音问题:")
            for i, issue in enumerate(issues, 1):
                print(f"  {i}. 时间段: {issue['start_time']:.2f}s - {issue['end_time']:.2f}s, "
                      f"相似度: {issue['similarity']:.2f}, 严重程度: {issue['severity']}")
        else:
            print("\n未检测到明显的读音问题。")
        
        # 5. 生成可视化
        print("\n正在生成可视化图表...")
        self.visualize_comparison(
            ref_audio, tgt_audio, sr, issues, 
            save_path=f'{output_prefix}_comparison.png'
        )
        
        # 汇总结果
        result = {
            'reference_text': ref_transcript['text'],
            'target_text': tgt_transcript['text'],
            'overall_similarity': overall_similarity,
            'issues': issues,
            'assessment': self._assess_quality(overall_similarity, issues)
        }
        
        print("\n" + "=" * 60)
        print(f"分析完成！综合评价: {result['assessment']}")
        print("=" * 60)
        
        return result
    
    def _assess_quality(self, similarity: float, issues: List[Dict]) -> str:
        """评估发音质量"""
        if similarity >= 90 and len(issues) == 0:
            return "优秀 - 发音准确，与标准音频高度一致"
        elif similarity >= 75 and len(issues) <= 2:
            return "良好 - 发音基本准确，有少量需要改进的地方"
        elif similarity >= 60 and len(issues) <= 5:
            return "一般 - 发音存在一些问题，建议多加练习"
        else:
            return "需要改进 - 发音与标准音频差异较大，建议重点练习"


def main():
    """命令行使用示例"""
    import argparse
    
    parser = argparse.ArgumentParser(description='音频对比工具 - 检测读音问题')
    parser.add_argument('--reference', '-r', required=True, help='标准音频文件路径')
    parser.add_argument('--target', '-t', required=True, help='待检测音频文件路径')
    parser.add_argument('--model', '-m', default='base', 
                       choices=['tiny', 'base', 'small', 'medium', 'large'],
                       help='Whisper模型大小')
    parser.add_argument('--output', '-o', default='result', help='输出文件前缀')
    
    args = parser.parse_args()
    
    # 创建工具实例
    tool = AudioComparisonTool(whisper_model_size=args.model)
    
    # 执行对比分析
    result = tool.compare(args.reference, args.target, args.output)
    
    # 保存结果到文件
    import json
    with open(f'{args.output}_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n详细结果已保存到: {args.output}_analysis.json")


if __name__ == '__main__':
    main()

