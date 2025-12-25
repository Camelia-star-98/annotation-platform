-- ===============================================
-- 修复错误的 is_completed 状态
-- ===============================================
-- 问题：某些视频被标记为 is_completed = true，但实际上没有任何已复检的数据
-- 原因：可能是误点了"完成复检"按钮，或者数据库状态不一致
-- 
-- 解决方案：
-- 1. 找出所有 is_completed = true 但没有任何 review_status = true 数据的视频
-- 2. 将这些视频的 is_completed 状态重置为 false
-- ===============================================

-- 步骤 1: 查看有问题的视频
SELECT 
  v.id,
  v.name,
  v.subject,
  v.is_completed,
  v.review_completed_at,
  COUNT(a.id) as total_annotations,
  COUNT(CASE WHEN a.review_status = true THEN 1 END) as reviewed_count,
  COUNT(CASE WHEN a.status = true AND a.review_status IS NOT true THEN 1 END) as pending_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
  AND a.annotator IS NOT NULL 
  AND a.annotator != '' 
  AND a.annotator != 'unknown'
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
HAVING COUNT(CASE WHEN a.review_status = true THEN 1 END) = 0
ORDER BY v.review_completed_at DESC NULLS LAST;

-- 步骤 2: 修复这些视频的状态
-- 将 is_completed = true 但没有任何已复检数据的视频重置为 false
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
    AND a.annotator IS NOT NULL 
    AND a.annotator != '' 
    AND a.annotator != 'unknown'
);

-- 步骤 3: 验证修复结果
-- 再次查询，应该没有问题视频了
SELECT 
  v.id,
  v.name,
  v.subject,
  v.is_completed,
  v.review_completed_at,
  COUNT(a.id) as total_annotations,
  COUNT(CASE WHEN a.review_status = true THEN 1 END) as reviewed_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
  AND a.annotator IS NOT NULL 
  AND a.annotator != '' 
  AND a.annotator != 'unknown'
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
HAVING COUNT(CASE WHEN a.review_status = true THEN 1 END) = 0
ORDER BY v.review_completed_at DESC NULLS LAST;

-- 如果步骤 3 返回 0 行，说明修复成功！

-- ===============================================
-- 可选：查看所有正常的已复检视频（作为对比）
-- ===============================================
SELECT 
  v.id,
  v.name,
  v.subject,
  v.is_completed,
  v.review_completed_at,
  COUNT(a.id) as total_annotations,
  COUNT(CASE WHEN a.review_status = true THEN 1 END) as reviewed_count,
  COUNT(CASE WHEN a.status = true AND a.review_status IS NOT true THEN 1 END) as pending_count,
  ROUND(
    COUNT(CASE WHEN a.review_status = true THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN a.status = true THEN 1 END), 0) * 100, 
    2
  ) as review_progress_percent
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id 
  AND a.annotator IS NOT NULL 
  AND a.annotator != '' 
  AND a.annotator != 'unknown'
WHERE v.is_completed = true
GROUP BY v.id, v.name, v.subject, v.is_completed, v.review_completed_at
HAVING COUNT(CASE WHEN a.review_status = true THEN 1 END) > 0
ORDER BY v.review_completed_at DESC NULLS LAST
LIMIT 20;

