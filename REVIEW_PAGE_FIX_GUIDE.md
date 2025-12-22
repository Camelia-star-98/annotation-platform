# 🔧 产品复检页面问题诊断与修复指南

## 📋 问题现象

- ❌ "待复检"标签页：显示 `0 个视频`，显示"暂无数据"
- ❌ "已复检"标签页：显示 `0 个视频`，显示"暂无数据"

---

## 🔍 根本原因分析

### 代码逻辑说明

#### "待复检"标签页的显示条件：
1. ✅ 视频有已完成的标注数据（`annotations.status = true`）
2. ✅ 该标注人有质检通过的数据（`annotations.is_qualified = true`）
3. ✅ **videos.is_completed != true**（未标记为已完成复检）

#### "已复检"标签页的显示条件：
1. ✅ **videos.is_completed = true**（已标记为完成复检）
2. ✅ 视频有标注数据

### 可能的问题原因

#### 情况 1：所有视频都被错误标记为 `is_completed = true`
- 结果：
  - "待复检"：被第 3 个条件过滤掉 → 0 个视频
  - "已复检"：显示所有视频（如果有标注数据的话）

#### 情况 2：所有视频都是 `is_completed = NULL` 或 `false`
- 结果：
  - "待复检"：显示所有有质检通过数据的视频
  - "已复检"：被第 1 个条件过滤掉 → 0 个视频

#### 情况 3：之前的某个操作错误修改了数据
- 可能误将不该标记为完成的视频标记为完成
- 或者误清空了应该标记为完成的视频

---

## 🛠️ 修复步骤

### 步骤 1：诊断当前状态

在 Supabase SQL Editor 中运行 `CHECK_current_status.sql`：

```bash
# 文件位置
/Users/ailian/Downloads/annotation-platform/CHECK_current_status.sql
```

关键查询结果分析：

1. **查询 1**：`is_completed` 的分布
   - 如果大部分视频都是 `true` → 说明被错误标记了
   - 如果大部分视频都是 `NULL/false` → 说明缺少已完成的标记

2. **查询 4**：在 `annotation_completions` 中但 `is_completed != true` 的视频
   - 这些视频应该标记为已完成，但没有标记
   - 需要同步数据

3. **查询 5**：`is_completed = true` 但没有 `annotation_completions` 记录
   - 这些视频不应该标记为已完成
   - 需要重置状态

### 步骤 2：执行修复

在 Supabase SQL Editor 中运行 `FIX_review_page_complete.sql`：

```bash
# 文件位置
/Users/ailian/Downloads/annotation-platform/FIX_review_page_complete.sql
```

**重要说明：**

1. **先执行诊断部分**（第一步和第二步）
   - 查看具体有多少数据需要修复
   - 确认修复策略是否正确

2. **再执行修复部分**（第三步）
   - ⚠️ **3.1 重置操作**：将错误标记为完成的视频恢复为未完成
     - 只重置那些在 `annotation_completions` 中没有记录的视频
     - 这些视频不应该显示在"已复检"标签页
   
   - ✅ **3.2 同步操作**：将 `annotation_completions` 的数据同步到 `videos` 表
     - 这些视频应该显示在"已复检"标签页

3. **最后验证结果**（第四步）
   - 确认"待复检"和"已复检"的视频数都正常

### 步骤 3：刷新页面验证

1. 打开产品复检页面
2. 点击"待复检"标签页 → 应该能看到有质检通过数据但未完成复检的视频
3. 点击"已复检"标签页 → 应该能看到已点击"完成复检"按钮的视频

---

## 📊 预期结果

### 正常情况下的数据分布

假设有 100 个视频：

- **待复检**：约 80-90 个
  - 有标注数据
  - 质检已通过
  - 但还没点"完成复检"按钮

- **已复检**：约 10-20 个
  - 已点击"完成复检"按钮
  - `videos.is_completed = true`
  - `annotation_completions` 表有对应记录

---

## 🚨 常见问题

### Q1: 修复后"待复检"还是 0 个视频？

**可能原因：**
- 所有视频都被标记为 `is_completed = true`
- 需要检查是否有视频不应该被标记为完成

**解决方案：**
```sql
-- 查看哪些视频被标记为完成但可能不应该
SELECT 
    v.id,
    v.name,
    v.is_completed,
    COUNT(DISTINCT a.annotator) FILTER (WHERE a.review_status = true) as "已复检人数",
    COUNT(DISTINCT a.annotator) FILTER (WHERE a.status = true AND a.review_status != true) as "待复检人数"
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.is_completed
HAVING COUNT(DISTINCT a.annotator) FILTER (WHERE a.status = true AND a.review_status != true) > 0
ORDER BY v.id;

-- 如果上面的查询有结果，说明这些视频还有待复检的标注人
-- 需要将它们重置为未完成状态
UPDATE videos
SET is_completed = NULL, review_completed_at = NULL
WHERE id IN (
    -- 粘贴上面查询结果中的视频 ID
);
```

### Q2: 修复后"已复检"还是 0 个视频？

**可能原因：**
- 所有视频都被重置为 `is_completed = NULL`
- 但实际上有些视频应该保持已完成状态

**解决方案：**
```sql
-- 查看 annotation_completions 中的视频
SELECT 
    ac.video_id,
    v.name,
    v.is_completed,
    ac.completed_at
FROM annotation_completions ac
LEFT JOIN videos v ON ac.video_id = v.id
WHERE v.is_completed IS DISTINCT FROM true;

-- 如果有结果，执行同步
UPDATE videos v
SET 
    is_completed = true,
    review_completed_at = ac.completed_at
FROM annotation_completions ac
WHERE v.id = ac.video_id;
```

### Q3: 如何手动标记某个视频为"已完成复检"？

**解决方案：**
```sql
-- 1. 先插入 annotation_completions 记录
INSERT INTO annotation_completions (video_id, annotator_name, annotation_count, completed_at)
SELECT 
    'YOUR_VIDEO_ID',  -- 替换为实际的视频 ID
    STRING_AGG(DISTINCT annotator, ', '),
    COUNT(*),
    NOW()
FROM annotations
WHERE video_id = 'YOUR_VIDEO_ID'
  AND status = true
  AND review_status = true;

-- 2. 更新 videos 表
UPDATE videos
SET 
    is_completed = true,
    review_completed_at = NOW()
WHERE id = 'YOUR_VIDEO_ID';
```

---

## 📝 补充说明

### videos 表的字段含义

- `is_completed`：布尔值，表示该视频是否已完成复检
  - `true`：已点击"完成复检"按钮
  - `false/NULL`：还未完成复检

- `review_completed_at`：时间戳，记录点击"完成复检"的时间

### annotation_completions 表

- 当管理员在产品复检页面点击"完成复检"按钮时插入记录
- 记录内容包括：
  - `video_id`：视频 ID
  - `annotator_name`：参与的标注人名单
  - `annotation_count`：标注总数
  - `completed_at`：完成时间

### 数据一致性原则

**重要：两张表必须保持同步**

✅ 正确的状态：
```
videos.is_completed = true 
<=> 
annotation_completions 中有对应的 video_id 记录
```

❌ 错误的状态：
- `videos.is_completed = true` 但 `annotation_completions` 中没有记录
- `annotation_completions` 中有记录但 `videos.is_completed != true`

---

## 💡 预防措施

为了避免将来再次出现数据不一致，建议：

1. **使用数据库触发器**确保 `videos` 和 `annotation_completions` 同步
2. **定期运行诊断脚本**检查数据一致性
3. **在修改数据前备份**，以便快速回滚

---

需要帮助请联系开发团队！


