#!/usr/bin/env python3
"""
时心语老师英语教学录音 -> CosyVoice 训练数据转换工具
专门适配你的数据格式
"""

import os
import shutil
import csv
import random
from pathlib import Path
from typing import Dict, List, Tuple
import wave
import contextlib


class ShixinyuDatasetConverter:
    """时心语数据集转换器"""
    
    def __init__(self, base_dir: str, output_dir: str = "./cosyvoice_training_data"):
        """
        初始化转换器
        
        Args:
            base_dir: 基础目录 (AIJHSEnglishShixinyu1to1Recording_4.77H_251216)
            output_dir: 输出目录
        """
        self.base_dir = Path(base_dir)
        self.output_dir = Path(output_dir)
        
        # 情绪类别
        self.emotions = {
            'Teach': 'teaching',      # 教学
            'Encourage': 'encouraging',  # 鼓励
            'Praise': 'praising',     # 表扬
            'Serious': 'serious'      # 严肃
        }
        
        self.samples = []
        
        print("=" * 80)
        print("时心语老师英语教学录音 -> CosyVoice 训练数据转换")
        print("=" * 80)
        print()
    
    def load_all_data(self):
        """加载所有情绪类别的数据"""
        
        for emotion_folder, emotion_tag in self.emotions.items():
            emotion_path = self.base_dir / f"AIJHSEnglishShixinyu1to1Recording{emotion_folder}"
            
            if not emotion_path.exists():
                print(f"⚠️  跳过 {emotion_folder}（目录不存在）")
                continue
            
            print(f"📂 处理 {emotion_folder} ({emotion_tag})...")
            
            # 加载标注文件
            text_file = emotion_path / "text.txt"
            audio_dir = emotion_path / "wavs" / "48k"
            
            if not text_file.exists():
                print(f"  ⚠️  标注文件不存在: {text_file}")
                continue
            
            if not audio_dir.exists():
                print(f"  ⚠️  音频目录不存在: {audio_dir}")
                continue
            
            # 解析标注文件
            annotations = {}
            with open(text_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # 使用 TAB 分割
                    parts = line.split('\t', 1)
                    if len(parts) == 2:
                        audio_id, text = parts
                        annotations[audio_id] = text.strip()
            
            print(f"  ✅ 加载 {len(annotations)} 条标注")
            
            # 匹配音频文件
            added = 0
            for audio_id, text in annotations.items():
                audio_file = audio_dir / f"{audio_id}.wav"
                
                if not audio_file.exists():
                    print(f"  ⚠️  音频文件不存在: {audio_file.name}")
                    continue
                
                # 获取音频时长
                duration = self._get_audio_duration(audio_file)
                
                self.samples.append({
                    'audio_path': str(audio_file),
                    'text': text,
                    'speaker': 'shixinyu',
                    'emotion': emotion_tag,
                    'duration': duration,
                    'audio_id': audio_id
                })
                
                added += 1
            
            print(f"  ✅ 成功添加 {added} 个样本")
            print()
        
        print(f"📊 总计: {len(self.samples)} 个样本\n")
    
    def _get_audio_duration(self, audio_path: Path) -> float:
        """获取音频时长（秒）"""
        try:
            with contextlib.closing(wave.open(str(audio_path), 'r')) as f:
                frames = f.getnframes()
                rate = f.getframerate()
                duration = frames / float(rate)
                return duration
        except Exception as e:
            print(f"  ⚠️  无法读取音频时长: {audio_path.name} - {e}")
            return 0.0
    
    def show_statistics(self):
        """显示数据集统计信息"""
        
        if not self.samples:
            print("⚠️  没有数据")
            return
        
        print("=" * 80)
        print("📊 数据集统计")
        print("=" * 80)
        
        # 总体统计
        total_duration = sum(s['duration'] for s in self.samples)
        avg_duration = total_duration / len(self.samples)
        
        text_lengths = [len(s['text']) for s in self.samples]
        avg_text_length = sum(text_lengths) / len(text_lengths)
        
        print(f"\n总样本数: {len(self.samples)}")
        print(f"总时长: {total_duration / 3600:.2f} 小时")
        print(f"平均音频时长: {avg_duration:.2f} 秒")
        print(f"平均文本长度: {avg_text_length:.1f} 字符")
        
        # 按情绪分类统计
        print("\n按情绪分类:")
        emotion_stats = {}
        for sample in self.samples:
            emotion = sample['emotion']
            if emotion not in emotion_stats:
                emotion_stats[emotion] = {
                    'count': 0,
                    'duration': 0.0
                }
            emotion_stats[emotion]['count'] += 1
            emotion_stats[emotion]['duration'] += sample['duration']
        
        for emotion, stats in sorted(emotion_stats.items()):
            print(f"  {emotion:12s}: {stats['count']:4d} 个样本, "
                  f"{stats['duration']/3600:.2f} 小时 "
                  f"({stats['count']/len(self.samples)*100:.1f}%)")
        
        # 时长分布
        print("\n时长分布:")
        duration_ranges = [
            (0, 2, "0-2秒"),
            (2, 5, "2-5秒"),
            (5, 10, "5-10秒"),
            (10, 20, "10-20秒"),
            (20, float('inf'), "20秒+")
        ]
        
        for min_d, max_d, label in duration_ranges:
            count = sum(1 for s in self.samples if min_d <= s['duration'] < max_d)
            if count > 0:
                print(f"  {label:8s}: {count:4d} 个样本 ({count/len(self.samples)*100:.1f}%)")
        
        # 文本长度分布
        print("\n文本长度分布:")
        length_ranges = [
            (0, 20, "0-20字"),
            (20, 50, "20-50字"),
            (50, 100, "50-100字"),
            (100, 200, "100-200字"),
            (200, float('inf'), "200字+")
        ]
        
        for min_l, max_l, label in length_ranges:
            count = sum(1 for s in self.samples if min_l <= len(s['text']) < max_l)
            if count > 0:
                print(f"  {label:12s}: {count:4d} 个样本 ({count/len(self.samples)*100:.1f}%)")
        
        print()
    
    def filter_by_duration(self, min_duration: float = 1.0, max_duration: float = 30.0):
        """按时长过滤"""
        before = len(self.samples)
        self.samples = [
            s for s in self.samples 
            if min_duration <= s['duration'] <= max_duration
        ]
        after = len(self.samples)
        
        print(f"🔍 时长过滤: {min_duration}s - {max_duration}s")
        print(f"   保留 {after} 个样本，移除 {before - after} 个样本\n")
    
    def filter_by_text_length(self, min_length: int = 5, max_length: int = 300):
        """按文本长度过滤"""
        before = len(self.samples)
        self.samples = [
            s for s in self.samples 
            if min_length <= len(s['text']) <= max_length
        ]
        after = len(self.samples)
        
        print(f"🔍 文本长度过滤: {min_length} - {max_length} 字符")
        print(f"   保留 {after} 个样本，移除 {before - after} 个样本\n")
    
    def split_dataset(
        self, 
        train_ratio: float = 0.85, 
        val_ratio: float = 0.10,
        test_ratio: float = 0.05
    ) -> Tuple[List, List, List]:
        """划分数据集"""
        
        assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 0.001
        
        # 打乱
        samples = self.samples.copy()
        random.seed(42)
        random.shuffle(samples)
        
        total = len(samples)
        train_end = int(total * train_ratio)
        val_end = train_end + int(total * val_ratio)
        
        train = samples[:train_end]
        val = samples[train_end:val_end]
        test = samples[val_end:]
        
        print("=" * 80)
        print("📊 数据集划分")
        print("=" * 80)
        print(f"训练集: {len(train):4d} 个样本 ({len(train)/total*100:.1f}%)")
        print(f"验证集: {len(val):4d} 个样本 ({len(val)/total*100:.1f}%)")
        print(f"测试集: {len(test):4d} 个样本 ({len(test)/total*100:.1f}%)")
        print()
        
        return train, val, test
    
    def export(
        self, 
        copy_audio: bool = True,
        target_sample_rate: int = 22050,
        include_emotion_tag: bool = True
    ):
        """
        导出数据集
        
        Args:
            copy_audio: 是否复制音频文件
            target_sample_rate: 目标采样率（22050 for CosyVoice）
            include_emotion_tag: 是否在文本中包含情绪标签
        """
        
        print("=" * 80)
        print("📦 导出 CosyVoice 训练数据")
        print("=" * 80)
        print()
        
        # 创建输出目录
        audio_dir = self.output_dir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        
        # 划分数据集
        train, val, test = self.split_dataset()
        
        splits = {
            'train': train,
            'val': val,
            'test': test
        }
        
        for split_name, samples in splits.items():
            print(f"处理 {split_name} 集...")
            
            metadata_path = self.output_dir / f"metadata_{split_name}.csv"
            
            with open(metadata_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f, delimiter='|')
                
                for i, sample in enumerate(samples):
                    audio_path = Path(sample['audio_path'])
                    
                    if copy_audio:
                        # 生成新文件名
                        emotion = sample['emotion']
                        new_filename = f"{split_name}_{emotion}_{i:05d}.wav"
                        new_audio_path = audio_dir / new_filename
                        
                        # 复制音频（如果需要降采样，可以在这里用 ffmpeg）
                        if not new_audio_path.exists():
                            if target_sample_rate == 48000:
                                # 直接复制
                                shutil.copy2(audio_path, new_audio_path)
                            else:
                                # 需要降采样（需要安装 ffmpeg）
                                import subprocess
                                try:
                                    subprocess.run([
                                        'ffmpeg', '-i', str(audio_path),
                                        '-ar', str(target_sample_rate),
                                        '-ac', '1',
                                        '-y',
                                        str(new_audio_path)
                                    ], check=True, capture_output=True)
                                except:
                                    # 如果 ffmpeg 失败，直接复制
                                    shutil.copy2(audio_path, new_audio_path)
                        
                        audio_ref = f"audio/{new_filename}"
                    else:
                        audio_ref = str(audio_path)
                    
                    # 准备文本
                    text = sample['text']
                    if include_emotion_tag:
                        # 在文本前添加情绪标签
                        text = f"[{sample['emotion']}] {text}"
                    
                    # 写入 metadata: audio_path|speaker|text
                    writer.writerow([
                        audio_ref,
                        sample['speaker'],
                        text
                    ])
                    
                    if (i + 1) % 500 == 0:
                        print(f"  ✅ 已处理 {i + 1}/{len(samples)}...")
            
            print(f"  ✅ {split_name} 集完成: {len(samples)} 个样本")
            print(f"  📄 {metadata_path}")
            print()
        
        # 生成配置文件
        self._generate_config()
        
        print("=" * 80)
        print("✅ 导出完成！")
        print("=" * 80)
        print(f"📂 输出目录: {self.output_dir}")
        print(f"📄 Metadata 文件:")
        print(f"   - metadata_train.csv")
        print(f"   - metadata_val.csv")
        print(f"   - metadata_test.csv")
        print(f"🎵 音频目录: audio/")
        print()
    
    def _generate_config(self):
        """生成训练配置文件"""
        
        import json
        
        config = {
            "dataset_info": {
                "speaker": "shixinyu",
                "description": "时心语老师英语教学录音（4.77小时）",
                "emotions": list(self.emotions.values()),
                "total_samples": len(self.samples),
                "sample_rate": 22050
            },
            "training": {
                "batch_size": 16,
                "learning_rate": 0.0001,
                "num_epochs": 100,
                "save_interval": 5,
                "log_interval": 50
            },
            "model": {
                "type": "CosyVoice",
                "hidden_size": 256,
                "num_layers": 6
            }
        }
        
        config_file = self.output_dir / "training_config.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print(f"📝 生成训练配置: training_config.json")


def main():
    """主函数"""
    
    # 数据目录
    base_dir = "/Users/ailian/Downloads/AIJHSEnglishShixinyu1to1Recording_4.77H_251216"
    output_dir = "/Users/ailian/Downloads/cosyvoice_training_data"
    
    # 创建转换器
    converter = ShixinyuDatasetConverter(base_dir, output_dir)
    
    # 加载数据
    converter.load_all_data()
    
    # 显示统计信息
    converter.show_statistics()
    
    # 数据过滤（可选）
    print("=" * 80)
    print("🔍 数据过滤")
    print("=" * 80)
    converter.filter_by_duration(min_duration=1.0, max_duration=30.0)
    converter.filter_by_text_length(min_length=5, max_length=300)
    
    # 显示过滤后统计
    converter.show_statistics()
    
    # 导出数据
    converter.export(
        copy_audio=True,           # 复制音频文件
        target_sample_rate=22050,  # CosyVoice 推荐采样率
        include_emotion_tag=True   # 在文本中包含情绪标签
    )
    
    print("\n🎉 全部完成！现在可以开始训练 CosyVoice 模型了！")
    print(f"\n下一步:")
    print(f"  cd {output_dir}")
    print(f"  # 查看 training_config.json")
    print(f"  # 使用 CosyVoice 训练脚本开始训练")


if __name__ == "__main__":
    main()

