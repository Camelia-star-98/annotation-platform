-- ============================================
-- 步骤1：查询视频ID（先执行这个，获取video_id）
-- ============================================
SELECT id, name, subject 
FROM videos 
WHERE name IN (
  '1104-英语-1.mp4',
  '1104-英语-2.mp4',
  '1104-数学-1.mp4',
  '1104-数学-2.mp4',
  '1104-物理-1.mp4',
  '1104-物理-2.mp4'
)
ORDER BY name;

-- ============================================
-- 步骤2：恢复杨璐瑞的英语视频复检状态
-- ============================================
-- 请将下面的 'VIDEO_ID_英语1' 和 'VIDEO_ID_英语2' 替换为步骤1查询到的实际ID
/*
UPDATE annotations
SET 
  review_status = true,
  reviewer = '杨璐瑞',
  review_completed_at = NOW()
WHERE video_id IN (
  'VIDEO_ID_英语1',  -- 替换为 1104-英语-1.mp4 的实际ID
  'VIDEO_ID_英语2'   -- 替换为 1104-英语-2.mp4 的实际ID
)
AND annotator = '杨璐瑞';
*/

-- ============================================
-- 步骤3：恢复王曦禾的数学和物理视频复检状态
-- ============================================
/*
UPDATE annotations
SET 
  review_status = true,
  reviewer = '王曦禾',
  review_completed_at = NOW()
WHERE video_id IN (
  'VIDEO_ID_数学1',  -- 替换为 1104-数学-1.mp4 的实际ID
  'VIDEO_ID_数学2',  -- 替换为 1104-数学-2.mp4 的实际ID
  'VIDEO_ID_物理1',  -- 替换为 1104-物理-1.mp4 的实际ID
  'VIDEO_ID_物理2'   -- 替换为 1104-物理-2.mp4 的实际ID
)
AND annotator = '王曦禾';
*/

-- ============================================
-- 步骤4：验证恢复结果
-- ============================================
/*
SELECT 
  v.name,
  v.subject,
  COUNT(a.id) as total_annotations,
  SUM(CASE WHEN a.review_status = true THEN 1 ELSE 0 END) as reviewed_count,
  a.reviewer,
  a.annotator
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
WHERE v.name IN (
  '1104-英语-1.mp4',
  '1104-英语-2.mp4',
  '1104-数学-1.mp4',
  '1104-数学-2.mp4',
  '1104-物理-1.mp4',
  '1104-物理-2.mp4'
)
GROUP BY v.name, v.subject, a.reviewer, a.annotator
ORDER BY v.name;
*/
