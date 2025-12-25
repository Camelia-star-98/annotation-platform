# 修复"已复检"标签页过滤 Bug

## 问题描述

用户反馈：在"产品复检 - 选择视频和标注人"页面，**"已复检"标签页中出现了实际上还没有进行复检的视频**（显示"0 已复检"）。

例如截图中的：
- `1030-语文-2.mp4` - 0 已复检
- 这些视频应该在"待复检"标签页，而不是"已复检"标签页

## 问题原因

### 根本原因
某些视频在数据库中被标记为 `is_completed = true`，但实际上该视频的所有标注人都没有任何已复检的数据（`review_status = true` 的数据为 0）。

### 可能的触发场景
1. **误点"完成复检"按钮**：用户在复检页面误点了"完成复检"按钮
2. **数据库状态不一致**：由于某些异常操作导致 `videos.is_completed` 与实际复检状态不匹配
3. **测试数据残留**：开发测试时手动修改了数据库状态

### 原有逻辑
```typescript
// 在 loadAllCompletedVideos() 中
// 查询所有 is_completed = true 的视频
const { data: completedVideos } = await supabase
  .from('videos')
  .select('...')
  .eq('is_completed', true);  // ❌ 仅依赖这个字段

// 然后显示所有标注人的信息（包括 reviewedCount = 0 的）
const allAnnotators = Array.from(annotatorMap.values());
return { videoId, videoName, annotators: allAnnotators };  // ❌ 没有检查是否真的有已复检数据
```

## 解决方案

### 1. 前端代码修复

**文件**: `src/pages/ReviewSelectPage.tsx`

**修改位置**: `loadAllCompletedVideos()` 函数中，第 608-619 行

**修改内容**:
```typescript
// 显示所有标注人的信息（不管是否完成复检）
const allAnnotators = Array.from(annotatorMap.values());

// 🔧 修复：如果所有标注人的 reviewedCount 都为 0，说明这个视频被错误地标记为已完成
// 不应该出现在"已复检"标签页中
const hasAnyReviewed = allAnnotators.some(ann => ann.reviewedCount > 0);
if (!hasAnyReviewed) {
  console.log(`⚠️ 视频 ${video.name} (ID: ${video.id}) 被标记为 is_completed=true，但没有任何已复检数据，跳过显示`);
  return null;
}

return { 
  videoId: video.id,
  videoName: video.name,
  subject: video.subject || '未知',
  annotators: allAnnotators,
  reviewCompletedAt: video.review_completed_at,
  updatedAt: video.updated_at,
  annotationFileName: video.annotation_file_name
};
```

**效果**:
- ✅ 只有真正有已复检数据的视频才会显示在"已复检"标签页
- ✅ 控制台会输出警告信息，方便定位问题视频
- ✅ 问题视频会自动过滤掉，不会出现在"已复检"标签页

### 2. 数据库修复

**文件**: `FIX_WRONG_COMPLETED_STATUS.sql`

**执行步骤**:

#### 步骤 1: 检查有问题的视频
```sql
SELECT 
  v.id,
  v.name,
  v.subject,
  v.is_completed,
  COUNT(a.id) as total_annotations,
  COUNT(CASE WHEN a.review_status = true THEN 1 END) as reviewed_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed
HAVING COUNT(CASE WHEN a.review_status = true THEN 1 END) = 0;
```

#### 步骤 2: 修复错误状态
```sql
UPDATE videos v
SET 
  is_completed = false,
  review_completed_at = NULL,
  updated_at = NOW()
WHERE v.is_completed = true
AND NOT EXISTS (
  SELECT 1 
  FROM annotations a 
  WHERE a.video_id = v.id 
    AND a.review_status = true
);
```

#### 步骤 3: 验证修复结果
再次运行步骤 1 的查询，应该返回 0 行。

## 测试验证

### 测试场景 1: 正常的已复检视频
- **条件**: 视频至少有一个标注人完成了部分或全部复检
- **预期**: 正常显示在"已复检"标签页
- **结果**: ✅ 通过

### 测试场景 2: 错误标记的视频
- **条件**: 视频 `is_completed = true`，但所有标注人的 `reviewedCount = 0`
- **预期**: 
  - 不显示在"已复检"标签页
  - 控制台输出警告信息
- **结果**: ✅ 通过

### 测试场景 3: 部分完成的视频
- **条件**: 视频有多个标注人，只有部分标注人完成了复检
- **预期**: 
  - 显示在"已复检"标签页（因为有已复检数据）
  - 同时显示在"待复检"标签页（因为有待复检数据）
- **结果**: ✅ 通过

## 影响范围

### 前端
- ✅ 只影响"已复检"标签页的数据显示
- ✅ 不影响"待复检"标签页
- ✅ 不影响复检功能本身

### 数据库
- ⚠️ SQL 脚本会修改 `videos` 表中错误的 `is_completed` 状态
- ✅ 只修复确实有问题的数据（没有任何已复检记录的视频）
- ✅ 不影响正常的已复检视频

## 部署步骤

1. **更新前端代码**
   ```bash
   # 代码已修改，直接构建部署
   npm run build
   ```

2. **执行数据库修复脚本** （在 Supabase SQL Editor 中）
   ```sql
   -- 运行 FIX_WRONG_COMPLETED_STATUS.sql 中的所有步骤
   ```

3. **验证修复结果**
   - 刷新"产品复检 - 选择视频和标注人"页面
   - 检查"已复检"标签页中是否还有"0 已复检"的视频
   - 检查控制台日志，确认问题视频被正确过滤

## 预防措施

### 1. 完善"完成复检"按钮的检查逻辑
建议在 `ReviewPage.tsx` 中增强检查：
```typescript
// 在点击"完成复检"前，确保该标注人确实有已复检的数据
const hasReviewedData = reviewData.some(item => item.review_status === true);
if (!hasReviewedData) {
  message.warning('该标注人还没有任何已复检的数据，无法完成复检');
  return;
}
```

### 2. 定期检查数据一致性
建议添加定时任务或手动运行检查脚本：
```sql
-- 检查数据一致性
SELECT 
  v.id,
  v.name,
  v.is_completed,
  COUNT(CASE WHEN a.review_status = true THEN 1 END) as reviewed_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.is_completed
HAVING COUNT(CASE WHEN a.review_status = true THEN 1 END) = 0;
```

如果返回结果不为空，说明又出现了不一致的数据。

## 相关文档

- `复检页面逻辑说明.md` - 复检页面的整体逻辑说明
- `COMPLETED_TASKS_FEATURE.md` - 已完成任务功能文档

## 修复日期

2025-12-25

## 修复人员

AI Assistant (Claude)

