# 添加 total_sentences 字段 - 完整说明

## 📋 问题背景

之前"所有已标注任务"页面显示的**总标注数**是从 `annotations` 表统计的句子数，这可能不准确（如果有些句子被删除了）。

**正确的做法**：总标注数应该是**上传的标注文件（Excel）里的句子总数**，这个值在上传时就是确定的，不应该动态统计。

## ✅ 解决方案

在 `videos` 表添加 `total_sentences` 字段，用于存储上传的标注文件中的句子总数。

## 🔧 实施步骤

### 步骤1：添加数据库字段

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 添加 total_sentences 字段
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS total_sentences INTEGER DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN videos.total_sentences IS '视频总句数（上传的标注文件中的句子总数）';
```

或者使用提供的工具：打开 `update_total_sentences.html`，按照页面指引操作。

### 步骤2：更新已有数据

有两种方式：

#### 方式A：使用 SQL（推荐，速度快）

```sql
-- 为已有视频更新 total_sentences（从 annotations 表统计）
UPDATE videos v
SET total_sentences = (
  SELECT COUNT(DISTINCT sentence_no)
  FROM annotations
  WHERE video_id = v.id
)
WHERE total_sentences = 0 OR total_sentences IS NULL;
```

#### 方式B：使用 HTML 工具（图形化界面）

1. 打开 `update_total_sentences.html`
2. 点击"步骤1：检查表结构"
3. 点击"步骤2：添加字段"（如果需要）
4. 点击"步骤3：更新数据"
5. 点击"步骤4：验证结果"

### 步骤3：重启应用

更新完成后，刷新前端页面即可看到效果。

## 📝 代码修改说明

### 1. 类型定义（`src/types/index.ts`）

```typescript
export interface VideoInfo {
  // ... 其他字段
  total_sentences?: number; // 新增：视频总句数
}
```

### 2. 数据库操作（`src/api/database.ts`）

上传视频时保存 `total_sentences`：

```typescript
const insertData = {
  // ... 其他字段
  total_sentences: video.total_sentences || 0
};
```

### 3. 上传逻辑（`src/pages/VideoManagePage.tsx`）

在三处上传位置添加 `total_sentences`：

```typescript
await addVideo({
  // ... 其他字段
  total_sentences: excelData.length // 保存视频总句数
});
```

### 4. 查询逻辑（`src/pages/AnnotationTaskListPage.tsx`）

改为从 `videos` 表读取：

```typescript
// 旧代码：从 annotations 表统计
for (const videoId of videoIds) {
  const { data: allSentences } = await supabase
    .from('annotations')
    .select('sentence_no')
    .eq('video_id', videoId);
  // ...
}

// 新代码：直接从 videos 表读取
const videoTotalSentences = new Map<string, number>();
allVideos.forEach(video => {
  if (video.total_sentences) {
    videoTotalSentences.set(video.id, video.total_sentences);
  }
});
```

### 5. 质检管理页面（`src/pages/InspectionManagePage.tsx`）

同样改为从 `videos` 表读取。

## 🎯 效果

### 之前
- ❌ 从 `annotations` 表动态统计句子数
- ❌ 如果有句子被删除，统计会不准确
- ❌ 每次查询都要统计，性能差

### 之后
- ✅ 上传时保存总句数到 `videos.total_sentences`
- ✅ 直接从 `videos` 表读取，准确可靠
- ✅ 查询速度更快，不需要统计

## ✅ 验证

### 验证SQL

```sql
-- 查看最近的视频
SELECT 
  id,
  name,
  total_sentences,
  (SELECT COUNT(DISTINCT sentence_no) FROM annotations WHERE video_id = videos.id) as actual_count
FROM videos
ORDER BY created_at DESC
LIMIT 10;
```

### 验证工具

打开 `update_total_sentences.html`，点击"步骤4：验证结果"。

## 📂 相关文件

- ✅ `add_total_sentences_column.sql` - SQL脚本
- ✅ `update_total_sentences.html` - HTML工具
- ✅ `src/types/index.ts` - 类型定义
- ✅ `src/api/database.ts` - 数据库操作
- ✅ `src/pages/VideoManagePage.tsx` - 上传逻辑
- ✅ `src/pages/AnnotationTaskListPage.tsx` - 查询逻辑
- ✅ `src/pages/InspectionManagePage.tsx` - 质检页面

## 🚀 部署

1. 执行数据库更新（步骤1 + 步骤2）
2. 部署新代码
3. 验证功能正常

---

**完成时间**：2025-12-01

