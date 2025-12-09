# 修复：质检数据管理页面"总句数"显示错误

## 📋 问题描述

**问题**：质检数据管理页面显示的"已标注总数"比视频实际的句子数量多很多。

**根本原因**：
1. **第一次修复（v1.0.2）**：使用了 `videos.total_sentences`（视频表中的总句数字段）
   - 但这个字段可能包含了**没有标注人**的数据
   - 用户反馈：显示的数字仍然偏多

2. **第二次修复（v1.0.3）**：改为统计**有标注人的不同句子数量**
   - 只统计 `annotator_name` 不为空的数据
   - 使用 `Set` 去重，确保每个句子只计数一次
   - 这才是真正的"已标注句数"

**示例**：
- 用户反馈：视频 `语文02.mp4` 显示 210 句，但实际有标注人的只有 184 句
- 差异来自：没有标注人的空白数据

## 🔍 问题演变

### 第一版（错误）- 统计所有标注数据

```typescript
// ❌ 旧代码：统计所有已标注数据（包括重复、多人标注）
const { data: pendingAnnotations, total } = await getPendingInspectionAnnotations(...);
newTotalAnnotated.set(selectedVideoId, total);
```

**问题**：
- 包含多人标注、重复数据
- 显示的是"数据条数"而非"句子数量"

### 第二版（部分正确）- 使用 videos.total_sentences

```typescript
// ⚠️ v1.0.2 代码：使用视频表的总句数字段
const currentVideo = await getVideo(selectedVideoId);
videoTotalSentences = currentVideo?.total_sentences || 0;
```

**问题**：
- `total_sentences` 包含了**没有标注人的句子**
- 这些句子可能是上传时的冗余数据，实际没有被标注
- 显示数字仍然偏多

### 第三版（正确）- 统计有标注人的不同句子

```typescript
// ✅ v1.0.3 代码：只统计有标注人的不同句子数量
const { data: sentenceData, error: sentenceError } = await supabase
  .from('annotations')
  .select('sentence_id')
  .eq('video_id', selectedVideoId)
  .not('annotator_name', 'is', null)  // 排除 NULL
  .neq('annotator_name', '');          // 排除空字符串

// 使用 Set 去重，统计不同的句子 ID 数量
const uniqueSentenceIds = new Set(sentenceData.map(item => item.sentence_id));
videoTotalSentences = uniqueSentenceIds.size;
```

**优点**：
- ✅ 只统计**有标注人**的句子
- ✅ 使用 `Set` 去重，每个句子只计数一次
- ✅ 准确反映"已标注句数"
- ✅ 不包含空白数据

## ✅ 最终解决方案

### 修改内容

#### 1. 统计有标注人的不同句子数量

**位置**：`src/pages/InspectionManagePage.tsx` 第130-158行

```typescript
let videoTotalSentences = 0; // 有标注人的句子总数
try {
  const currentVideo = await getVideo(selectedVideoId);
  videoUrl = currentVideo?.url || '';
  annotationFileName = currentVideo?.annotation_file_name || '';
  
  // 统计有标注人的不同句子数量（去重）
  const { data: sentenceData, error: sentenceError } = await supabase
    .from('annotations')
    .select('sentence_id')
    .eq('video_id', selectedVideoId)
    .not('annotator_name', 'is', null)
    .neq('annotator_name', '');
  
  if (sentenceError) {
    console.error('统计有标注人的句子数失败:', sentenceError);
  } else if (sentenceData) {
    // 使用 Set 去重，统计不同的句子 ID 数量
    const uniqueSentenceIds = new Set(sentenceData.map(item => item.sentence_id));
    videoTotalSentences = uniqueSentenceIds.size;
  }
} catch (error) {
  console.error('获取视频信息失败:', error);
}
```

#### 2. 更新状态

**位置**：`src/pages/InspectionManagePage.tsx` 第221-226行

```typescript
// 🔧 更新有标注人的句子总数
if (selectedVideoId && videoTotalSentences > 0) {
  const newTotalAnnotated = new Map(videoTotalAnnotated);
  newTotalAnnotated.set(selectedVideoId, videoTotalSentences);
  setVideoTotalAnnotated(newTotalAnnotated);
}
```

#### 3. 修改显示文本

**位置**：`src/pages/InspectionManagePage.tsx` 第643行

```typescript
// ✅ 新显示：准确的标签文本
<Tag color="blue">已标注句数: {record.totalAnnotated || 0} 句</Tag>
```

## 📊 修改对比

### 三个版本的对比

| 版本 | 数据来源 | 显示文本 | 包含内容 | 准确性 |
|------|----------|----------|----------|--------|
| **v1.0.1 及之前** | 查询统计 | "已标注总数" | 所有标注数据（含重复） | ❌ 偏高 |
| **v1.0.2** | `videos.total_sentences` | "视频总句数" | 包含无标注人的句子 | ⚠️ 仍然偏高 |
| **v1.0.3（最新）** | 统计有标注人的句子 | "已标注句数" | 只含有标注人的不同句子 | ✅ 准确 |

### 示例对比

假设视频 `语文02.mp4`：

| 指标 | v1.0.1 | v1.0.2 | v1.0.3（最新） |
|------|--------|--------|----------------|
| 显示数字 | 220+ 条 | 210 句 | 184 句 |
| 说明 | 包含重复数据 | 包含无标注人的句子 | 只含有标注人的句子 |
| 准确性 | ❌ 最不准确 | ⚠️ 部分准确 | ✅ 完全准确 |

## 🔍 数据库查询逻辑

### 去重统计的实现

```typescript
// 1. 查询所有有标注人的句子 ID
const { data: sentenceData } = await supabase
  .from('annotations')
  .select('sentence_id')
  .eq('video_id', selectedVideoId)
  .not('annotator_name', 'is', null)  // 排除 NULL
  .neq('annotator_name', '');          // 排除空字符串

// 2. 使用 Set 去重
const uniqueSentenceIds = new Set(
  sentenceData.map(item => item.sentence_id)
);

// 3. 统计不同句子的数量
videoTotalSentences = uniqueSentenceIds.size;
```

### 为什么需要去重？

- 同一个句子可能有多个标注人标注
- 需要统计的是**不同的句子数量**，而非标注数据条数
- 使用 `Set` 自动去重，确保每个句子只计数一次

## 📝 相关文件

### 修改的文件

1. **`src/pages/InspectionManagePage.tsx`**
   - 第130-158行：添加统计有标注人的句子数量的查询
   - 第221-226行：更新状态
   - 第643行：修改显示文本为"已标注句数"

2. **`FIX_TOTAL_SENTENCES_DISPLAY.md`**（本文件）
   - 更新说明文档，记录修复演变过程

## ✅ 验证方法

### SQL 验证查询

```sql
-- 验证：对比三种统计方式
SELECT 
  v.name AS 视频名称,
  v.total_sentences AS 视频表总句数,
  COUNT(*) AS 标注数据总条数,
  COUNT(DISTINCT a.sentence_id) AS 不同句子数,
  COUNT(DISTINCT CASE 
    WHEN a.annotator_name IS NOT NULL AND a.annotator_name != '' 
    THEN a.sentence_id 
  END) AS 有标注人的不同句子数
FROM videos v
LEFT JOIN annotations a ON a.video_id = v.id
WHERE v.name = '语文02.mp4'
GROUP BY v.id, v.name, v.total_sentences;
```

### 预期结果

- "已标注句数" = SQL 中的"有标注人的不同句子数"
- 这个数字 ≤ "视频表总句数"
- 这个数字 ≤ "不同句子数"

## 🎉 效果

- ✅ 显示准确的**已标注句数**（有标注人的不同句子数量）
- ✅ 不包含没有标注人的空白数据
- ✅ 自动去重，避免重复计数
- ✅ 标签文本清晰："已标注句数"

## 🔖 版本信息

- **第一次修复**: v1.0.2-annotation-tools（2025-12-09）
  - 改用 `videos.total_sentences`
  - 问题：仍然包含无标注人的数据

- **第二次修复**: v1.0.3-annotation-tools（2025-12-09）
  - 改为统计有标注人的不同句子数量
  - 完全解决问题

## 📌 技术要点

1. **过滤条件**
   - `.not('annotator_name', 'is', null)` - 排除 NULL
   - `.neq('annotator_name', '')` - 排除空字符串

2. **去重方法**
   - 使用 JavaScript 的 `Set` 数据结构
   - 自动去除重复的 `sentence_id`

3. **显示优化**
   - 标签文本从"视频总句数"改为"已标注句数"
   - 更准确地表达数据含义
