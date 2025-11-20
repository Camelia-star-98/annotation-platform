-- 修复已复检数据的 review_status 字段
-- 问题：已复检的数据 review_status 为 null，导致数据分析页面找不到数据

-- 步骤1：检查有复检人但 review_status 为 null 的数据
SELECT 
  COUNT(*) as affected_count,
  COUNT(DISTINCT video_id) as affected_videos
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != ''
  AND (review_status IS NULL OR review_status = false);

-- 步骤2：查看具体的受影响数据
SELECT 
  id,
  video_id,
  sentence_no,
  annotator,
  reviewer,
  review_status,
  status
FROM annotations
WHERE reviewer IS NOT NULL 
  AND reviewer != ''
  AND (review_status IS NULL OR review_status = false)
LIMIT 20;

-- 步骤3：修复数据 - 将有复检人但 review_status 为 null 的数据更新为 true
UPDATE annotations
SET review_status = true
WHERE reviewer IS NOT NULL 
  AND reviewer != ''
  AND (review_status IS NULL OR review_status = false);

-- 步骤4：验证修复结果
SELECT 
  COUNT(*) as total_reviewed_count,
  COUNT(DISTINCT video_id) as reviewed_videos_count,
  COUNT(DISTINCT reviewer) as unique_reviewers
FROM annotations
WHERE review_status = true;

-- 步骤5：按视频统计复检情况
SELECT 
  v.id,
  v.name,
  v.subject,
  COUNT(a.id) as total_annotations,
  COUNT(CASE WHEN a.review_status = true THEN 1 END) as reviewed_count,
  COUNT(DISTINCT a.reviewer) as reviewer_count
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
GROUP BY v.id, v.name, v.subject
ORDER BY v.name;

