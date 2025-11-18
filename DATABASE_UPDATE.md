# Supabase 数据库更新 SQL

请在 Supabase SQL Editor 中执行以下 SQL 来添加 `is_completed` 字段：

```sql
-- 添加 is_completed 字段到 videos 表
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT false;

-- 添加注释
COMMENT ON COLUMN videos.is_completed IS '是否完成所有流程：教研标注 → 抽样质检 → 产品复检';

-- 查看表结构确认
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos'
ORDER BY ordinal_position;
```

## 使用说明

### 1. 标记视频为已完成

当一个视频完成所有流程后，可以在 Supabase Table Editor 或通过 API 更新：

```sql
-- 标记某个视频为已完成
UPDATE videos 
SET is_completed = true 
WHERE id = 'your_video_id';
```

### 2. 批量标记

```sql
-- 查询需要标记的视频
SELECT v.id, v.name, 
       COUNT(a.id) as total_annotations,
       COUNT(CASE WHEN a.is_qualified = true THEN 1 END) as qualified_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
GROUP BY v.id, v.name;

-- 手动标记已完成的视频（请根据实际情况修改 ID）
UPDATE videos 
SET is_completed = true 
WHERE id IN ('video_id_1', 'video_id_2', 'video_id_3');
```

### 3. 重置标记

```sql
-- 如果需要重置某个视频的完成状态
UPDATE videos 
SET is_completed = false 
WHERE id = 'your_video_id';
```

## 完成流程的判断标准

一个视频被标记为 `is_completed = true` 应满足：

1. ✅ **教研标注完成**：所有句子都已标注（`humanAnnotatedText` 不为空）
2. ✅ **抽样质检通过**：质检的数据都标记为合格（`is_qualified = true`）
3. ✅ **产品复检通过**：PM 复检确认无误

目前需要手动在 Supabase 中标记，后续可以开发自动化流程。

