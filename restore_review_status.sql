-- ============================================
-- 恢复复检状态 SQL 脚本
-- 生成时间: 2024
-- ============================================

-- 步骤1: 恢复杨璐瑞的英语视频复检状态
UPDATE annotations
SET 
  review_status = true,
  reviewer = '杨璐瑞',
  review_completed_at = NOW()
WHERE video_id IN (
  'upload_1763540297842',  -- 1104-英语-1.mp4
  'upload_1763540015960'   -- 1104-英语-2.mp4
)
AND annotator = '杨璐瑞';

-- 步骤2: 恢复王曦禾的数学和物理视频复检状态
UPDATE annotations
SET 
  review_status = true,
  reviewer = '王曦禾',
  review_completed_at = NOW()
WHERE video_id IN (
  'upload_1763539359554',  -- 1104-数学-1.mp4
  'upload_1763539635739',  -- 1104-数学-2.mp4
  'upload_1763538054288',  -- 1104-物理-1.mp4
  'upload_1763538826122'   -- 1104-物理-2.mp4
)
AND annotator = '王曦禾';

-- 步骤3: 验证恢复结果
SELECT 
  v.name,
  v.subject,
  a.annotator,
  COUNT(*) as total_count,
  SUM(CASE WHEN a.review_status = true THEN 1 ELSE 0 END) as reviewed_count,
  MAX(a.reviewer) as reviewer
FROM videos v
JOIN annotations a ON v.id = a.video_id
WHERE v.id IN (
  'upload_1763540297842',
  'upload_1763540015960',
  'upload_1763539359554',
  'upload_1763539635739',
  'upload_1763538054288',
  'upload_1763538826122'
)
GROUP BY v.name, v.subject, a.annotator
ORDER BY v.name;
