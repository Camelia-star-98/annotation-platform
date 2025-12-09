# 修复：质检数据管理页面"总句数"显示错误

## 📋 问题描述

**问题**：质检数据管理页面显示的"已标注总数"比视频实际的句子数量多很多。

**示例**：
- 用户反馈：视频 `语文02.mp4` 有 184 句，但页面显示"已标注总数: 200+ 条"
- 原因：系统统计的是**所有已标注数据的数量**（包括重复标注、多人标注等），而不是视频的实际总句子数

## 🔍 问题根源

### 旧逻辑（错误）

**位置**：`src/pages/InspectionManagePage.tsx`

1. **第206行** - 设置 `totalAnnotated` 时使用了错误的数据源：
```typescript
// ❌ 旧代码：使用查询到的已标注数据数量
const { data: pendingAnnotations, total } = await getPendingInspectionAnnotations(...);
newTotalAnnotated.set(selectedVideoId, total); // total 是已标注数据数量，不是视频总句数
```

2. **第626行** - 显示时使用了误导性的标签：
```typescript
<Tag color="blue">已标注总数: {record.totalAnnotated || 0} 条</Tag>
```

### 问题分析

- `getPendingInspectionAnnotations` 返回的 `total` 是**已标注数据的数量**
- 这个数量包括：
  - 多个标注人对同一句子的标注（如果有重复）
  - 所有已质检和未质检的数据
  - 可能存在的历史遗留重复数据
- **不等于**视频的实际总句子数

## ✅ 解决方案

### 修改内容

#### 1. 获取视频的 `total_sentences` 字段

```typescript
// ✅ 新代码：从 videos 表获取实际总句子数
let videoTotalSentences = 0; // 视频实际总句子数
try {
  const currentVideo = await getVideo(selectedVideoId);
  videoUrl = currentVideo?.url || '';
  annotationFileName = currentVideo?.annotation_file_name || '';
  videoTotalSentences = currentVideo?.total_sentences || 0; // 获取视频实际总句子数
} catch (error) {
  console.error('获取视频信息失败，将继续使用传入的视频名称:', error);
}
```

#### 2. 使用 `total_sentences` 而不是查询统计

```typescript
// 🔧 更新视频总句子数：使用 videos 表的 total_sentences 字段（视频实际总句子数）
if (selectedVideoId && videoTotalSentences > 0) {
  const newTotalAnnotated = new Map(videoTotalAnnotated);
  newTotalAnnotated.set(selectedVideoId, videoTotalSentences);
  setVideoTotalAnnotated(newTotalAnnotated);
}
```

#### 3. 修改显示文本

```typescript
// ✅ 新显示：更准确的标签文本
<Tag color="blue">视频总句数: {record.totalAnnotated || 0} 句</Tag>
```

## 📊 修改影响

### ✅ 修改后的行为

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| **显示的数字** | 已标注数据数量（可能有重复） | 视频实际总句子数 |
| **数据来源** | 查询 `annotations` 表统计 | 读取 `videos.total_sentences` 字段 |
| **标签文本** | "已标注总数: X 条" | "视频总句数: X 句" |
| **准确性** | ❌ 可能偏高（包含重复） | ✅ 准确（来自上传文件） |

### 示例对比

假设视频 `语文02.mp4` 有 184 句：

| 指标 | 修改前 | 修改后 |
|------|--------|--------|
| 显示数字 | 200+ 条 | 184 句 |
| 说明 | 包含多人标注、重复数据等 | 视频实际总句子数 |

## 🔧 数据库支持

### `videos.total_sentences` 字段

该字段在之前的版本中已添加（参见 `ADD_TOTAL_SENTENCES_FIELD.md`）：

```sql
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS total_sentences INTEGER DEFAULT 0;

COMMENT ON COLUMN videos.total_sentences IS '视频总句数（上传的标注文件中的句子总数）';
```

**特点**：
- ✅ 在上传标注文件时自动填充
- ✅ 反映视频的实际句子总数
- ✅ 不受标注、质检、复审等操作影响
- ✅ 稳定可靠，不会因数据重复而变化

## 📝 相关文件

### 修改的文件

1. **`src/pages/InspectionManagePage.tsx`**
   - 第134-139行：获取 `total_sentences` 字段
   - 第205-210行：使用 `total_sentences` 设置 `totalAnnotated`
   - 第627行：修改显示文本为"视频总句数"

### 相关的 API

1. **`src/api/database.ts`** - `getVideo()` 函数
   - 第70行：已包含 `total_sentences` 字段的查询

## ✅ 验证方法

### 验证步骤

1. **打开质检数据管理页面**
   - 路径：首页 → 质检 → 选择视频 → 进入质检管理

2. **查看视频信息**
   - 展开视频行，查看"视频总句数"标签
   - 确认数字与视频实际句子数一致

3. **对比数据库**
   ```sql
   SELECT 
     v.name AS 视频名称,
     v.total_sentences AS 总句数,
     COUNT(DISTINCT a.sentence_no) AS 实际不同句子数,
     COUNT(*) AS 标注数据总数
   FROM videos v
   LEFT JOIN annotations a ON a.video_id = v.id
   GROUP BY v.id, v.name, v.total_sentences
   ORDER BY v.created_at DESC;
   ```

### 预期结果

- "视频总句数"应该等于 `videos.total_sentences`
- 不再显示误导性的"已标注总数"
- 数字应该与上传的标注文件中的句子数一致

## 🎉 效果

- ✅ 显示准确的视频总句子数
- ✅ 不受数据重复、多人标注等因素影响
- ✅ 用户可以清晰地了解视频的规模
- ✅ 标签文本更清晰：从"已标注总数"改为"视频总句数"

## 🔖 版本信息

- **修复版本**: v1.0.2-annotation-tools
- **修复日期**: 2025-12-09
- **问题类型**: 数据显示错误
