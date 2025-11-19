-- ============================================
-- 恢复这7个视频的复检状态
-- ============================================

-- 恢复杨璐瑞的语文和英语视频
UPDATE annotations
SET 
  review_status = true,
  reviewer = '杨璐瑞'
WHERE video_id IN (
  'upload_1763542691629',  -- 1104-语文-1.mp4
  'upload_1763540297842',  -- 1104-英语-1.mp4
  'upload_1763540015960'   -- 1104-英语-2.mp4
)
AND annotator = '杨璐瑞';

-- 恢复王曦禾的数学和物理视频
UPDATE annotations
SET 
  review_status = true,
  reviewer = '王曦禾'
WHERE video_id IN (
  'upload_1763539635739',  -- 1104-数学-2.mp4
  'upload_1763539359554',  -- 1104-数学-1.mp4
  'upload_1763538826122',  -- 1104-物理-2.mp4
  'upload_1763538054288'   -- 1104-物理-1.mp4
)
AND annotator = '王曦禾';

-- 验证结果
SELECT 
  v.name,
  a.annotator,
  COUNT(*) as total,
  SUM(CASE WHEN a.review_status = true THEN 1 ELSE 0 END) as reviewed,
  MAX(a.reviewer) as reviewer
FROM videos v
JOIN annotations a ON v.id = a.video_id
WHERE v.id IN (
  'upload_1763542691629',
  'upload_1763540297842',
  'upload_1763540015960',
  'upload_1763539635739',
  'upload_1763539359554',
  'upload_1763538826122',
  'upload_1763538054288'
)
GROUP BY v.name, a.annotator
ORDER BY v.name;
